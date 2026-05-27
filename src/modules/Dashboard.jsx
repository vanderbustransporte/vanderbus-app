import React, { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatARS, formatDate, monthName } from '../utils/format'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, TrendingDown, Fuel, Wrench, DollarSign, Truck, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

const COLORS = ['#3D8FD1', '#7EC8E3', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

const cardStyle = {
  background: 'rgba(255,255,255,0.6)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.8)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
  borderRadius: '16px',
}

function TrendBadge({ actual, anterior }) {
  if (anterior === 0) return null
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100
  const up = pct >= 0
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '3px',
      marginTop: '6px',
      padding: '2px 8px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: 600,
      background: up ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.10)',
      color: up ? '#16A34A' : '#DC2626',
    }}>
      {up ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}% vs mes anterior
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color = '#3D8FD1' }) {
  return (
    <div className="p-5 flex items-start gap-4" style={cardStyle}>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#64748B' }}>{label}</div>
        <div className="text-lg font-bold truncate" style={{ color: '#1A202C' }}>{value}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{sub}</div>}
      </div>
    </div>
  )
}

function QuickBtn({ icon: Icon, label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      style={{ background: color, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: `0 4px 15px ${color}55`, borderRadius: '10px' }}
    >
      <Icon size={16} /> {label}
    </button>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-xl p-3 text-sm"
      style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', borderRadius: '12px' }}
    >
      <p className="font-medium mb-1" style={{ color: '#64748B' }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">{p.name}: {formatARS(p.value)}</p>
      ))}
    </div>
  )
}

