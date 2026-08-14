// Documentos técnicos de una unidad (manual del fabricante, ficha comercial).
//
// Los metadatos van en la tabla `vehiculo_docs` y el PDF en el bucket privado
// `vehiculo-docs`, particionado `<organization_id>/<vehiculo_id>/<archivo>`
// (migración 20260724140000). El archivo NUNCA se sirve por URL pública: se pide
// una signed URL de vida corta cada vez que se abre.
//
// Un manual pertenece a la empresa que lo subió y no se comparte entre
// organizaciones: son documentos con copyright del fabricante. El aislamiento
// está en RLS (tabla y objetos), esto es sólo el cliente.

import { supabase } from '../lib/supabase'
import { genId } from './format'

// 30 MB, igual que el límite del bucket. Un manual de camión pesa, pero arriba
// de esto casi siempre es un escaneo sin comprimir del que además no se puede
// extraer texto.
export const LIMITE_MB = 30
export const BUCKET = 'vehiculo-docs'

export const TIPOS_DOC = [
  { id: 'ficha_tecnica', label: 'Ficha técnica / folleto de especificaciones' },
  { id: 'manual',        label: 'Manual del operador' },
  { id: 'otro',          label: 'Otro documento' },
]

// El aviso más útil de toda esta pantalla: el manual del operador (el del
// guantera) casi nunca trae el consumo. Ese dato está en la ficha técnica
// comercial o el folleto de especificaciones. Vale decirlo ANTES de que alguien
// suba 40 MB al pedo.
export const AVISO_QUE_SUBIR =
  'El manual del operador casi nunca trae el consumo: ese dato suele estar en la ' +
  'ficha técnica comercial o el folleto de especificaciones del modelo. Si tenés ' +
  'los dos, subí primero la ficha técnica.'

// ¿Está aplicada la migración? 42P01 = tabla inexistente → false definitivo.
// Otros errores no son concluyentes: false SIN cachear, para reintentar.
let _check = null
export function docsDisponible() {
  if (!_check) {
    _check = supabase.from('vehiculo_docs').select('id').limit(1).then(({ error }) => {
      if (!error) return true
      if (error.code === '42P01') return false
      _check = null
      return false
    }).catch(() => { _check = null; return false })
  }
  return _check
}

export async function listarDocs(vehiculoId) {
  if (!vehiculoId) return []
  const { data, error } = await supabase
    .from('vehiculo_docs')
    .select('*')
    .eq('vehiculo_id', vehiculoId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data || []
}

// Nombre de archivo seguro para el path del bucket: sin tildes, espacios ni
// caracteres raros (Storage los acepta pero después la signed URL es un
// desastre de leer y algunos rompen el path).
function slug(nombre) {
  return (nombre || 'documento.pdf')
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(-80)
}

export function validarArchivo(file) {
  if (!file) return 'Elegí un archivo.'
  const esPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!esPdf) return 'Por ahora sólo se aceptan PDF.'
  if (file.size > LIMITE_MB * 1024 * 1024) {
    return `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${LIMITE_MB} MB. ` +
           'Si es un escaneo, exportalo comprimido o subí sólo las páginas de especificaciones.'
  }
  return null
}

// Sube el PDF y registra la fila. Si el insert de metadatos falla, se borra el
// objeto: un archivo sin fila queda invisible para siempre y ocupando lugar.
export async function subirDoc({ file, vehiculoId, organizationId, tipo = 'ficha_tecnica', notas = '' }) {
  const problema = validarArchivo(file)
  if (problema) return { error: problema }
  if (!organizationId || !vehiculoId) return { error: 'Falta la unidad o la empresa.' }

  const id = genId()
  const path = `${organizationId}/${vehiculoId}/${id}-${slug(file.name)}`

  const { error: errUp } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (errUp) return { error: errUp.message || 'No se pudo subir el archivo.' }

  const fila = {
    id, organization_id: organizationId, vehiculo_id: vehiculoId,
    tipo, nombre: file.name, storage_path: path,
    tamano_bytes: String(file.size), notas,
  }
  const { error: errIns } = await supabase.from('vehiculo_docs').insert(fila)
  if (errIns) {
    await supabase.storage.from(BUCKET).remove([path])
    return { error: 'Se subió el archivo pero no se pudo registrar. No quedó nada guardado.' }
  }
  return { doc: fila }
}

// URL firmada de vida corta para abrir o previsualizar el PDF.
export async function urlFirmada(storagePath, segundos = 300) {
  if (!storagePath) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, segundos)
  if (error) return null
  return data?.signedUrl || null
}

// Borra primero la fila y después el objeto: al revés, si falla el delete de la
// fila queda un registro apuntando a un archivo que ya no está.
export async function borrarDoc(doc) {
  const { error } = await supabase.from('vehiculo_docs').delete().eq('id', doc.id)
  if (error) return { error: 'No se pudo borrar el documento.' }
  await supabase.storage.from(BUCKET).remove([doc.storage_path])
  return {}
}

export const fmtTamano = (bytes) => {
  const n = parseFloat(bytes)
  if (!Number.isFinite(n) || n <= 0) return ''
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`
}
