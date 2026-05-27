import React, { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatARS, formatDate, monthName } from '../utils/format'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, TrendingDown, Fuel, Wrench, DollarSign, Truck, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

const CHART_COLORS = ['#22D3EE', '#34D399', '#A78BFA', '#F87171', '#FBBF24', '#60A5FA']
const MONO = "'Geist Mono', monospace"

function TrendBadge({ actual, anterior }) {
  if (!anterior) return null
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100
  const up = pct >= 0
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, marginTop: 10,
      fontFamily: MONO, letterSpacing: '-0.01em',
      background: up ? 'var(--positive-dim)' : 'var(--danger-dim)',
      color: up ? 'var(--positive)' : 'var(--danger)',
      border: `1px solid ${up ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)'}`,
    }}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function StatCard({ icon: Icon, label, value, sub, color, delay = 0 }) {
  return (
    <div
      className={`surface surface-hover db-in db-d${delay}`}
      style={{ position: 'relative', overflow: 'hidden', padding: '20px 20px 20px 24px' }}
    >
      <div style={{ position: 'absolute', top: 14, bottom: 14, left: 0, width: 3, borderRadius: '0 3px 3px 0', background: color, opacity: 0.7 }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: `${color}18`, border: `1px solid ${color}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} style={{ color }} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: 4 }}>
            {label}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value}
          </div>
          {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{sub}</div>}
        </div>
      </div>
    </div>
  )
}

function QuickBtn({ icon: Icon, label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 text-sm font-semibold"
      style={{ padding: '10px 18px', borderRadius: 'var(--radius)', background: `${color}18`, border: '1px solid rgba(255,255,255,0.07)', color: '#f1f5f9', cursor: 'pointer' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
    >
      <Icon size={14} style={{ color }} />
      <span>{label}</span>
    </button>
  )
}

const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#27272a', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 8, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
      <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7, marginTop: 0 }}>
        {label}
      </p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color, fontSize: 12, fontWeight: 700, fontFamily: MONO, margin: '3px 0 0' }}>
          {p.name}: {formatARS(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard({ onNav }) {
  const { data } = useStore()
  const ingresos      = data.ingresos      || []
  const gastos        = data.gastos        || []
  const combustible   = data.combustible   || []
  const mantenimiento = data.mantenimiento || []
  const nomina        = data.nomina        || []
  const vehiculo      = data.vehiculo      || {}

  const now       = new Date()
  const mesActual = now.toISOString().slice(0, 7)
  const prevDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const mesPasado = prevDate.toISOString().slice(0, 7)

  const totalIngresosMes = useMemo(() =>
    ingresos.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0),
    [ingresos, mesActual])

  const totalIngresosMesPasado = useMemo(() =>
    ingresos.filter(r => r.fecha?.startsWith(mesPasado)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0),
    [ingresos, mesPasado])

  const totalGastosMes = useMemo(() => {
    const gBase = gastos.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    const gComb = combustible.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.total)   || 0), 0)
    const gMant = mantenimiento.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.costo)  || 0), 0)
    const gNom  = nomina.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    return gBase + gComb + gMant + gNom
  }, [gastos, combustible, mantenimiento, nomina, mesActual])

  const totalGastosMesPasado = useMemo(() => {
    const gBase = gastos.filter(r => r.fecha?.startsWith(mesPasado)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    const gComb = combustible.filter(r => r.fecha?.startsWith(mesPasado)).reduce((s, r) => s + (parseFloat(r.total)   || 0), 0)
    const gMant = mantenimiento.filter(r => r.fecha?.startsWith(mesPasado)).reduce((s, r) => s + (parseFloat(r.costo)  || 0), 0)
    const gNom  = nomina.filter(r => r.fecha?.startsWith(mesPasado)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    return gBase + gComb + gMant + gNom
  }, [gastos, combustible, mantenimiento, nomina, mesPasado])

  const balance       = totalIngresosMes - totalGastosMes
  const balancePasado = totalIngresosMesPasado - totalGastosMesPasado

  const barData = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => {
      const d   = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const key = d.toISOString().slice(0, 7)
      const ing = ingresos.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
      const gas = gastos.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
        + combustible.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.total)   || 0), 0)
        + mantenimiento.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.costo)  || 0), 0)
        + nomina.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
      return { mes: monthName(d.getMonth()), Ingresos: ing, Gastos: gas }
    }),
    [ingresos, gastos, combustible, mantenimiento, nomina])

  const pieData = useMemo(() => {
    const combTotal  = combustible.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.total)   || 0), 0)
    const mantTotal  = mantenimiento.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.costo)  || 0), 0)
    const nomTotal   = nomina.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    const otrosTotal = gastos.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    return [
      { name: 'Combustible',   value: combTotal  },
      { name: 'Mantenimiento', value: mantTotal  },
      { name: 'Nómina',        value: nomTotal   },
      { name: 'Otros',         value: otrosTotal },
    ].filter(d => d.value > 0)
  }, [combustible, mantenimiento, nomina, gastos, mesActual])

  const ultimoServicio = useMemo(() =>
    [...ingresos].sort((a, b) => b.fecha?.localeCompare(a.fecha))[0], [ingresos])
  const ultimoMant = useMemo(() =>
    [...mantenimiento].sort((a, b) => b.fecha?.localeCompare(a.fecha))[0], [mantenimiento])
  const ultimoNomina = useMemo(() =>
    [...nomina].sort((a, b) => b.fecha?.localeCompare(a.fecha))[0], [nomina])

  const fechaLarga = now.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="max-w-6xl mx-auto">

      {/* ── Encabezado ── */}
      <div className="db-in db-d0" style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.1, margin: 0, color: '#f1f5f9' }}>
          Panel de control
        </h1>
        <p style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize', marginTop: 6, letterSpacing: '0.03em', fontFamily: MONO }}>
          {fechaLarga}
        </p>
      </div>

      {/* ── Resumen financiero ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ marginBottom: 16 }}>

        {/* Ingresos */}
        <div className="surface surface-hover db-in db-d1" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--positive-dim)', border: '1px solid rgba(52,211,153,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUpCircle size={13} style={{ color: '#34D399' }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>
              Ingresos del mes
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: 'var(--positive)', fontFamily: MONO }}>
            {formatARS(totalIngresosMes)}
          </div>
          <TrendBadge actual={totalIngresosMes} anterior={totalIngresosMesPasado} />
        </div>

        {/* Gastos */}
        <div className="surface surface-hover db-in db-d2" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--danger-dim)', border: '1px solid rgba(248,113,113,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowDownCircle size={13} style={{ color: '#F87171' }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>
              Gastos del mes
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: 'var(--danger)', fontFamily: MONO }}>
            {formatARS(totalGastosMes)}
          </div>
          <TrendBadge actual={totalGastosMes} anterior={totalGastosMesPasado} />
        </div>

        {/* Balance */}
        <div
          className="surface surface-hover db-in db-d3"
          style={{
            padding: 24,
            borderColor: balance >= 0 ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)',
            background:  balance >= 0 ? 'rgba(52,211,153,0.04)' : 'rgba(248,113,113,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: balance >= 0 ? 'var(--positive-dim)' : 'var(--danger-dim)',
              border: `1px solid ${balance >= 0 ? 'rgba(52,211,153,0.22)' : 'rgba(248,113,113,0.22)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {balance >= 0
                ? <TrendingUp   size={13} style={{ color: '#34D399' }} />
                : <TrendingDown size={13} style={{ color: '#F87171' }} />}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>
              Balance neto
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: balance >= 0 ? 'var(--positive)' : 'var(--danger)', fontFamily: MONO }}>
            {formatARS(balance)}
          </div>
          <TrendBadge actual={balance} anterior={balancePasado} />
        </div>
      </div>

      {/* ── Gráficos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 16 }}>

        {/* Bar chart */}
        <div className="lg:col-span-2 surface db-in db-d4" style={{ padding: 24 }}>
          <p className="db-slabel">Ingresos vs Gastos · últimos 6 meses</p>
          {barData.some(d => d.Ingresos > 0 || d.Gastos > 0) ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={barData} barCategoryGap="32%" barGap={3}>
                <XAxis
                  dataKey="mes"
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: MONO }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: MONO }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11, fontWeight: 600 }} />
                <Bar dataKey="Ingresos" fill="#34D399" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gastos"   fill="#F87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="db-empty">Sin datos para mostrar</div>
          )}
        </div>

        {/* Pie chart */}
        <div className="surface db-in db-d5" style={{ padding: 24 }}>
          <p className="db-slabel">Distribución de gastos</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" strokeWidth={0}>
                  {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  formatter={v => formatARS(v)}
                  contentStyle={{ background: '#27272a', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 8, color: '#f1f5f9', fontSize: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
                  labelStyle={{ color: '#94a3b8', fontSize: 10 }}
                />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="db-empty">Sin datos del mes</div>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
        <StatCard
          icon={TrendingUp} label="Último servicio" color="#34D399" delay={5}
          value={ultimoServicio ? formatARS(ultimoServicio.importe) : 'Sin registros'}
          sub={ultimoServicio ? formatDate(ultimoServicio.fecha) : ''}
        />
        <StatCard
          icon={Wrench} label="Último mantenimiento" color="#FBBF24" delay={6}
          value={ultimoMant
            ? (ultimoMant.descripcion?.length > 20 ? ultimoMant.descripcion.slice(0, 20) + '…' : ultimoMant.descripcion)
            : 'Sin registros'}
          sub={ultimoMant ? formatDate(ultimoMant.fecha) : ''}
        />
        <StatCard
          icon={DollarSign} label="Último pago nómina" color="#A78BFA" delay={7}
          value={ultimoNomina ? formatARS(ultimoNomina.importe) : 'Sin registros'}
          sub={ultimoNomina ? ultimoNomina.empleado : ''}
        />
        <StatCard
          icon={Truck} label="KM del vehículo" color="#22D3EE" delay={8}
          value={vehiculo.kilometraje ? `${Number(vehiculo.kilometraje).toLocaleString('es-AR')} km` : 'Sin datos'}
          sub={vehiculo.patente || ''}
        />
      </div>

      {/* ── Acceso rápido ── */}
      <div className="surface db-in db-d8" style={{ padding: '22px 24px' }}>
        <p className="db-slabel">Acceso rápido</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <QuickBtn icon={ArrowUpCircle}   label="Nuevo ingreso"  color="#34D399" onClick={() => onNav('finanzas')}      />
          <QuickBtn icon={ArrowDownCircle} label="Nuevo gasto"    color="#F87171" onClick={() => onNav('finanzas')}      />
          <QuickBtn icon={Fuel}            label="Nueva carga"    color="#22D3EE" onClick={() => onNav('combustible')}   />
          <QuickBtn icon={Wrench}          label="Mantenimiento"  color="#FBBF24" onClick={() => onNav('mantenimiento')} />
        </div>
      </div>
    </div>
  )
}
