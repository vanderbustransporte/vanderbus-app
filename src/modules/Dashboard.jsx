import React, { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatARS, formatDate, monthName } from '../utils/format'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, TrendingDown, Fuel, Wrench, DollarSign, Truck, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { useChartTheme } from '../utils/chartTheme'

const numStyle = { fontVariantNumeric: 'tabular-nums' }
const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

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

function StatCard({ icon: Icon, label, value, sub, delay = 0 }) {
  return (
    <div
      className={`surface surface-hover db-in db-d${delay}`}
      style={{ padding: '20px 22px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={16} style={{ color: 'var(--accent)' }} />
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', ...numStyle, ...ellipsis }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function QuickBtn({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 text-sm font-semibold"
      style={{ padding: '11px 18px', borderRadius: 'var(--radius)', background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-1)', cursor: 'pointer', transition: 'border-color 150ms, background 150ms' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.background = 'var(--hover-tint)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-overlay)' }}
    >
      <Icon size={15} style={{ color: 'var(--accent)' }} />
      <span>{label}</span>
    </button>
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

  // NOTA: el "Gastos del mes" del Dashboard es INTENCIONALMENTE mas amplio que el de
  // Finanzas. Finanzas solo suma el libro manual (tabla gastos + marketing); el Dashboard
  // suma TODOS los costos operativos: gastos + combustible + mantenimiento + nomina.
  // Por eso los dos numeros no coinciden y no deben coincidir.
  // El monto de combustible se lee de `importe` (el campo que guarda el modulo Combustible),
  // no de `total`, que era una referencia vieja que hacia que el combustible sumara siempre 0.
  const totalGastosMes = useMemo(() => {
    const gBase = gastos.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    const gComb = combustible.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe)   || 0), 0)
    const gMant = mantenimiento.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.costo)  || 0), 0)
    const gNom  = nomina.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    return gBase + gComb + gMant + gNom
  }, [gastos, combustible, mantenimiento, nomina, mesActual])

  const totalGastosMesPasado = useMemo(() => {
    const gBase = gastos.filter(r => r.fecha?.startsWith(mesPasado)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    const gComb = combustible.filter(r => r.fecha?.startsWith(mesPasado)).reduce((s, r) => s + (parseFloat(r.importe)   || 0), 0)
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
        + combustible.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.importe)   || 0), 0)
        + mantenimiento.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.costo)  || 0), 0)
        + nomina.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
      return { mes: monthName(d.getMonth()), Ingresos: ing, Gastos: gas }
    }),
    [ingresos, gastos, combustible, mantenimiento, nomina])

  const pieData = useMemo(() => {
    const combTotal  = combustible.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe)   || 0), 0)
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

  const fechaLargaRaw = now.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).replace(',', '')
  const fechaLarga = fechaLargaRaw.charAt(0).toUpperCase() + fechaLargaRaw.slice(1)

  const ct = useChartTheme()

  return (
    <div className="max-w-[1680px] mx-auto w-full">

      {/* Encabezado */}
      <div className="db-in db-d0" style={{ marginBottom: 28 }}>
        <h1 className="mod-h1" style={{ fontSize: 36 }}>
          Panel de control
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6, letterSpacing: '0.03em', ...numStyle }}>
          {fechaLarga}
        </p>
      </div>

      {/* Resumen financiero: un solo panel, tres secciones */}
      <div className="surface db-in db-d1" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
        <div className="grid grid-cols-1 sm:grid-cols-3">

          <div style={{ padding: '26px 30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <ArrowUpCircle size={16} style={{ color: 'var(--positive)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)' }}>
                Ingresos del mes
              </span>
            </div>
            <div style={{ fontSize: 'clamp(26px, 3vw, 38px)', fontWeight: 700, lineHeight: 1, color: 'var(--positive)', ...numStyle, letterSpacing: '-0.02em' }}>
              {formatARS(totalIngresosMes)}
            </div>
            <TrendBadge actual={totalIngresosMes} anterior={totalIngresosMesPasado} />
          </div>

          <div className="border-t sm:border-t-0 sm:border-l" style={{ padding: '26px 30px', borderColor: 'var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <ArrowDownCircle size={16} style={{ color: 'var(--danger)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)' }}>
                Gastos del mes
              </span>
            </div>
            <div style={{ fontSize: 'clamp(26px, 3vw, 38px)', fontWeight: 700, lineHeight: 1, color: 'var(--danger)', ...numStyle, letterSpacing: '-0.02em' }}>
              {formatARS(totalGastosMes)}
            </div>
            <TrendBadge actual={totalGastosMes} anterior={totalGastosMesPasado} />
          </div>

          <div className="border-t sm:border-t-0 sm:border-l" style={{ padding: '26px 30px', borderColor: 'var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              {balance >= 0
                ? <TrendingUp size={16} style={{ color: 'var(--positive)' }} />
                : <TrendingDown size={16} style={{ color: 'var(--danger)' }} />}
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)' }}>
                Balance neto
              </span>
            </div>
            <div style={{ fontSize: 'clamp(30px, 3.6vw, 44px)', fontWeight: 800, lineHeight: 1, color: balance >= 0 ? 'var(--positive)' : 'var(--danger)', ...numStyle, letterSpacing: '-0.02em' }}>
              {formatARS(balance)}
            </div>
            <TrendBadge actual={balance} anterior={balancePasado} />
          </div>

        </div>
      </div>

      {/* Graficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" style={{ marginBottom: 20 }}>

        <div className="lg:col-span-2 surface db-in db-d4" style={{ padding: 26 }}>
          <p className="db-slabel">Ingresos vs Gastos · últimos 6 meses</p>
          {barData.some(d => d.Ingresos > 0 || d.Gastos > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
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

        <div className="surface db-in db-d5" style={{ padding: 26 }}>
          <p className="db-slabel">Distribución de gastos</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" strokeWidth={0}>
                  {pieData.map((_, i) => <Cell key={i} fill={ct.categorical[i % ct.categorical.length]} />)}
                </Pie>
                <Tooltip
                  formatter={v => formatARS(v)}
                  {...ct.tooltip}
                />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ color: ct.tickColor, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="db-empty">Sin datos del mes</div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" style={{ marginBottom: 20 }}>
        <StatCard
          icon={TrendingUp} label="Último servicio" delay={5}
          value={ultimoServicio ? formatARS(ultimoServicio.importe) : 'Sin registros'}
          sub={ultimoServicio ? formatDate(ultimoServicio.fecha) : ''}
        />
        <StatCard
          icon={Wrench} label="Último mantenimiento" delay={6}
          value={ultimoMant
            ? (ultimoMant.descripcion?.length > 20 ? ultimoMant.descripcion.slice(0, 20) + '…' : ultimoMant.descripcion)
            : 'Sin registros'}
          sub={ultimoMant ? formatDate(ultimoMant.fecha) : ''}
        />
        <StatCard
          icon={DollarSign} label="Último pago nómina" delay={7}
          value={ultimoNomina ? formatARS(ultimoNomina.importe) : 'Sin registros'}
          sub={ultimoNomina ? ultimoNomina.empleado : ''}
        />
        <StatCard
          icon={Truck} label="KM del vehículo" delay={8}
          value={vehiculo.kilometraje ? `${Number(vehiculo.kilometraje).toLocaleString('es-AR')} km` : 'Sin datos'}
          sub={vehiculo.patente || ''}
        />
      </div>

      {/* Acceso rapido */}
      <div className="surface db-in db-d8" style={{ padding: '24px 28px' }}>
        <p className="db-slabel">Acceso rápido</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <QuickBtn icon={ArrowUpCircle}   label="Nuevo ingreso"  onClick={() => onNav('finanzas')}      />
          <QuickBtn icon={ArrowDownCircle} label="Nuevo gasto"    onClick={() => onNav('finanzas')}      />
          <QuickBtn icon={Fuel}            label="Nueva carga"    onClick={() => onNav('combustible')}   />
          <QuickBtn icon={Wrench}          label="Mantenimiento"  onClick={() => onNav('mantenimiento')} />
        </div>
      </div>
    </div>
  )
}
