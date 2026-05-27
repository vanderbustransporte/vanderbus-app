import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId, monthName } from '../utils/format'
import Modal from '../components/shared/Modal'
import { Field, Input, Select } from '../components/shared/Field'
import { Fuel, Plus, Trash2 } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

// L/100km ranges for a bus
const CONSUMO_BUENO = 30
const CONSUMO_NORMAL = 40

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-xl p-10 flex flex-col items-center justify-center text-center"
          style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}
        >
          <Fuel size={32} className="text-gray-600 mb-3" />
          <p className="text-gray-400 font-semibold">Sin registros aún</p>
          <p className="text-gray-600 text-sm mt-1">Recargá la página si el problema persiste.</p>
        </div>
      )
    }
    return this.props.children
  }
}

const empty = () => ({
  id: genId(),
  fecha: todayISO(),
  litros: '',
  importe: '',
  km: '',
  proveedor: '',
  tipo: 'Gasoil',
})

function consumoColor(c) {
  if (c == null) return 'text-gray-500'
  if (c <= CONSUMO_BUENO) return 'text-green-400'
  if (c <= CONSUMO_NORMAL) return 'text-yellow-400'
  return 'text-red-400'
}

const TOOLTIP_STYLE = {
  contentStyle: { background: '#1E1E2E', border: '1px solid #2E2E42', borderRadius: 8 },
  labelStyle: { color: '#e5e7eb' },
  itemStyle: { color: '#e5e7eb' },
}

function getPrecioLitro(r) {
  const imp = parseFloat(r.importe)
  const lit = parseFloat(r.litros)
  if (imp > 0 && lit > 0) return imp / lit
  return null
}

