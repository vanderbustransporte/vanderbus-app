// Catálogo de referencia GLOBAL de fichas técnicas (tabla `vehiculos_referencia`,
// migración 20260727120000).
//
// Es la fuente de datos con la que el usuario prellena la ficha de SU unidad
// eligiendo marca → modelo → año → versión, sin llamar a ninguna API. Los datos
// son curados y traen trazabilidad (de dónde salieron, si están verificados).
//
// ── Fallback sin romper ──────────────────────────────────────────────────────
// Hasta que la migración esté aplicada Y la tabla sembrada, la app sigue usando
// el catálogo hardcodeado src/data/motores.js exactamente como hasta hoy. La
// detección es por 42P01 (tabla inexistente), mismo patrón que docsVehiculo.js y
// consumo.js. `fuenteCatalogo()` le dice a la UI cuál de las dos fuentes usar; la
// UI no tiene que saber nada más.
//
// IMPORTANTE: este módulo es SÓLO lectura. La tabla es de escritura para
// service_role (ver la migración): el cliente nunca inserta acá. Si el vehículo
// no está en la referencia, sus specs van a la ficha per-tenant (`vehiculos`),
// no a esta tabla.

import { supabase } from '../lib/supabase'

export const TABLA = 'vehiculos_referencia'

// ── Detección de esquema ─────────────────────────────────────────────────────
// 42P01 = tabla inexistente → false definitivo (cacheado). Cualquier otro error
// (red, sesión) no es concluyente: false SIN cachear, para reintentar en el
// próximo montaje. Mismo criterio que docsDisponible() / consumoDisponible().
let _check = null
export function referenciaDisponible() {
  if (!_check) {
    _check = supabase.from(TABLA).select('id').limit(1).then(({ error }) => {
      if (!error) return true
      if (error.code === '42P01') return false
      _check = null
      return false
    }).catch(() => { _check = null; return false })
  }
  return _check
}

// ── ¿La tabla existe Y tiene datos? ──────────────────────────────────────────
// referenciaDisponible() sólo dice si la tabla EXISTE (42P01). Pero una tabla
// aplicada pero SIN SEMBRAR es tan inútil para la UI como una ausente: la cascada
// saldría con listas vacías. El criterio de fallback que pidió el producto es
// "si la tabla está vacía la app sigue con motores.js", así que acá exigimos al
// menos una fila. Cacheado igual que referenciaDisponible: un true es estable
// (nadie borra la siembra en vivo); un false por error de red no se cachea, para
// reintentar en el próximo montaje.
let _hayDatos = null
export function hayReferencia() {
  if (!_hayDatos) {
    _hayDatos = supabase.from(TABLA).select('id').limit(1).then(({ data, error }) => {
      if (error) { if (error.code !== '42P01') _hayDatos = null; return false }
      return (data?.length ?? 0) > 0
    }).catch(() => { _hayDatos = null; return false })
  }
  return _hayDatos
}

// Qué fuente de catálogo usar. La UI (paso 2) ramifica con esto:
//   'referencia' → cascada marca→modelo→año→versión desde la tabla
//   'legacy'     → lista plana de src/data/motores.js, como hasta hoy
// Nota: alcanza con hayReferencia() (implica que la tabla existe): tabla ausente
// o vacía → 'legacy', que es exactamente el comportamiento de producción hoy
// (migración sin aplicar, sin sembrar) — la cascada queda dormida hasta la siembra.
export async function fuenteCatalogo() {
  return (await hayReferencia()) ? 'referencia' : 'legacy'
}

// ── Listas encadenadas (cada nivel filtra por lo elegido en el anterior) ─────
//
// Se filtra por los valores de DISPLAY exactos, no por los normalizados: cada
// nivel recibe strings que salieron de esta misma tabla en el nivel anterior, así
// que el match exacto es correcto y no hace falta replicar normalizar_ref en JS.
// La normalización vive en la base sólo para deduplicar al sembrar.
//
// Postgres devuelve las filas; el DISTINCT y el orden se hacen en JS (el volumen
// de un catálogo de modelos es chico). Ante cualquier error → [] (la UI muestra
// vacío, no rompe).

