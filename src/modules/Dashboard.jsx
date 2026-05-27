import React, { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { formatARS, formatDate, monthName } from '../utils/format'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, TrendingDown, Fuel, Wrench, DollarSign, Truck, Plus, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

const COLORS = ['#4A8FD4', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

function StatCard({ icon: Icon, label, value, sub, color = '#4A8FD4' }) {
  return (
    <div className="rounded-xl p-5 flex items-start gap-4" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}22` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
        <div className="text-lg font-bold text-white truncate">{value}</div>
        {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

function QuickBtn({ icon: Icon, label, color, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
      style={{ background: color }}>
      <Icon size={16} /> {label}
    </button>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg p-3 text-sm" style={{ background: '#252535', border: '1px solid #2E2E42' }}>
      <p className="text-gray-400 mb-1">{label}</p>
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

  const totalIngresosMes = useMemo(() => ingresos.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0), [ingresos, mesActual])
  const totalGastosMes = useMemo(() => {
    const gBase = gastos.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    const gComb = combustible.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.total) || 0), 0)
    const gMant = mantenimiento.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.costo) || 0), 0)
    const gNom = nomina.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    return gBase + gComb + gMant + gNom
  }, [gastos, combustible, mantenimiento, nomina, mesActual])

  const balance = totalIngresosMes - totalGastosMes

  // Últimos 6 meses
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

  // Torta de gastos por categoría
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

  // Último de cada categoría
  const ultimoServicio = useMemo(() => [...ingresos].sort((a, b) => b.fecha?.localeCompare(a.fecha))[0], [ingresos])
  const ultimoMant = useMemo(() => [...mantenimiento].sort((a, b) => b.fecha?.localeCompare(a.fecha))[0], [mantenimiento])
  const ultimoNomina = useMemo(() => [...nomina].sort((a, b) => b.fecha?.localeCompare(a.fecha))[0], [nomina])

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-white mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
          DASHBOARD
        </h1>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Resumen financiero del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl p-5" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpCircle size={18} className="text-green-400" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">Ingresos del mes</span>
          </div>
          <div className="text-2xl font-bold text-green-400">{formatARS(totalIngresosMes)}</div>
        </div>
        <div className="rounded-xl p-5" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownCircle size={18} className="text-red-400" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">Gastos del mes</span>
          </div>
          <div className="text-2xl font-bold text-red-400">{formatARS(totalGastosMes)}</div>
        </div>
        <div className="rounded-xl p-5" style={{ background: balance >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: '1px solid #2E2E42' }}>
          <div className="flex items-center gap-2 mb-2">
            {balance >= 0 ? <TrendingUp size={18} className="text-green-400" /> : <TrendingDown size={18} className="text-red-400" />}
            <span className="text-xs text-gray-500 uppercase tracking-wider">Balance neto</span>
          </div>
          <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatARS(balance)}</div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 rounded-xl p-5" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Ingresos vs Gastos — últimos 6 meses</h2>
          {barData.some(d => d.Ingresos > 0 || d.Gastos > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} barCategoryGap="30%">
                <XAxis dataKey="mes" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                <Bar dataKey="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-gray-600 text-sm">Sin datos para mostrar</div>
          )}
        </div>

        <div className="rounded-xl p-5" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Distribución de gastos del mes</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => formatARS(v)} contentStyle={{ background: '#252535', border: '1px solid #2E2E42', color: '#fff', borderRadius: 8 }} />
                <Legend iconType="circle" wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-gray-600 text-sm">Sin datos del mes</div>
          )}
        </div>
      </div>

      {/* Cards de resumen rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={TrendingUp} label="Último servicio" color="#22c55e"
          value={ultimoServicio ? formatARS(ultimoServicio.importe) : 'Sin registros'}
          sub={ultimoServicio ? formatDate(ultimoServicio.fecha) : ''} />
        <StatCard icon={Wrench} label="Último mantenimiento" color="#f59e0b"
          value={ultimoMant ? ultimoMant.descripcion?.slice(0, 20) + '...' : 'Sin registros'}
          sub={ultimoMant ? formatDate(ultimoMant.fecha) : ''} />
        <StatCard icon={DollarSign} label="Último pago de nómina" color="#8b5cf6"
          value={ultimoNomina ? formatARS(ultimoNomina.importe) : 'Sin registros'}
          sub={ultimoNomina ? ultimoNomina.empleado : ''} />
        <StatCard icon={Truck} label="KM del vehículo" color="#4A8FD4"
          value={vehiculo.kilometraje ? `${Number(vehiculo.kilometraje).toLocaleString('es-AR')} km` : 'Sin datos'}
          sub={vehiculo.patente || ''} />
      </div>

      {/* Acceso rápido */}
      <div className="rounded-xl p-5" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
        <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Acceso rápido</h2>
        <div className="flex flex-wrap gap-3">
          <QuickBtn icon={ArrowUpCircle} label="Nuevo ingreso" color="#22c55e" onClick={() => onNav('finanzas')} />
          <QuickBtn icon={ArrowDownCircle} label="Nuevo gasto" color="#ef4444" onClick={() => onNav('finanzas')} />
          <QuickBtn icon={Fuel} label="Nueva carga de combustible" color="#4A8FD4" onClick={() => onNav('combustible')} />
          <QuickBtn icon={Wrench} label="Nuevo mantenimiento" color="#f59e0b" onClick={() => onNav('mantenimiento')} />
        </div>
      </div>
    </div>
  )
}
