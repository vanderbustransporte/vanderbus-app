import React, { useMemo, useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'
import { formatARS, formatDate, monthName, todayISO, daysDiff } from '../utils/format'
import { toISO } from '../utils/fecha'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import {
  TrendingUp, TrendingDown, Fuel, Wrench, ArrowUpCircle, ArrowDownCircle,
  CalendarDays, CircleCheck, ArrowRight, Truck, CalendarClock, AlertTriangle,
} from 'lucide-react'
import { useChartTheme } from '../utils/chartTheme'
import { useNav } from '../hooks/useNav'
import { recolectarVencimientos } from '../utils/chequeoVencimientos'
import { formatHora, horaOrden } from '../utils/hora'

const numStyle = { fontVariantNumeric: 'tabular-nums' }
const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

// El módulo Viajes usa estos mismos colores por estado. Si cambian allá, cambiar acá.
const ESTADO_STYLES = {
  Pendiente:  { bg: 'var(--warning-dim)',  color: 'var(--warning)'  },
  Confirmado: { bg: 'var(--accent-dim)',   color: 'var(--accent)'   },
  Realizado:  { bg: 'var(--positive-dim)', color: 'var(--positive)' },
  Cancelado:  { bg: 'var(--danger-dim)',   color: 'var(--text-3)'   },
}
const ESTADO_FALLBACK = { bg: 'var(--bg-overlay)', color: 'var(--text-2)' }

// La agenda ordena por hora vía horaOrden() y NO por el string crudo de `hora`:
// la base mezcla '9:00:00 AM' (n8n) con '14:30' (formulario). Ver utils/hora.js.
// Los viajes sin hora caen al final del día.

const DIAS_AGENDA = 7

function etiquetaDia(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  if (!m) return iso || ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const dias = daysDiff(iso)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Mañana'
  const s = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' }).replace(',', '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function saludo() {
  const h = new Date().getHours()
  if (h < 13) return 'Buen día'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function EstadoChip({ estado }) {
  const s = ESTADO_STYLES[estado] || ESTADO_FALLBACK
  return (
    <span style={{
      background: s.bg, color: s.color, borderRadius: 9999,
      padding: '2px 9px', fontSize: 10, fontWeight: 700, flexShrink: 0,
    }}>
      {estado || '—'}
    </span>
  )
}

// ── Fila de viaje (panel Hoy) ────────────────────────────────────────────────
function ViajeRow({ viaje, vehiculo, onClick }) {
  const hora = formatHora(viaje.hora, '')
  return (
    <button onClick={onClick} className="db-row">
      {/* Columna de hora: es el dato que ordena el día, va primero y alineado. */}
      <span className="db-hora num" style={{ color: hora ? 'var(--text-1)' : 'var(--text-3)' }}>
        {hora || '—'}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', ...ellipsis }}>
            {viaje.cliente || 'Sin cliente'}
          </span>
          <EstadoChip estado={viaje.estado} />
        </div>
        <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--text-2)', ...ellipsis }}>
          <span style={ellipsis}>{viaje.origen || '—'}</span>
          <ArrowRight size={11} style={{ flexShrink: 0, color: 'var(--text-3)' }} />
          <span style={ellipsis}>{viaje.destino || '—'}</span>
        </div>
        {vehiculo && (
          <div className="flex items-center gap-1.5" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
            <Truck size={11} style={{ flexShrink: 0 }} />
            <span style={ellipsis}>{vehiculo}</span>
          </div>
        )}
      </div>
      {viaje.monto_total ? (
        <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', flexShrink: 0 }}>
          {formatARS(viaje.monto_total)}
        </span>
      ) : null}
    </button>
  )
}

// ── Fila de "Requiere atención" ──────────────────────────────────────────────
function AtencionRow({ item, onClick }) {
  const alta = item.prioridad === 'alta'
  const color = alta ? 'var(--danger)' : 'var(--warning)'
  return (
    <button onClick={onClick} className="db-row">
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: color,
        flexShrink: 0, marginTop: 6, alignSelf: 'flex-start',
      }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', ...ellipsis }}>
          {item.concepto} · {item.entidad}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', ...ellipsis }}>{item.detalle}</div>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, color, background: alta ? 'var(--danger-dim)' : 'var(--warning-dim)',
        borderRadius: 9999, padding: '2px 9px', flexShrink: 0,
      }}>
        {item.estado}
      </span>
    </button>
  )
}

