// src/utils/chequeoVencimientos.js
//
// Motor de notificaciones de vencimientos y datos obligatorios de la flota.
// Dos responsabilidades:
//   1) VENCIMIENTOS: avisa cuando VTV / seguro / habilitación / próximo service
//      están por vencer o vencidos (escala 30d → 7d → vencido).
//   2) DATOS OBLIGATORIOS: si falta cargar una fecha/dato clave, insiste con una
//      notificación de "acción requerida" que reaparece hasta que se complete.
//
// Escanea los datos ya cargados en el store; no consulta la base salvo para
// deduplicar/insistir. Configurable por cliente vía CONFIG_VENCIMIENTOS.

import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'
import { crearNotificacion } from './crearNotificacion'
import { daysDiff, formatDate, todayISO } from './format'

// ── Configuración (editable por cliente) ─────────────────────────────────────
export const CONFIG_VENCIMIENTOS = {
  // Días antes del vencimiento en que empieza a avisar (ventana de aviso).
  diasAviso: 30,
  // Km restantes para el próximo service a partir de los cuales avisa.
  kmAviso: 1000,
  // Campos de tipo fecha del vehículo. `obligatorio: true` → el sistema insiste
  // si está vacío. Para sumar uno nuevo (ej: 'ruta', 'matafuegos'), agregalo acá.
  campos: [
    { campo: 'vtv',          label: 'VTV',                     obligatorio: true },
    { campo: 'seguro',       label: 'Seguro',                  obligatorio: true },
    { campo: 'habilitacion', label: 'Habilitación municipal',  obligatorio: true },
  ],
  // Exigir que cada vehículo tenga un próximo service programado (fecha o km).
  exigirProximoService: true,
}

const LS_FIRMA    = 'vanderbus_venc_firma'
const LS_REINSIST = 'vanderbus_accion_reinsist'

const nombreVehiculo = (v) =>
  v?.alias || v?.patente || [v?.marca, v?.modelo].filter(Boolean).join(' ') || 'Vehículo'

// ── Datos obligatorios ───────────────────────────────────────────────────────

// ¿El vehículo tiene un próximo service programado (por fecha o por km)?
function tieneProximoService(v, mantenimiento) {
  return (mantenimiento || []).some((m) =>
    m.vehiculo_id === v.id && (m.proximo_fecha || parseFloat(m.proximo_km) > 0)
  )
}

// Lista de etiquetas de datos obligatorios que le faltan a un vehículo.
// Exportada: la usa la tarjeta de la Flota para el indicador ámbar.
export function faltantesVehiculo(v, mantenimiento = []) {
  const faltan = []
  for (const { campo, label, obligatorio } of CONFIG_VENCIMIENTOS.campos) {
    if (obligatorio && !v[campo]) faltan.push(label)
  }
  if (CONFIG_VENCIMIENTOS.exigirProximoService && !tieneProximoService(v, mantenimiento)) {
    faltan.push('Próximo service')
  }
  return faltan
}

// ── Firma anti-reproceso ─────────────────────────────────────────────────────
// Día actual + campos relevantes. Cambia al editar/agregar datos (re-chequea al
// toque) o al pasar un día (permite escalar el aviso). Si no cambió, se saltea:
// evita re-consultar la base en cada refresco de 30s del store.
function firma(data) {
  const veh = (data?.vehiculos || [])
    .filter((v) => v.activo !== false)
    .map((v) => `${v.id}:${v.vtv || ''}:${v.seguro || ''}:${v.habilitacion || ''}:${v.kilometraje || ''}`)
  const mant = (data?.mantenimiento || [])
    .map((m) => `${m.id}:${m.vehiculo_id || ''}:${m.proximo_fecha || ''}:${m.proximo_km || ''}`)
  return `${todayISO()}|${veh.join(',')}|${mant.join(',')}`
}