async function distinct(columna, filtros = {}, orden = 'asc') {
  let q = supabase.from(TABLA).select(columna)
  for (const [k, v] of Object.entries(filtros)) q = q.eq(k, v)
  const { data, error } = await q
  if (error || !data) return []
  const vistos = [...new Set(data.map(r => r[columna]).filter(v => v !== null && v !== ''))]
  vistos.sort((a, b) => typeof a === 'number' ? a - b : String(a).localeCompare(String(b), 'es'))
  return orden === 'desc' ? vistos.reverse() : vistos
}

export const listarMarcas   = ()                      => distinct('marca')
export const listarModelos  = (marca)                 => distinct('modelo', { marca })
// Los años, del más nuevo al más viejo (lo que se busca casi siempre es lo reciente).
export const listarAnios    = (marca, modelo)         => distinct('anio', { marca, modelo }, 'desc')
export const listarVersiones = (marca, modelo, anio)  => distinct('version', { marca, modelo, anio })

// ── Ficha puntual ────────────────────────────────────────────────────────────
// La fila completa para un (marca, modelo, año, versión). Devuelve null si no
// está o si hay error. maybeSingle: 0 filas no es un error.
export async function obtenerFicha({ marca, modelo, anio, version }) {
  const { data, error } = await supabase.from(TABLA)
    .select('*')
    .eq('marca', marca).eq('modelo', modelo).eq('anio', anio).eq('version', version)
    .maybeSingle()
  if (error) return null
  return data || null
}

// ── Mapeo referencia → campos de la ficha del vehículo ──────────────────────
//
// Traduce una fila de `vehiculos_referencia` a los campos que el form de Flota
// escribe en `vehiculos`. Espeja specsDesdeMotor(data/motores.js): mismos nombres
// de campo, y devuelve STRINGS porque así viven las columnas de `vehiculos`
// (legado text). Lo que quede guardado es lo que el usuario deje en el form; esto
// sólo PRECARGA (y sigue editable), mostrando la fuente al lado.
//
// `fichaExt` = ¿está aplicada la migración 20260724130000? Sin ella los campos
// extendidos no existen en `vehiculos` y NO hay que meterlos en el form.

const s = x => (x === null || x === undefined) ? '' : String(x)

export function specsDesdeReferencia(row, { fichaExt = false } = {}) {
  if (!row) return {}
  const base = {
    motor_desc:          s(row.motor),
    consumo_urbano_l100: s(row.consumo_urbano_l100),
    consumo_ruta_l100:   s(row.consumo_ruta_l100),
    tara_kg:             s(row.tara_kg),
    carga_max_kg:        s(row.carga_util_kg),
  }
  if (!fichaExt) return base
  return {
    ...base,
    clase:              s(row.clase),
    motor_cilindrada_l: s(row.cilindrada_l),
    motor_combustible:  s(row.tipo_combustible),
    consumo_mixto_l100: s(row.consumo_mixto_l100),
    fuente_consumo:     s(row.fuente_consumo),
    carroceria:         s(row.carroceria),
    tanque_l:           s(row.capacidad_tanque_l),
    pbt_kg:             s(row.pbt_kg),   // pbt REAL de la ficha, no tara+carga
  }
}

// Resumen de trazabilidad para mostrar al lado del prellenado (paso 2, UI).
// La UI usa `verificado` para marcar visualmente los datos sin doble check.
export function trazabilidad(row) {
  if (!row) return null
  return {
    fuente:      row.fuente || null,
    fuenteUrl:   row.fuente_url || null,
    pagina:      row.pagina || null,
    extraidoPor: row.extraido_por || 'humano',
    verificado:  row.verificado === true,
    verificadoPor: row.verificado_por || null,
    fecha:       row.fecha_extraccion || null,
    notas:       row.notas || null,
  }
}