function Vacio({ icon: Icon, children }) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ padding: '32px 16px', gap: 8 }}>
      <Icon size={22} style={{ color: 'var(--text-3)' }} />
      <span style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'center' }}>{children}</span>
    </div>
  )
}

function QuickBtn({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="db-quick">
      <Icon size={15} style={{ color: 'var(--accent)' }} />
      <span>{label}</span>
    </button>
  )
}

function TrendBadge({ actual, anterior }) {
  if (!anterior) return null
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100
  const up = pct >= 0
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 11px', borderRadius: 999,
      fontSize: 12, fontWeight: 700, marginTop: 12,
      letterSpacing: '-0.01em', ...numStyle,
      background: up ? 'var(--positive-dim)' : 'var(--danger-dim)',
      color: up ? 'var(--positive)' : 'var(--danger)',
      border: `1px solid ${up ? 'var(--positive-dim)' : 'var(--danger-dim)'}`,
    }}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

// NOTA: el "Gastos del mes" del Dashboard es INTENCIONALMENTE mas amplio que el de
// Finanzas. Finanzas solo suma el libro manual (tabla gastos + marketing); el Dashboard
// suma TODOS los costos operativos: gastos + combustible + mantenimiento + nomina.
// Por eso los dos numeros no coinciden y no deben coincidir. Esa definicion vive
// ahora en la rpc dashboard_resumen() (y en el fallback local de aca abajo).

const PIE_LABELS = { combustible: 'Combustible', mantenimiento: 'Mantenimiento', nomina: 'Nómina', otros: 'Otros' }