// Estado de un vencimiento según los días restantes (null = fuera de ventana).
function estadoPorDias(dias) {
  if (dias == null) return null
  if (dias < 0)  return { label: 'Vencido',           prioridad: 'alta'   }
  if (dias <= 7) return { label: 'Vence esta semana', prioridad: 'alta'   }
  if (dias <= CONFIG_VENCIMIENTOS.diasAviso)
                 return { label: 'Vence pronto',      prioridad: 'normal' }
  return null
}

// Construye una notificación de vencimiento. El título es determinístico e
// incluye estado + concepto + vehículo + fecha, de modo que:
//  - re-correr el chequeo no duplica (mismo título → se saltea),
//  - al acercarse el vencimiento cambia el estado → nueva notificación (escala),
//  - al renovar (cambia la fecha) → nueva notificación (nuevo ciclo).
function armarNotif({ tipo, estado, concepto, entidad, fecha, mensaje, link }) {
  const sufijo = fecha ? ` (${formatDate(fecha)})` : ''
  return {
    tipo,
    prioridad: estado.prioridad,
    titulo: `${estado.label}: ${concepto} · ${entidad}${sufijo}`,
    mensaje,
    link,
  }
}

// ── Recolección de vencimientos ──────────────────────────────────────────────
function recolectarVencimientos(data) {
  const items = []
  const vehiculos = (data?.vehiculos || []).filter((v) => v.activo !== false)

  // 1) Documentación del vehículo (VTV, seguro, habilitación, ...).
  for (const v of vehiculos) {
    const entidad = nombreVehiculo(v)
    for (const { campo, label } of CONFIG_VENCIMIENTOS.campos) {
      const fecha = v[campo]
      if (!fecha) continue
      const dias = daysDiff(fecha)
      const estado = estadoPorDias(dias)
      if (!estado) continue
      const cuando =
        dias < 0 ? `venció hace ${Math.abs(dias)} días`
        : dias === 0 ? 'vence hoy'
        : `vence en ${dias} días`
      items.push(armarNotif({
        tipo: 'vencimiento',
        estado, concepto: label, entidad, fecha,
        mensaje: `${label} de ${entidad} ${cuando} (${formatDate(fecha)}).`,
        link: 'vehiculo',
      }))
    }
  }

  // 2) Mantenimiento: próximo service por fecha y/o por km (aceite, filtros...).
  for (const m of (data?.mantenimiento || [])) {
    const veh = vehiculos.find((x) => x.id === m.vehiculo_id)
    const entidad = veh ? nombreVehiculo(veh) : (m.descripcion || 'Mantenimiento')
    const concepto = m.categoria || 'Service'

    if (m.proximo_fecha) {
      const dias = daysDiff(m.proximo_fecha)
      const estado = estadoPorDias(dias)
      if (estado) {
        const cuando =
          dias < 0 ? `atrasado hace ${Math.abs(dias)} días`
          : dias === 0 ? 'hoy'
          : `en ${dias} días`
        items.push(armarNotif({
          tipo: 'mantenimiento',
          estado, concepto: `Próximo ${concepto}`, entidad, fecha: m.proximo_fecha,
          mensaje: `Próximo ${concepto.toLowerCase()} de ${entidad} ${cuando} (${formatDate(m.proximo_fecha)}).`,
          link: 'mantenimiento',
        }))
      }
    }

    const proxKm = parseFloat(m.proximo_km)
    const kmActual = parseFloat(veh?.kilometraje)
    if (Number.isFinite(proxKm) && proxKm > 0 && Number.isFinite(kmActual)) {
      const restan = proxKm - kmActual
      if (restan <= CONFIG_VENCIMIENTOS.kmAviso) {
        const estado = restan <= 0
          ? { label: 'Service atrasado', prioridad: 'alta' }
          : { label: 'Service próximo',  prioridad: 'normal' }
        items.push({
          tipo: 'mantenimiento',
          prioridad: estado.prioridad,
          titulo: `${estado.label}: ${concepto} · ${entidad} (${proxKm.toLocaleString('es-AR')} km)`,
          mensaje: restan <= 0
            ? `${concepto} de ${entidad} pasado por ${Math.abs(restan).toLocaleString('es-AR')} km (objetivo ${proxKm.toLocaleString('es-AR')} km).`
            : `${concepto} de ${entidad} en ${restan.toLocaleString('es-AR')} km (objetivo ${proxKm.toLocaleString('es-AR')} km).`,
          link: 'mantenimiento',
        })
      }
    }
  }

  return items
}