function Combustible() {
  const { data, update } = useStore()
  const list = data.combustible || []
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty())
  const [errors, setErrors] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.fecha) e.fecha = 'Requerido'
    if (!form.litros || isNaN(form.litros)) e.litros = 'Requerido'
    if (!form.importe || isNaN(form.importe)) e.importe = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    update('combustible', [{ ...form }, ...list])
    setModal(false)
    setForm(empty())
  }

  const handleDelete = id => {
    if (confirm('¿Eliminar este registro?'))
      update('combustible', list.filter(r => r.id !== id))
  }

  // Sort ascending by km for consumption calculation (no km → goes last)
  const sortedByKm = useMemo(
    () =>
      [...list].sort((a, b) => {
        const kmA = parseFloat(a.km)
        const kmB = parseFloat(b.km)
        if (!kmA && !kmB) return 0
        if (!kmA) return 1
        if (!kmB) return -1
        return kmA - kmB
      }),
    [list]
  )

  // Compute L/100km: (litros / (km_actual - km_anterior)) * 100, sorted by km asc
  const withConsumo = useMemo(
    () =>
      sortedByKm
        .map((r, i) => {
          const prev = sortedByKm[i - 1]
          if (i === 0 || !r.km || !prev?.km) return { ...r, consumo: null }
          const kmDiff = parseFloat(r.km) - parseFloat(prev.km)
          if (kmDiff <= 0) return { ...r, consumo: null }
          const c = (parseFloat(r.litros) / kmDiff) * 100
          return { ...r, consumo: c > 0 ? c : null }
        })
        .reverse(),
    [sortedByKm]
  )

  const totalMes = list.reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
  const litrosMes = list.reduce((s, r) => s + (parseFloat(r.litros) || 0), 0)

  const pricedRows = list.filter(r => {
    const imp = parseFloat(r.importe)
    const lit = parseFloat(r.litros)
    return imp > 0 && lit > 0
  })
  const precioPromedio =
    pricedRows.length > 0
      ? pricedRows.reduce((s, r) => s + (getPrecioLitro(r) || 0), 0) / pricedRows.length
      : 0

  const consumoValidos = withConsumo.filter(r => r.consumo != null)
  const consumoPromedio =
    consumoValidos.length > 0
      ? consumoValidos.reduce((s, r) => s + r.consumo, 0) / consumoValidos.length
      : null

  // Bar chart — last 6 months
  const barData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const importe = list
        .filter(r => r.fecha?.startsWith(key))
        .reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
      return { mes: monthName(d.getMonth()), importe }
    })
  }, [list])

  // Line chart — price per liter over time
  const lineData = useMemo(
    () =>
      [...list]
        .filter(r => r.fecha && getPrecioLitro(r) != null)
        .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
        .map(r => ({
          fecha: formatDate(r.fecha),
          precio: getPrecioLitro(r),
        })),
    [list]
  )

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(74,143,212,0.2)' }}
          >
            <Fuel size={20} style={{ color: '#4A8FD4' }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold text-white"
              style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}
            >
              COMBUSTIBLE
            </h1>
            <p className="text-xs text-gray-500">Historial de cargas</p>
          </div>
        </div>
        <button
          onClick={() => { setForm(empty()); setErrors({}); setModal(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: '#4A8FD4' }}
        >
          <Plus size={16} /> Nueva carga
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Gasto total', value: formatARS(totalMes), color: '#4A8FD4' },
          { label: 'Litros total', value: `${litrosMes.toFixed(1)} L`, color: '#22c55e' },
          { label: 'Precio promedio/L', value: formatARS(precioPromedio), color: '#f59e0b' },
          {
            label: 'Consumo prom.',
            value: consumoPromedio != null ? `${consumoPromedio.toFixed(1)} L/100km` : '-',
            color: consumoPromedio != null
              ? consumoPromedio <= CONSUMO_BUENO ? '#22c55e'
              : consumoPromedio <= CONSUMO_NORMAL ? '#f59e0b'
              : '#f87171'
              : '#6b7280',
          },
        ].map(s => (
          <div
            key={s.label}
            className="rounded-xl p-4"
            style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}
          >
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Bar — monthly spending */}
        <div
          className="rounded-xl p-5"
          style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}
        >
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Gasto mensual — últimos 6 meses</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E42" vertical={false} />
              <XAxis
                dataKey="mes"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                width={40}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={v => [formatARS(v), 'Gasto']}
              />
              <Bar dataKey="importe" fill="#4A8FD4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Line — price per liter */}
        <div
          className="rounded-xl p-5"
          style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}
        >
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Evolución del precio por litro</h2>
          {lineData.length < 2 ? (
            <div className="flex items-center justify-center h-[180px] text-gray-500 text-sm">
              Cargá al menos 2 registros para ver la evolución
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={lineData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2E42" vertical={false} />
                <XAxis
                  dataKey="fecha"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `$${v}`}
                  width={48}
                />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={v => [formatARS(v), '$/litro']}
                />
                <Line
                  type="monotone"
                  dataKey="precio"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* History table */}
      <div
        className="rounded-xl p-5"
        style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}
      >
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Historial de cargas</h2>
        {withConsumo.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">Sin registros aún</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs text-gray-500 uppercase tracking-wide"
                  style={{ borderBottom: '1px solid #2E2E42' }}
                >
                  <th className="text-left pb-3 pr-4 font-medium">Fecha</th>
                  <th className="text-right pb-3 pr-4 font-medium">KM</th>
                  <th className="text-right pb-3 pr-4 font-medium">Litros</th>
                  <th className="text-right pb-3 pr-4 font-medium">Importe</th>
                  <th className="text-right pb-3 pr-4 font-medium">$/Litro</th>
                  <th className="text-right pb-3 pr-4 font-medium">L/100km</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {withConsumo.map(r => {
                  const precio = getPrecioLitro(r)
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-white/5 transition-colors"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <td className="py-3 pr-4 text-gray-300">{formatDate(r.fecha)}</td>
                      <td className="py-3 pr-4 text-right text-gray-300">
                        {r.km ? Number(r.km).toLocaleString('es-AR') : '-'}
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-300">
                        {r.litros ? `${parseFloat(r.litros).toFixed(1)} L` : '-'}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold" style={{ color: '#4A8FD4' }}>
                        {r.importe ? formatARS(r.importe) : '-'}
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-400">
                        {precio && isFinite(precio) ? formatARS(precio) : '-'}
                      </td>
                      <td className={`py-3 pr-4 text-right font-semibold ${consumoColor(r.consumo)}`}>
                        {r.consumo != null ? r.consumo.toFixed(1) : '-'}
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New entry modal */}
      {modal && (
        <Modal title="Nueva carga de combustible" onClose={() => setModal(false)}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha" required>
              <Input
                type="date"
                value={form.fecha}
                onChange={e => set('fecha', e.target.value)}
              />
              {errors.fecha && <p className="text-red-400 text-xs mt-1">{errors.fecha}</p>}
            </Field>
            <Field label="KM actual">
              <Input
                type="number"
                value={form.km}
                onChange={e => set('km', e.target.value)}
                placeholder="Ej: 150000"
              />
            </Field>
            <Field label="Litros cargados" required>
              <Input
                type="number"
                step="0.01"
                value={form.litros}
                onChange={e => set('litros', e.target.value)}
                placeholder="0.00"
              />
              {errors.litros && <p className="text-red-400 text-xs mt-1">{errors.litros}</p>}
            </Field>
            <Field label="Importe gastado ($)" required>
              <Input
                type="number"
                step="0.01"
                value={form.importe}
                onChange={e => set('importe', e.target.value)}
                placeholder="0.00"
              />
              {errors.importe && <p className="text-red-400 text-xs mt-1">{errors.importe}</p>}
            </Field>
            <div className="col-span-2">
              <Field label="Tipo de combustible">
                <Select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                  <option>Gasoil</option>
                  <option>Diésel Premium</option>
                  <option>GNC</option>
                  <option>Nafta</option>
                </Select>
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Proveedor / Estación">
                <Input
                  value={form.proveedor}
                  onChange={e => set('proveedor', e.target.value)}
                  placeholder="Ej: YPF Autopista Norte"
                />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setModal(false)}
              className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: '#4A8FD4' }}
            >
              Guardar
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default function CombustiblePage() {
  return (
    <ErrorBoundary>
      <Combustible />
    </ErrorBoundary>
  )
}
