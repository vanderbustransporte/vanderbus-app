// Datos de despacho de un viaje (Fase B del plan de producto): la carga, el
// chofer/unidad y la custodia que se informan entre empresas antes del viaje.
//
// Los campos viven como columnas text en `viajes` (migración 20260718120000).
// Hasta que esa migración se aplique, `despachoDisponible()` devuelve false y
// Viajes NO manda estos campos al guardar: un INSERT/UPDATE con una columna
// inexistente falla ENTERO en Postgres y el viaje se perdería (mismo patrón
// que el bug del uuid '').

import { supabase } from '../lib/supabase'
import { formatDate, formatARS } from './format'
import { formatHora } from './hora'

export const CARGA_TIPOS = ['General', 'Pallets', 'Granel', 'Contenedor', 'Refrigerada', 'Peligrosa', 'Vacío']
export const CUSTODIA_TIPOS = ['Satelital', 'Física', 'Satelital + física']

export const CAMPOS_DESPACHO = [
  'referencia', 'destinatario',
  'carga_tipo', 'carga_bultos', 'carga_peso_kg', 'carga_volumen_m3', 'carga_valor',
  'chofer_nombre', 'chofer_dni', 'chofer_cel', 'patente_semi',
  'custodia_tipo', 'custodia_empresa', 'custodia_contacto',
  'satelital_empresa', 'satelital_equipo', 'precintos',
]

export const emptyDespacho = () => Object.fromEntries(CAMPOS_DESPACHO.map(k => [k, '']))

// ¿Está aplicada la migración de despacho? Se consulta UNA vez por sesión
// (promesa cacheada a nivel módulo). 42703 = columna inexistente → false
// definitivo. Otros errores (red, sesión) no son concluyentes: se devuelve
// false pero SIN cachear, para reintentar en el próximo montaje.
let _check = null
export function despachoDisponible() {
  if (!_check) {
    _check = supabase.from('viajes').select('carga_tipo').limit(1).then(({ error }) => {
      if (!error) return true
      if (error.code === '42703') return false
      _check = null
      return false
    })
  }
  return _check
}

// Texto plano de la ficha (WhatsApp / mail / imprimir). Sólo líneas con datos:
// una ficha de un viaje sin custodia no muestra la sección SEGURIDAD.
export function armarFichaDespacho(v, vehiculo) {
  const linea = (label, val) => val ? `${label}: ${val}` : null
  const junta = (...partes) => partes.filter(Boolean).join(' · ')
  const num = x => { const n = parseFloat(x); return isNaN(n) ? x : n.toLocaleString('es-AR') }
  const bloque = (titulo, lineas) => {
    const f = lineas.filter(Boolean)
    return f.length ? `${titulo}\n${f.join('\n')}` : ''
  }

  const cabecera = [
    '🚚 FICHA DE DESPACHO',
    junta(linea('Fecha', formatDate(v.fecha)), v.hora ? `Salida ${formatHora(v.hora)} hs` : null),
    linea('Referencia', v.referencia),
    linea('Cliente / Dador', v.cliente),
    linea('Destinatario', v.destinatario),
    (v.origen || v.destino) ? `Ruta: ${v.origen || '¿?'} → ${v.destino || '¿?'}` : null,
  ].filter(Boolean).join('\n')

  const unidad = bloque('UNIDAD', [
    vehiculo ? linea('Vehículo', junta(vehiculo.alias || [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' '), vehiculo.patente)) : null,
    linea('Semi', v.patente_semi),
    v.chofer_nombre ? linea('Chofer', junta(v.chofer_nombre, v.chofer_dni ? `DNI ${v.chofer_dni}` : null, v.chofer_cel ? `Cel ${v.chofer_cel}` : null)) : null,
  ])

  const carga = bloque('CARGA', [
    junta(linea('Tipo', v.carga_tipo), linea('Bultos', v.carga_bultos)),
    junta(v.carga_peso_kg ? `Peso: ${num(v.carga_peso_kg)} kg` : null, v.carga_volumen_m3 ? `Volumen: ${num(v.carga_volumen_m3)} m³` : null),
    v.carga_valor ? `Valor declarado: ${formatARS(v.carga_valor)}` : null,
  ])

  const seguridad = bloque('SEGURIDAD', [
    v.custodia_tipo ? linea('Custodia', junta(v.custodia_tipo, v.custodia_empresa, v.custodia_contacto)) : null,
    (v.satelital_empresa || v.satelital_equipo)
      ? linea('Monitoreo satelital', junta(v.satelital_empresa, v.satelital_equipo ? `Equipo ${v.satelital_equipo}` : null))
      : null,
    linea('Precintos', v.precintos),
  ])

  return [cabecera, unidad, carga, seguridad, v.notas ? `Notas: ${v.notas}` : '']
    .filter(Boolean).join('\n\n')
}
