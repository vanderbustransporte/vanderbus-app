import React, { useState, useMemo } from 'react'
import { useStore, getData } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId, monthName } from '../utils/format'
import { toISO, fechaMes } from '../utils/fecha'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, BtnPrimary, BtnCancel } from '../components/shared/Field'
import { Fuel, Plus, Trash2, Edit2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { conValorActual, vehiculosSeleccionables } from '../utils/form'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { useChartTheme } from '../utils/chartTheme'

const ACCENT = 'var(--accent)'
const MONO   = "'Geist', system-ui, sans-serif"

const CONSUMO_BUENO  = 30
const CONSUMO_NORMAL = 40

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) return (
      <div className="surface p-10 flex flex-col items-center justify-center text-center">
        <Fuel size={32} style={{ color: 'var(--text-3)' }} className="mb-3" />
        <p className="font-semibold" style={{ color: 'var(--text-2)' }}>Sin registros aún</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Recargá la página si el problema persiste.</p>
      </div>
    )
    return this.props.children
  }
}

const TIPOS = ['Gasoil', 'Diésel Premium', 'GNC', 'Nafta']

const empty = () => ({
  id: genId(), fecha: todayISO(), litros: '', importe: '', km: '', proveedor: '', tipo: 'Gasoil',
  vehiculo_id: '',
})

function consumoColor(c) {
  if (c == null) return 'var(--text-3)'
  if (c <= CONSUMO_BUENO)  return 'var(--positive)'
  if (c <= CONSUMO_NORMAL) return 'var(--warning)'
  return 'var(--danger)'
}

function consumoBg(c) {
  if (c == null) return { bg: 'var(--bg-overlay)', color: 'var(--text-3)' }
  if (c <= CONSUMO_BUENO)  return { bg: 'var(--positive-dim)', color: 'var(--positive)' }
  if (c <= CONSUMO_NORMAL) return { bg: 'var(--warning-dim)',  color: 'var(--warning)' }
  return { bg: 'var(--danger-dim)', color: 'var(--danger)' }
}

function getPrecioLitro(r) {
  const imp = parseFloat(r.importe)
  const lit = parseFloat(r.litros)
  if (imp > 0 && lit > 0) return imp / lit
  return null
}