// ── Recolección de datos obligatorios faltantes ──────────────────────────────
function recolectarObligatorios(data) {
  const vehiculos = (data?.vehiculos || []).filter((v) => v.activo !== false)
  const mant = data?.mantenimiento || []
  const items = []
  for (const v of vehiculos) {
    const faltan = faltantesVehiculo(v, mant)
    if (faltan.length === 0) continue
    const entidad = nombreVehiculo(v)
    items.push({
      tipo: 'accion',
      prioridad: 'alta',
      // Título estable por vehículo → una sola notif de acción por vehículo.
      titulo: `Datos obligatorios sin cargar · ${entidad}`,
      mensaje: `Cargá ${faltan.join(', ')} de ${entidad} para poder avisarte a tiempo de sus vencimientos.`,
      link: 'vehiculo',
    })
  }
  return items
}

// ── Vencimientos: crear los nuevos (dedup por título) ────────────────────────
async function procesarVencimientos(items) {
  if (items.length === 0) return
  const { data: existentes } = await supabase
    .from('notificaciones')
    .select('titulo')
    .in('tipo', ['vencimiento', 'mantenimiento'])
    .order('created_at', { ascending: false })
    .limit(300)
  const yaExisten = new Set((existentes || []).map((n) => n.titulo))

  for (const it of items) {
    if (yaExisten.has(it.titulo)) continue
    yaExisten.add(it.titulo) // evita duplicar dentro del mismo lote
    await crearNotificacion(it)
  }
}

// ── Acción requerida: crear, re-insistir (1×/día) y auto-resolver ────────────
async function procesarObligatorios(items) {
  const { data: prev } = await supabase
    .from('notificaciones')
    .select('id, titulo, leida, mensaje')
    .eq('tipo', 'accion')
    .limit(300)
  const previas = prev || []
  const prevByTitulo = new Map(previas.map((n) => [n.titulo, n]))
  const vigentes = new Set(items.map((i) => i.titulo))

  const hoy = todayISO()
  const yaReinsistioHoy = localStorage.getItem(LS_REINSIST) === hoy

  // Crear nuevas / refrescar detalle / re-insistir (marcar no leída 1 vez al día).
  for (const it of items) {
    const p = prevByTitulo.get(it.titulo)
    if (!p) { await crearNotificacion(it); continue }
    const patch = {}
    if (p.mensaje !== it.mensaje) patch.mensaje = it.mensaje         // mantener detalle al día
    if (p.leida && !yaReinsistioHoy) patch.leida = false            // volver a insistir
    if (Object.keys(patch).length) {
      await supabase.from('notificaciones').update(patch).eq('id', p.id)
    }
  }

  // Auto-resolver: acción ya cumplida (dato cargado) → marcar leída, limpia badge.
  for (const p of previas) {
    if (!vigentes.has(p.titulo) && !p.leida) {
      await supabase.from('notificaciones').update({ leida: true }).eq('id', p.id)
    }
  }

  localStorage.setItem(LS_REINSIST, hoy)
}

// Chequeo completo. Throttleado por firma (contenido + día). `{ force: true }`
// salta el throttle (útil para pruebas).
export async function chequearVencimientos(data, { force = false } = {}) {
  const sig = firma(data)
  if (!force && localStorage.getItem(LS_FIRMA) === sig) return
  localStorage.setItem(LS_FIRMA, sig)

  await procesarVencimientos(recolectarVencimientos(data))
  await procesarObligatorios(recolectarObligatorios(data))
}

// Hook: engancha el chequeo al ciclo de vida de la app. Corre cuando el store
// terminó de cargar; el throttle interno evita reprocesar de más.
export function useChequeoVencimientos() {
  const { data, loading } = useStore()
  useEffect(() => {
    if (loading) return
    chequearVencimientos(data)
  }, [loading, data])
}