export default function Dashboard() {
  const onNav = useNav()
  const { data } = useStore()

  const hoy = todayISO()

  // ── Operativo: agenda de viajes ────────────────────────────────────────────
  // Mismo filtro que usa el módulo Viajes para descartar filas vacías.
  const viajes = useMemo(
    () => (data.viajes || []).filter(r => r.cliente || r.destino || r.origen),
    [data.viajes]
  )

  const nombreVeh = useMemo(() => {
    const m = new Map()
    for (const v of (data.vehiculos || [])) {
      m.set(v.id, v.alias || v.patente || [v.marca, v.modelo].filter(Boolean).join(' ') || 'Vehículo')
    }
    return m
  }, [data.vehiculos])

  const viajesHoy = useMemo(
    () => viajes
      .filter(v => toISO(v.fecha) === hoy && v.estado !== 'Cancelado')
      .sort((a, b) => horaOrden(a.hora) - horaOrden(b.hora)),
    [viajes, hoy]
  )

  // Agenda: próximos DIAS_AGENDA días (sin incluir hoy), agrupada por fecha.
  const agenda = useMemo(() => {
    const porFecha = new Map()
    for (const v of viajes) {
      if (v.estado === 'Cancelado') continue
      const f = toISO(v.fecha)
      const d = daysDiff(f)
      if (d == null || d <= 0 || d > DIAS_AGENDA) continue
      if (!porFecha.has(f)) porFecha.set(f, [])
      porFecha.get(f).push(v)
    }
    for (const vs of porFecha.values()) {
      vs.sort((a, b) => horaOrden(a.hora) - horaOrden(b.hora))
    }
    return [...porFecha.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [viajes])

  // ── Requiere atención ──────────────────────────────────────────────────────
  // Vencimientos: MISMA fuente que las notificaciones (recolectarVencimientos),
  // así el panel y la campanita no se pueden contradecir.
  const atencion = useMemo(() => {
    const items = recolectarVencimientos(data).map(v => ({
      prioridad: v.prioridad,
      estado: v.estado,
      concepto: v.concepto,
      entidad: v.entidad,
      detalle: v.fecha
        ? `Vence el ${formatDate(v.fecha)}`
        : Number.isFinite(v.km)
          ? (v.km <= 0
              ? `Pasado por ${Math.abs(v.km).toLocaleString('es-AR')} km`
              : `Faltan ${v.km.toLocaleString('es-AR')} km`)
          : '',
      // Urgencia: primero lo vencido/atrasado, después lo más cercano.
      orden: v.dias ?? (Number.isFinite(v.km) ? v.km / 100 : 999),
      link: v.link,
    }))

    // Viajes sin confirmar que salen dentro de la ventana de agenda: es la acción
    // administrativa más típica de la mañana (llamar al cliente y confirmar).
    for (const v of viajes) {
      if (v.estado !== 'Pendiente') continue
      const d = daysDiff(toISO(v.fecha))
      if (d == null || d < 0 || d > DIAS_AGENDA) continue
      const h = formatHora(v.hora, '')
      const cuando = d === 0 ? 'Sale hoy' : d === 1 ? 'Sale mañana' : `Sale en ${d} días`
      items.push({
        prioridad: d <= 1 ? 'alta' : 'normal',
        estado: 'Sin confirmar',
        concepto: 'Viaje',
        entidad: v.cliente || 'Sin cliente',
        detalle: `${cuando}${h ? ` ${h}` : ''} · ${v.origen || '—'} → ${v.destino || '—'}`,
        // Los viajes por salir pesan más que un vencimiento a 30 días; dentro del
        // mismo día, primero el que sale más temprano.
        orden: d - 100 + horaOrden(v.hora) / 10000,
        // Deep link a la fila exacta del viaje (useNav parsea 'modulo:registro').
        link: `viajes:${v.id}`,
      })
    }

    return items.sort((a, b) => {
      if (a.prioridad !== b.prioridad) return a.prioridad === 'alta' ? -1 : 1
      return a.orden - b.orden
    })
  }, [data, viajes])

  const atencionVisible = atencion.slice(0, 6)
  // La barra del panel sigue al item más grave: roja sólo si hay algo vencido o
  // que sale hoy/mañana. Si todo es "vence pronto", ámbar — no alarmar de más.
  const hayAlta = atencion.some(i => i.prioridad === 'alta')

  // ── Financiero (server-side, igual que antes) ──────────────────────────────
  const [resumenRpc, setResumenRpc] = useState(null)
  useEffect(() => {
    let vivo = true
    supabase.rpc('dashboard_resumen').then(({ data: r, error }) => {
      if (vivo && !error && r) setResumenRpc(r)
    })
    return () => { vivo = false }
  }, [data])

  const resumenLocal = useMemo(() => {
    const ingresos = data.ingresos || [], gastos = data.gastos || []
    const combustible = data.combustible || [], mantenimiento = data.mantenimiento || []
    const nomina = data.nomina || []
    const sum = (rows, key, campo = 'importe') =>
      rows.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r[campo]) || 0), 0)
    const ahora = new Date()
    const meses = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - 5 + i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return {
        mes: key,
        ingresos: sum(ingresos, key),
        gastos: sum(gastos, key) + sum(combustible, key) + sum(mantenimiento, key, 'costo') + sum(nomina, key),
      }
    })
    const mesActual = meses[5].mes
    return {
      meses,
      pie: {
        combustible: sum(combustible, mesActual),
        mantenimiento: sum(mantenimiento, mesActual, 'costo'),
        nomina: sum(nomina, mesActual),
        otros: sum(gastos, mesActual),
      },
    }
  }, [data])

  const resumen = resumenRpc ?? resumenLocal
  const meses = resumen.meses ?? []
  const act = meses[meses.length - 1] ?? { ingresos: 0, gastos: 0 }
  const ant = meses[meses.length - 2] ?? { ingresos: 0, gastos: 0 }
  const balance = act.ingresos - act.gastos
  const balancePasado = ant.ingresos - ant.gastos

  const barData = useMemo(() =>
    meses.map(m => ({
      mes: monthName(parseInt(m.mes.slice(5), 10) - 1),
      Ingresos: Number(m.ingresos) || 0,
      Gastos: Number(m.gastos) || 0,
    })),
    [meses])

  const pieData = useMemo(() =>
    Object.entries(PIE_LABELS)
      .map(([k, name]) => ({ name, value: Number(resumen.pie?.[k]) || 0 }))
      .filter(d => d.value > 0),
    [resumen])

  const fechaLargaRaw = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).replace(',', '')
  const fechaLarga = fechaLargaRaw.charAt(0).toUpperCase() + fechaLargaRaw.slice(1)

  const ct = useChartTheme()

  const totalAgenda = agenda.reduce((s, [, vs]) => s + vs.length, 0)

  return (
    <div className="max-w-[1680px] mx-auto w-full">

      {/* Encabezado */}
      <div className="db-in db-d0" style={{ marginBottom: 24 }}>
        <h1 className="mod-h1" style={{ fontSize: 32 }}>{saludo()}</h1>
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6, letterSpacing: '0.03em', ...numStyle }}>
          {fechaLarga}
        </p>
      </div>

      {/* ── Requiere atención ── */}
      {atencion.length > 0 && (
        <div className="surface db-in db-d1" style={{ marginBottom: 20, padding: '20px 22px', borderLeft: `3px solid ${hayAlta ? 'var(--danger)' : 'var(--warning)'}` }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <p className="db-slabel" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
              <AlertTriangle size={13} style={{ color: hayAlta ? 'var(--danger)' : 'var(--warning)' }} />
              Requiere atención
              <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>({atencion.length})</span>
            </p>
          </div>
          <div className="db-rows">
            {atencionVisible.map((it, i) => (
              <AtencionRow key={i} item={it} onClick={() => onNav(it.link)} />
            ))}
          </div>
          {atencion.length > atencionVisible.length && (
            <button
              onClick={() => onNav('notificaciones')}
              style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Ver {atencion.length - atencionVisible.length} más
            </button>
          )}
        </div>
      )}

      {/* ── Hoy + Agenda ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" style={{ marginBottom: 20 }}>

        {/* Hoy */}
        <div className="surface db-in db-d2" style={{ padding: '20px 22px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <p className="db-slabel" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
              <CalendarDays size={13} style={{ color: 'var(--accent)' }} />
              Viajes de hoy
              {viajesHoy.length > 0 && (
                <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>({viajesHoy.length})</span>
              )}
            </p>
            <button
              onClick={() => onNav('viajes')}
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Ver todos
            </button>
          </div>
          {viajesHoy.length > 0 ? (
            <div className="db-rows">
              {viajesHoy.map(v => (
                <ViajeRow
                  key={v.id}
                  viaje={v}
                  vehiculo={nombreVeh.get(v.vehiculo_id)}
                  onClick={() => onNav('viajes')}
                />
              ))}
            </div>
          ) : (
            <Vacio icon={CircleCheck}>Sin viajes programados para hoy.</Vacio>
          )}
        </div>

        {/* Próximos días */}
        <div className="surface db-in db-d3" style={{ padding: '20px 22px' }}>
          <p className="db-slabel" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
            <CalendarClock size={13} style={{ color: 'var(--accent)' }} />
            Próximos {DIAS_AGENDA} días
            {totalAgenda > 0 && (
              <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>({totalAgenda})</span>
            )}
          </p>
          {agenda.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {agenda.map(([fecha, vs]) => (
                <div key={fecha}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, letterSpacing: '0.03em' }}>
                    {etiquetaDia(fecha)}
                  </div>
                  <div className="db-rows">
                    {vs.map(v => (
                      <ViajeRow
                        key={v.id}
                        viaje={v}
                        vehiculo={nombreVeh.get(v.vehiculo_id)}
                        onClick={() => onNav('viajes')}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Vacio icon={CalendarClock}>Sin viajes en los próximos {DIAS_AGENDA} días.</Vacio>
          )}
        </div>
      </div>

      {/* ── Acceso rápido ── */}
      <div className="surface db-in db-d4" style={{ padding: '20px 22px', marginBottom: 28 }}>
        <p className="db-slabel">Acceso rápido</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <QuickBtn icon={ArrowUpCircle}   label="Nuevo ingreso"  onClick={() => onNav('finanzas')}      />
          <QuickBtn icon={ArrowDownCircle} label="Nuevo gasto"    onClick={() => onNav('finanzas')}      />
          <QuickBtn icon={Fuel}            label="Nueva carga"    onClick={() => onNav('combustible')}   />
          <QuickBtn icon={Wrench}          label="Mantenimiento"  onClick={() => onNav('mantenimiento')} />
        </div>
      </div>

      {/* ── Finanzas del mes (secundario) ── */}
      <div className="db-in db-d5" style={{ marginBottom: 14 }}>
        <p className="db-slabel" style={{ marginBottom: 0 }}>Finanzas del mes</p>
      </div>

      <div className="surface db-in db-d5" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
        <div className="grid grid-cols-1 sm:grid-cols-3">

          <div style={{ padding: '22px 26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <ArrowUpCircle size={15} style={{ color: 'var(--positive)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)' }}>
                Ingresos del mes
              </span>
            </div>
            <div style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', fontWeight: 700, lineHeight: 1, color: 'var(--positive)', ...numStyle, letterSpacing: '-0.02em' }}>
              {formatARS(act.ingresos)}
            </div>
            <TrendBadge actual={act.ingresos} anterior={ant.ingresos} />
          </div>

          <div className="border-t sm:border-t-0 sm:border-l" style={{ padding: '22px 26px', borderColor: 'var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <ArrowDownCircle size={15} style={{ color: 'var(--danger)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)' }}>
                Gastos del mes
              </span>
            </div>
            <div style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', fontWeight: 700, lineHeight: 1, color: 'var(--danger)', ...numStyle, letterSpacing: '-0.02em' }}>
              {formatARS(act.gastos)}
            </div>
            <TrendBadge actual={act.gastos} anterior={ant.gastos} />
          </div>

          <div className="border-t sm:border-t-0 sm:border-l" style={{ padding: '22px 26px', borderColor: 'var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {balance >= 0
                ? <TrendingUp size={15} style={{ color: 'var(--positive)' }} />
                : <TrendingDown size={15} style={{ color: 'var(--danger)' }} />}
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)' }}>
                Balance neto
              </span>
            </div>
            <div style={{ fontSize: 'clamp(24px, 2.8vw, 34px)', fontWeight: 800, lineHeight: 1, color: balance >= 0 ? 'var(--positive)' : 'var(--danger)', ...numStyle, letterSpacing: '-0.02em' }}>
              {formatARS(balance)}
            </div>
            <TrendBadge actual={balance} anterior={balancePasado} />
          </div>

        </div>
      </div>

      {/* Graficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        <div className="lg:col-span-2 surface db-in db-d6" style={{ padding: 26 }}>
          <p className="db-slabel">Ingresos vs Gastos · últimos 6 meses</p>
          {barData.some(d => d.Ingresos > 0 || d.Gastos > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} barCategoryGap="32%" barGap={3}>
                <XAxis
                  dataKey="mes"
                  tick={{ fill: ct.tickColor, fontSize: 12, ...numStyle }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fill: ct.tickColor, fontSize: 11, ...numStyle }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip {...ct.tooltip} cursor={{ fill: ct.cursorFill }} />
                <Legend wrapperStyle={{ color: ct.tickColor, fontSize: 12, fontWeight: 600 }} />
                <Bar dataKey="Ingresos" fill={ct.positive} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gastos"   fill={ct.danger}   radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="db-empty">Sin datos para mostrar</div>
          )}
        </div>

        <div className="surface db-in db-d7" style={{ padding: 26 }}>
          <p className="db-slabel">Distribución de gastos</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={76} paddingAngle={4} dataKey="value" strokeWidth={0}>
                  {pieData.map((_, i) => <Cell key={i} fill={ct.categorical[i % ct.categorical.length]} />)}
                </Pie>
                <Tooltip formatter={v => formatARS(v)} {...ct.tooltip} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ color: ct.tickColor, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="db-empty">Sin datos del mes</div>
          )}
        </div>
      </div>
    </div>
  )
}
