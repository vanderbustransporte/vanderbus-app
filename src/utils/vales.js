// Vales de combustible / cuenta corriente con estaciones de servicio.
//
// Una carga de combustible puede pagarse al CONTADO (el chofer/empresa paga en
// el momento) o con un VALE: el chofer carga con un papel y NO paga; la empresa
// lo arregla con la estación y lo rinde a fin de mes. Un vale nace 'Pendiente'
// (por rendir) y pasa a 'Pagado' cuando se registra el pago de la rendición.
//
// Las columnas viven en `combustible` (migración 20260722140000). Hasta que se
// aplique, `valesDisponible()` devuelve false y el módulo Combustible oculta la
// UI de vales y NO manda estas columnas al guardar (mismo patrón que
// despacho.js: un INSERT contra una columna inexistente falla entero).
//
// OJO: los vales son SOLO seguimiento de pago. NO generan un gasto espejo — el
// combustible ya cuenta como costo por sí mismo (Dashboard y Rentabilidad leen
// la tabla directo); duplicarlo contaría dos veces.

import { supabase } from '../lib/supabase'
import { fechaMes } from './fecha'
import { monthName } from './format'

export const FORMAS_PAGO  = ['Contado', 'Vale']
export const VALE_ESTADOS = ['Pendiente', 'Pagado']

// Columnas que agrega la migración. Se strippean del payload cuando la
// migración no está aplicada (igual que CAMPOS_DESPACHO en Viajes).
export const CAMPOS_VALE = [
  'forma_pago', 'vale_numero', 'vale_estado',
  'rendicion_id', 'rendicion_fecha', 'rendicion_comprobante',
]

// ¿Está aplicada la migración de vales? Promesa cacheada por sesión. 42703 =
// columna inexistente → false definitivo. Otros errores (red, sesión) no son
// concluyentes: false SIN cachear, para reintentar en el próximo montaje.
let _check = null
export function valesDisponible() {
  if (!_check) {
    _check = supabase.from('combustible').select('forma_pago').limit(1).then(({ error }) => {
      if (!error) return true
      if (error.code === '42703') return false
      _check = null
      return false
    })
  }
  return _check
}

const monto   = r => parseFloat(r.importe) || 0
const litros  = r => parseFloat(r.litros)  || 0

export const esVale        = r => r?.forma_pago === 'Vale'
// Un vale sin estado explícito se considera 'Pendiente' (por si quedó a medias).
export const valePendiente = r => esVale(r) && (r.vale_estado || 'Pendiente') === 'Pendiente'
export const valePagado    = r => esVale(r) && r.vale_estado === 'Pagado'

// Total que se le debe a las estaciones (suma de vales pendientes de rendir).
export const totalPorPagar = list => (list || []).reduce((s, r) => s + (valePendiente(r) ? monto(r) : 0), 0)

// Etiqueta legible de un mes 'YYYY-MM' → 'Marzo 2026'.
export function mesLabel(mesKey) {
  const [y, m] = String(mesKey || '').split('-')
  const mi = parseInt(m, 10) - 1
  if (Number.isNaN(mi) || mi < 0 || mi > 11) return mesKey || 'Sin fecha'
  return `${monthName(mi)} ${y}`
}

const estacionDe = r => (r.proveedor || '').trim() || 'Sin estación'

// Vales PENDIENTES agrupados por estación + mes → cada grupo es una "rendición
// por rendir" (lo que hay que conciliar y pagar a esa estación por ese mes).
export function rendicionesPendientes(list) {
  const map = new Map()
  for (const r of (list || [])) {
    if (!valePendiente(r)) continue
    const estacion = estacionDe(r)
    const mes = fechaMes(r.fecha) || 'sin-fecha'
    const key = `${estacion}||${mes}`
    if (!map.has(key)) map.set(key, { key, estacion, mes, vales: [], total: 0, litros: 0 })
    const g = map.get(key)
    g.vales.push(r); g.total += monto(r); g.litros += litros(r)
  }
  return [...map.values()].sort((a, b) =>
    (b.mes || '').localeCompare(a.mes || '') || a.estacion.localeCompare(b.estacion))
}

// Rendiciones YA pagadas, agrupadas por rendicion_id (el lote que se pagó junto).
export function rendicionesPagadas(list) {
  const map = new Map()
  for (const r of (list || [])) {
    if (!valePagado(r) || !r.rendicion_id) continue
    const key = r.rendicion_id
    if (!map.has(key)) map.set(key, {
      key, estacion: estacionDe(r),
      fecha: r.rendicion_fecha || '', comprobante: r.rendicion_comprobante || '',
      vales: [], total: 0, litros: 0,
    })
    const g = map.get(key)
    g.vales.push(r); g.total += monto(r); g.litros += litros(r)
  }
  return [...map.values()].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
}
