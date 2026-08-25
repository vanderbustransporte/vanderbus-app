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

// ── Catálogo completo, para el buscador de texto libre ──────────────────────
//
// (rediseño 2026-08-25) Reemplaza a la cascada marca→modelo→año→versión: en vez
// de 3 round trips encadenados para llegar a UNA fila, se trae la tabla entera
// de una vez (el volumen de un catálogo de modelos es chico) y el filtrado lo
// hace el `<datalist>` nativo del navegador en el cliente. Cacheado igual que
// hayReferencia(): un resultado con filas es estable durante la sesión (nadie
// resiembra en vivo); un error de red no se cachea, para reintentar.
let _fichas = null
export function listarFichas() {
  if (!_fichas) {
    _fichas = supabase.from(TABLA).select('*').then(({ data, error }) => {
      if (error) { _fichas = null; return [] }
      return data || []
    }).catch(() => { _fichas = null; return [] })
  }
  return _fichas
}

// Etiqueta única por fila para el datalist: "Marca Modelo Año — Versión".
// marca+modelo+año+versión es justamente la clave única de la tabla, así que
// dos filas nunca producen la misma etiqueta.
export const etiquetaFicha = (row) => `${row.marca} ${row.modelo} ${row.anio} — ${row.version}`

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
