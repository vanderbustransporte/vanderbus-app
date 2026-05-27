import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId, monthName } from '../utils/format'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, BtnPrimary, BtnCancel } from '../components/shared/Field'
import { Fuel, Plus, Trash2 } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const CONSUMO_BUENO = 30
const CONSUMO_NORMAL = 40

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  borderRadius: '12px',
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 10,
    color: '#1A202C',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
  },
  labelStyle: { color: '#374151' },
  itemStyle: { color: '#374151' },
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) return (
      <div className="rounded-xl p-10 flex flex-col items-center justify-center text-center" style={cardStyle}>
        <Fuel size={32} style={{ color: '#94A3B8' }} className="mb-3" />
        <p className="font-semibold" style={{ color: '#64748B' }}>Sin registros aún</p>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Recargá la página si el problema persiste.</p>
      </div>
    )
    return this.props.children
  }
}

const empty = () => ({
  id: genId(), fecha: todayISO(), litros: '', importe: '', km: '', proveedor: '', tipo: 'Gasoil',
})

function consumoColor(c) {
  if (c == null) return '#94A3B8'
  if (c <= CONSUMO_BUENO) return '#16A34A'
  if (c <= CONSUMO_NORMAL) return '#D97706'
  return '#DC2626'
}

function consumoBg(c) {
  if (c == null) return { bg: '#F8FAFC', color: '#94A3B8' }
  if (c <= CONSUMO_BUENO) return { bg: 'rgba(34,197,94,0.1)', color: '#16A34A' }
  if (c <= CONSUMO_NORMAL) return { bg: 'rgba(217,119,6,0.1)', color: '#D97706' }
  return { bg: 'rgba(220,38,38,0.1)', color: '#DC2626' }
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
    if (confirm('¿Eliminar este registro?')) update('combustible', list.filter(r => r.id !== id))
  }

  const sortedByKm = useMemo(() =>
    [...list].sort((a, b) => {
      const kmA = parseFloat(a.km), kmB = parseFloat(b.km)
      if (!kmA && !kmB) return 0
      if (!kmA) return 1
      if (!kmB) return -1
      return kmA - kmB
    }), [list])

  const withConsumo = useMemo(() =>
    sortedByKm.map((r, i) => {
      const prev = sortedByKm[i - 1]
      if (i === 0 || !r.km || !prev?.km) return { ...r, consumo: null }
      const kmDiff = parseFloat(r.km) - parseFloat(prev.km)
      if (kmDiff <= 0) return { ...r, consumo: null }
      const c = (parseFloat(r.litros) / kmDiff) * 100
      return { ...r, consumo: c > 0 ? c : null }
    }).reverse(), [sortedByKm])

  const totalMes = list.reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
  const litrosMes = list.reduce((s, r) => s + (parseFloat(r.litros) || 0), 0)

  const pricedRows = list.filter(r => parseFloat(r.importe) > 0 && parseFloat(r.litros) > 0)
  const precioPromedio = pricedRows.length > 0
    ? pricedRows.reduce((s, r) => s + (getPrecioLitro(r) || 0), 0) / pricedRows.length
    : 0

  const consumoValidos = withConsumo.filter(r => r.consumo != null)
  const consumoPromedio = consumoValidos.length > 0
    ? consumoValidos.reduce((s, r) => s + r.consumo, 0) / consumoValidos.length
    : null

  const barData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const importe = list.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
      return { mes: monthName(d.getMonth()), importe }
    })
  }, [list])

  const lineData = useMemo(() =>
    [...list]
      .filter(r => r.fecha && getPrecioLitro(r) != null)
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
      .map(r => ({ fecha: formatDate(r.fecha), precio: getPrecioLitro(r) })),
    [list])

  const stats = [
    { label: 'Gasto total', value: formatARS(totalMes), color: '#3D8FD1' },
    { label: 'Litros total', value: `${litrosMes.toFixed(1)} L`, color: '#16A34A' },
    { label: 'Precio prom./L', value: formatARS(precioPromedio), color: '#D97706' },
    {
      label: 'Consumo prom.',
      value: consumoPromedio != null ? `${consumoPromedio.toFixed(1)} L/100km` : '—',
      color: consumoPromedio != null ? consumoColor(consumoPromedio) : '#94A3B8',
    },
  ]

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(61,143,209,0.1)' }}>
            <Fuel size={20} style={{ color: '#3D8FD1' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1A202C', fontFamily: "'Inter', sans-serif" }}>Combustible</h1>
            <p className="text-xs" style={{ color: '#64748B' }}>Historial de cargas</p>
          </div>
        </div>
        <button
          onClick={() => { setForm(empty()); setErrors({}); setModal(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: '#3D8FD1', borderRadius: '8px' }}
        >
          <Plus size={16} /> Nueva carga
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.label} className="p-4 rounded-xl" style={cardStyle}>
            <div className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>{s.label}</div>
            <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="p-5 rounded-xl" style={cardStyle}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: '#374151' }}>Gasto mensual — últimos 6 meses</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} width={40} />
              <Tooltip {...TOOLTIP_STYLE} formatter={v => [formatARS(v), 'Gasto']} />
              <Bar dataKey="importe" fill="#3D8FD1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="p-5 rounded-xl" style={cardStyle}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: '#374151' }}>Evolución del precio por litro</h2>
          {lineData.length < 2 ? (
            <div className="flex items-center justify-center h-[180px] text-sm" style={{ color: '#94A3B8' }}>
              Cargá al menos 2 registros para ver la evolución
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={lineData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
                <XAxis dataKey="fecha" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} width={48} />
                <Tooltip {...TOOLTIP_STYLE} formatter={v => [formatARS(v), '$/litro']} />
                <Line type="monotone" dataKey="precio" stroke="#D97706" strokeWidth={2} dot={{ r: 3, fill: '#D97706', strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* History table */}
      <div className="p-5 rounded-xl" style={cardStyle}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: '#374151' }}>Historial de cargas</h2>
        {withConsumo.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: '#94A3B8' }}>Sin registros aún</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                  {['Fecha', 'KM', 'Litros', 'Importe', '$/Litro', 'L/100km', ''].map(h => (
                    <th key={h} className={`pb-3 pt-3 px-3 text-xs font-semibold uppercase tracking-wider ${h === '' ? '' : 'text-left'}`} style={{ color: '#64748B' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withConsumo.map(r => {
                  const precio = getPrecioLitro(r)
                  const { bg, color } = consumoBg(r.consumo)
                  return (
                    <tr
                      key={r.id}
                      style={{ borderBottom: '1px solid #F0F4F8' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '' }}
                    >
                      <td className="py-3 px-3" style={{ color: '#374151' }}>{formatDate(r.fecha)}</td>
                      <td className="py-3 px-3 text-right" style={{ color: '#374151' }}>
                        {r.km ? Number(r.km).toLocaleString('es-AR') : '—'}
                      </td>
                      <td className="py-3 px-3 text-right" style={{ color: '#374151' }}>
                        {r.litros ? `${parseFloat(r.litros).toFixed(1)} L` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold" style={{ color: '#3D8FD1' }}>
                        {r.importe ? formatARS(r.importe) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right" style={{ color: '#64748B' }}>
                        {precio && isFinite(precio) ? formatARS(precio) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {r.consumo != null ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: bg, color }}>
                            {r.consumo.toFixed(1)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: '#EF4444' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = '' }}
                        >
                          <Trash2 size={14} />
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

      {/* Modal */}
      {modal && (
        <Modal title="Nueva carga de combustible" onClose={() => setModal(false)}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha" required>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
              {errors.fecha && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.fecha}</p>}
            </Field>
            <Field label="KM actual">
              <Input type="number" value={form.km} onChange={e => set('km', e.target.value)} placeholder="Ej: 150000" />
            </Field>
            <Field label="Litros cargados" required>
              <Input type="number" step="0.01" value={form.litros} onChange={e => set('litros', e.target.value)} placeholder="0.00" />
              {errors.litros && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.litros}</p>}
            </Field>
            <Field label="Importe ($)" required>
              <Input type="number" step="0.01" value={form.importe} onChange={e => set('importe', e.target.value)} placeholder="0.00" />
              {errors.importe && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.importe}</p>}
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
                <Input value={form.proveedor} onChange={e => set('proveedor', e.target.value)} placeholder="Ej: YPF Autopista Norte" />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <BtnCancel onClick={() => setModal(false)} />
            <BtnPrimary onClick={handleSave}>Guardar</BtnPrimary>
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