export default function Dashboard({ onNav }) {
  const { data } = useStore()
  const ingresos = data.ingresos || []
  const gastos = data.gastos || []
  const combustible = data.combustible || []
  const mantenimiento = data.mantenimiento || []
  const nomina = data.nomina || []
  const vehiculo = data.vehiculo || {}

  const now = new Date()
  const mesActual = now.toISOString().slice(0, 7)
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const mesPasado = prevDate.toISOString().slice(0, 7)

  const totalIngresosMes = useMemo(() =>
    ingresos.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0),
    [ingresos, mesActual])

  const totalIngresosMesPasado = useMemo(() =>
    ingresos.filter(r => r.fecha?.startsWith(mesPasado)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0),
    [ingresos, mesPasado])

  const totalGastosMes = useMemo(() => {
    const gBase = gastos.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    const gComb = combustible.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.total) || 0), 0)
    const gMant = mantenimiento.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.costo) || 0), 0)
    const gNom = nomina.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    return gBase + gComb + gMant + gNom
  }, [gastos, combustible, mantenimiento, nomina, mesActual])

  const totalGastosMesPasado = useMemo(() => {
    const gBase = gastos.filter(r => r.fecha?.startsWith(mesPasado)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    const gComb = combustible.filter(r => r.fecha?.startsWith(mesPasado)).reduce((s, r) => s + (parseFloat(r.total) || 0), 0)
    const gMant = mantenimiento.filter(r => r.fecha?.startsWith(mesPasado)).reduce((s, r) => s + (parseFloat(r.costo) || 0), 0)
    const gNom = nomina.filter(r => r.fecha?.startsWith(mesPasado)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    return gBase + gComb + gMant + gNom
  }, [gastos, combustible, mantenimiento, nomina, mesPasado])

  const balance = totalIngresosMes - totalGastosMes
  const balancePasado = totalIngresosMesPasado - totalGastosMesPasado

  const barData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const key = d.toISOString().slice(0, 7)
      const ing = ingresos.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
      const gas = gastos.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
        + combustible.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.total) || 0), 0)
        + mantenimiento.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.costo) || 0), 0)
        + nomina.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
      return { mes: monthName(d.getMonth()), Ingresos: ing, Gastos: gas }
    })
  }, [ingresos, gastos, combustible, mantenimiento, nomina])

  const pieData = useMemo(() => {
    const combTotal = combustible.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.total) || 0), 0)
    const mantTotal = mantenimiento.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.costo) || 0), 0)
    const nomTotal = nomina.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    const otrosTotal = gastos.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    return [
      { name: 'Combustible', value: combTotal },
      { name: 'Mantenimiento', value: mantTotal },
      { name: 'Nómina', value: nomTotal },
      { name: 'Otros', value: otrosTotal },
    ].filter(d => d.value > 0)
  }, [combustible, mantenimiento, nomina, gastos, mesActual])

  const ultimoServicio = useMemo(() => [...ingresos].sort((a, b) => b.fecha?.localeCompare(a.fecha))[0], [ingresos])
  const ultimoMant = useMemo(() => [...mantenimiento].sort((a, b) => b.fecha?.localeCompare(a.fecha))[0], [mantenimiento])
  const ultimoNomina = useMemo(() => [...nomina].sort((a, b) => b.fecha?.localeCompare(a.fecha))[0], [nomina])

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#1A202C', fontFamily: "'Inter', sans-serif" }}>
          Dashboard
        </h1>
        <p className="text-sm" style={{ color: '#64748B' }}>
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Resumen financiero del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-5 rounded-xl" style={{ ...cardStyle }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
              <ArrowUpCircle size={15} style={{ color: '#16A34A' }} />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#64748B' }}>Ingresos del mes</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: '#16A34A' }}>{formatARS(totalIngresosMes)}</div>
          <TrendBadge actual={totalIngresosMes} anterior={totalIngresosMesPasado} />
        </div>

        <div className="p-5 rounded-xl" style={{ ...cardStyle }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <ArrowDownCircle size={15} style={{ color: '#DC2626' }} />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#64748B' }}>Gastos del mes</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: '#DC2626' }}>{formatARS(totalGastosMes)}</div>
          <TrendBadge actual={totalGastosMes} anterior={totalGastosMesPasado} />
        </div>

        <div
          className="p-5 rounded-xl"
          style={{
            ...cardStyle,
            background: balance >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.10)',
            border: balance >= 0 ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(239,68,68,0.3)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: balance >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)' }}
            >
              {balance >= 0
                ? <TrendingUp size={15} style={{ color: '#16A34A' }} />
                : <TrendingDown size={15} style={{ color: '#DC2626' }} />}
            </div>
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#64748B' }}>Balance neto</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: balance >= 0 ? '#16A34A' : '#DC2626' }}>{formatARS(balance)}</div>
          <TrendBadge actual={balance} anterior={balancePasado} />
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 p-5 rounded-xl" style={cardStyle}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: '#374151' }}>
            Ingresos vs Gastos — últimos 6 meses
          </h2>
          {barData.some(d => d.Ingresos > 0 || d.Gastos > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} barCategoryGap="30%">
                <XAxis dataKey="mes" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#64748B', fontSize: 12 }} />
                <Bar dataKey="Ingresos" fill="#3D8FD1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gastos" fill="#7EC8E3" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-sm" style={{ color: '#94A3B8' }}>Sin datos para mostrar</div>
          )}
        </div>

        <div className="p-5 rounded-xl" style={cardStyle}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: '#374151' }}>
            Distribución de gastos del mes
          </h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  formatter={v => formatARS(v)}
                  contentStyle={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 10,
                    color: '#1A202C',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ color: '#64748B', fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-sm" style={{ color: '#94A3B8' }}>Sin datos del mes</div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={TrendingUp} label="Último servicio" color="#16A34A"
          value={ultimoServicio ? formatARS(ultimoServicio.importe) : 'Sin registros'}
          sub={ultimoServicio ? formatDate(ultimoServicio.fecha) : ''} />
        <StatCard icon={Wrench} label="Último mantenimiento" color="#D97706"
          value={ultimoMant ? (ultimoMant.descripcion?.length > 20 ? ultimoMant.descripcion.slice(0, 20) + '…' : ultimoMant.descripcion) : 'Sin registros'}
          sub={ultimoMant ? formatDate(ultimoMant.fecha) : ''} />
        <StatCard icon={DollarSign} label="Último pago nómina" color="#7C3AED"
          value={ultimoNomina ? formatARS(ultimoNomina.importe) : 'Sin registros'}
          sub={ultimoNomina ? ultimoNomina.empleado : ''} />
        <StatCard icon={Truck} label="KM del vehículo" color="#3D8FD1"
          value={vehiculo.kilometraje ? `${Number(vehiculo.kilometraje).toLocaleString('es-AR')} km` : 'Sin datos'}
          sub={vehiculo.patente || ''} />
      </div>

      {/* Acceso rápido */}
      <div className="p-5 rounded-xl" style={cardStyle}>
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#64748B' }}>Acceso rápido</h2>
        <div className="flex flex-wrap gap-3">
          <QuickBtn icon={ArrowUpCircle} label="Nuevo ingreso" color="#16A34A" onClick={() => onNav('finanzas')} />
          <QuickBtn icon={ArrowDownCircle} label="Nuevo gasto" color="#DC2626" onClick={() => onNav('finanzas')} />
          <QuickBtn icon={Fuel} label="Nueva carga" color="#3D8FD1" onClick={() => onNav('combustible')} />
          <QuickBtn icon={Wrench} label="Nuevo mantenimiento" color="#D97706" onClick={() => onNav('mantenimiento')} />
        </div>
      </div>
    </div>
  )
}