function Combustible() {
  const { data, update } = useStore()
  const ct = useChartTheme()
  const list   = (data.combustible || []).filter(r =>
    r.fecha || r.litros || r.km || r.total || r.importe
  )
  const [modal, setModal]   = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm]     = useState(empty())
  const [errors, setErrors] = useState({})

  const { puedeEditar } = useAuth()
  const editable = puedeEditar('combustible')
  const { addToast } = useToast()
  const confirmar = useConfirm()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Opciones preservando valores legacy y el vehículo asignado aunque esté
  // archivado (ver utils/form.js).
  const tiposOpciones = useMemo(() => conValorActual(TIPOS, form.tipo), [form.tipo])
  const vehiculosOpciones = useMemo(
    () => vehiculosSeleccionables(data.vehiculos, form.vehiculo_id),
    [data.vehiculos, form.vehiculo_id]
  )

  const validate = () => {
    const e = {}
    if (!form.fecha)                     e.fecha   = 'Requerido'
    if (!form.litros || isNaN(form.litros)) e.litros = 'Requerido'
    if (!form.importe || isNaN(form.importe)) e.importe = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const openNew = () => { setEditId(null); setForm(empty()); setErrors({}); setModal(true) }

  // La fila de la tabla trae `consumo` (derivado en memoria, no es columna):
  // hay que sacarlo antes de que entre al form o el UPDATE lo rebota entero.
  // `...empty()` primero para que las filas viejas sin `vehiculo_id` tengan la
  // clave definida, y null → '' para que los inputs queden controlados.
  const openEdit = (r) => {
    const { consumo, ...fila } = r
    setEditId(fila.id)
    setForm({
      ...empty(),
      ...Object.fromEntries(Object.entries(fila).map(([k, v]) => [k, v ?? ''])),
      fecha: toISO(fila.fecha),
    })
    setErrors({})
    setModal(true)
  }

  const handleSave = () => {
    if (!validate()) return
    // vehiculo_id es uuid: el Select manda '' en "Sin asignar" y Postgres lo
    // rechaza; uuid vacío se representa con NULL (mismo bug que tenía Viajes).
    const registro = { ...form, fecha: toISO(form.fecha), vehiculo_id: form.vehiculo_id || null }
    if (editId) update('combustible', list.map(r => r.id === editId ? registro : r))
    else        update('combustible', [registro, ...list])
    setModal(false)
  }

  const handleDelete = async id => {
    const registro = list.find(r => r.id === id)
    if (!registro) return
    const ok = await confirmar({
      titulo: 'Eliminar carga',
      mensaje: `Se elimina la carga del ${formatDate(registro.fecha)}${registro.litros ? ` (${parseFloat(registro.litros).toFixed(1)} L)` : ''}.`,
    })
    if (!ok) return
    update('combustible', list.filter(r => r.id !== id))
    addToast({
      message: 'Carga eliminada.',
      Icon: Trash2,
      color: 'var(--danger)',
      duration: 6000,
      action: { label: 'Deshacer', onClick: () => update('combustible', [registro, ...(getData().combustible || [])]) },
    })
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

  const totalMes    = list.reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
  const litrosMes   = list.reduce((s, r) => s + (parseFloat(r.litros)  || 0), 0)
  const pricedRows  = list.filter(r => parseFloat(r.importe) > 0 && parseFloat(r.litros) > 0)
  const precioPromedio = pricedRows.length > 0
    ? pricedRows.reduce((s, r) => s + (getPrecioLitro(r) || 0), 0) / pricedRows.length : 0
  const consumoValidos   = withConsumo.filter(r => r.consumo != null)
  const consumoPromedio  = consumoValidos.length > 0
    ? consumoValidos.reduce((s, r) => s + r.consumo, 0) / consumoValidos.length : null

  const barData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d   = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const importe = list.filter(r => fechaMes(r.fecha) === key).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
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
    { label: 'Gasto total',     value: formatARS(totalMes),                                                            color: ACCENT },
    { label: 'Litros total',    value: `${litrosMes.toFixed(1)} L`,                                                    color: 'var(--positive)' },
    { label: 'Precio prom./L',  value: formatARS(precioPromedio),                                                      color: 'var(--warning)' },
    { label: 'Consumo prom.',   value: consumoPromedio != null ? `${consumoPromedio.toFixed(1)} L/100km` : '—',        color: consumoPromedio != null ? consumoColor(consumoPromedio) : 'var(--text-3)' },
  ]

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Fuel size={18} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="mod-h1">Combustible</h1>
            <p className="mod-sub">Historial de cargas y análisis de consumo</p>
          </div>
        </div>
        {editable && (
          <button className="glass-btn-primary" onClick={openNew}>
            <Plus size={15} /> Nueva carga
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`surface surface-hover db-in db-d${i + 1}`}
            style={{ padding: '18px 20px 18px 24px', position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', top: 12, bottom: 12, left: 0, width: 3, borderRadius: '0 3px 3px 0', background: s.color, opacity: 0.75 }} />
            <p className="db-slabel" style={{ marginBottom: 8 }}>{s.label}</p>
            <div className="num" style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
        <div className="surface db-in db-d5" style={{ padding: 20 }}>
          <p className="db-slabel">Gasto mensual · últimos 6 meses</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: ct.tickColor, fontSize: 11, fontFamily: MONO }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: ct.tickColor, fontSize: 10, fontFamily: MONO }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} width={40} />
              <Tooltip {...ct.tooltip} formatter={v => [formatARS(v), 'Gasto']} />
              <Bar dataKey="importe" fill={ct.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="surface db-in db-d6" style={{ padding: 20 }}>
          <p className="db-slabel">Evolución del precio por litro</p>
          {lineData.length < 2 ? (
            <div className="db-empty">Cargá al menos 2 registros para ver la evolución</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={lineData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} vertical={false} />
                <XAxis dataKey="fecha" tick={{ fill: ct.tickColor, fontSize: 10, fontFamily: MONO }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: ct.tickColor, fontSize: 10, fontFamily: MONO }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} width={48} />
                <Tooltip {...ct.tooltip} formatter={v => [formatARS(v), '$/litro']} />
                <Line type="monotone" dataKey="precio" stroke={ct.warning} strokeWidth={2} dot={{ r: 3, fill: ct.warning, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Historial ── */}
      <div className="surface db-in db-d7" style={{ padding: 20 }}>
        <p className="db-slabel">Historial de cargas</p>
        {withConsumo.length === 0 ? (
          <div className="db-empty">Sin registros aún</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-base)' }}>
                  {['Fecha', 'KM', 'Litros', 'Importe', '$/Litro', 'L/100km', ''].map(h => (
                    <th key={h} className={`pb-3 pt-3 px-3 text-xs font-semibold uppercase tracking-wider ${h === '' ? '' : 'text-left'}`} style={{ color: 'var(--text-2)', fontFamily: MONO }}>
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
                      className="table-row"
                      style={{ borderTop: '1px solid var(--border)' }}
                    >
                      <td className="py-3 px-3" style={{ color: 'var(--text-1)' }}>{formatDate(r.fecha)}</td>
                      <td className="py-3 px-3 text-right num" style={{ color: 'var(--text-2)', fontSize: 12 }}>
                        {r.km ? Number(r.km).toLocaleString('es-AR') : '—'}
                      </td>
                      <td className="py-3 px-3 text-right num" style={{ color: 'var(--text-2)', fontSize: 12 }}>
                        {r.litros ? `${parseFloat(r.litros).toFixed(1)} L` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold num" style={{ color: ACCENT, fontSize: 12 }}>
                        {r.importe ? formatARS(r.importe) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right num" style={{ color: 'var(--text-2)', fontSize: 12 }}>
                        {precio && isFinite(precio) ? formatARS(precio) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {r.consumo != null ? (
                          <span className="text-xs font-semibold num px-2 py-0.5 rounded-full" style={{ background: bg, color }}>
                            {r.consumo.toFixed(1)}
                          </span>
                        ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </td>
                      <td className="py-3 px-3">
                        {editable && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEdit(r)}
                              className="icon-btn"
                              aria-label={`Editar carga del ${formatDate(r.fecha)}`}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(r.id)}
                              className="icon-btn icon-btn-danger"
                              aria-label={`Eliminar carga del ${formatDate(r.fecha)}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {modal && (
        <Modal title={editId ? 'Editar carga' : 'Nueva carga de combustible'} onClose={() => setModal(false)}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Vehículo">
              <Select value={form.vehiculo_id || ''} onChange={e => set('vehiculo_id', e.target.value)}>
                <option value="">— Sin asignar —</option>
                {vehiculosOpciones.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.alias || v.patente || 'Vehículo'}{v.activo === false ? ' (archivado)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fecha" required>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
              {errors.fecha && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.fecha}</p>}
            </Field>
            <Field label="KM actual">
              <Input type="number" value={form.km} onChange={e => set('km', e.target.value)} placeholder="Ej: 150000" />
            </Field>
            <Field label="Litros cargados" required>
              <Input type="number" step="0.01" value={form.litros} onChange={e => set('litros', e.target.value)} placeholder="0.00" />
              {errors.litros && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.litros}</p>}
            </Field>
            <Field label="Importe ($)" required>
              <Input type="number" step="0.01" value={form.importe} onChange={e => set('importe', e.target.value)} placeholder="0.00" />
              {errors.importe && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.importe}</p>}
            </Field>
            <div className="col-span-2">
              <Field label="Tipo de combustible">
                <Select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                  {tiposOpciones.map(t => <option key={t}>{t}</option>)}
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
