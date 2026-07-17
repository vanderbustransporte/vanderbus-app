import React, { useState, useMemo } from 'react'
import { useStore, getData } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId } from '../utils/format'
import { toISO, fechaMes } from '../utils/fecha'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea, BtnPrimary, BtnCancel } from '../components/shared/Field'
import { Users, Plus, Trash2, Edit2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { conValorActual } from '../utils/form'

const ACCENT = 'var(--accent)'

const CONCEPTOS = ['Sueldo mensual', 'Horas extra', 'Aguinaldo', 'Vacaciones', 'Bono', 'Anticipo', 'Liquidación', 'Otro']
const METODOS   = ['Efectivo', 'Transferencia', 'Cheque']

const empty = () => ({
  id: genId(), fecha: todayISO(), empleado: '', concepto: 'Sueldo mensual',
  importe: '', periodo: '', metodo: 'Efectivo', notas: ''
})

export default function Nomina() {
  const { data, update } = useStore()
  const list = (data.nomina || []).filter(r =>
    r.empleado || r.concepto || r.importe
  )
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm]     = useState(empty())
  const [errors, setErrors] = useState({})

  const { puedeEditar } = useAuth()
  const editable = puedeEditar('nomina')
  const { addToast } = useToast()
  const confirmar = useConfirm()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Opciones preservando valores legacy (ver utils/form.js): un concepto o
  // método fuera de la lista canónica no se pisa al editar.
  const conceptosOpciones = useMemo(() => conValorActual(CONCEPTOS, form.concepto), [form.concepto])
  const metodosOpciones   = useMemo(() => conValorActual(METODOS, form.metodo), [form.metodo])

  const validate = () => {
    const e = {}
    if (!form.fecha)                          e.fecha    = 'Requerido'
    if (!form.empleado)                       e.empleado = 'Requerido'
    if (!form.importe || isNaN(form.importe)) e.importe  = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const openNew = () => { setEditId(null); setForm(empty()); setErrors({}); setModal(true) }

  // `...empty()` primero para que las filas viejas tengan todas las claves
  // definidas, null → '' para inputs controlados, y fecha normalizada a ISO
  // (el <input type="date"> rechaza otros formatos y borraría el dato).
  const openEdit = (r) => {
    setEditId(r.id)
    setForm({
      ...empty(),
      ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ''])),
      fecha: toISO(r.fecha),
    })
    setErrors({})
    setModal(true)
  }

  const handleSave = () => {
    if (!validate()) return
    const registro = { ...form, fecha: toISO(form.fecha) }
    if (editId) update('nomina', list.map(r => r.id === editId ? registro : r))
    else        update('nomina', [registro, ...list])
    setModal(false)
  }

  const handleDelete = async id => {
    const pago = list.find(r => r.id === id)
    if (!pago) return
    const ok = await confirmar({
      titulo: 'Eliminar pago',
      mensaje: `Se elimina el pago a ${pago.empleado || 'sin empleado'} del ${formatDate(pago.fecha)} (${formatARS(pago.importe)}).`,
    })
    if (!ok) return
    update('nomina', list.filter(r => r.id !== id))
    addToast({
      message: 'Pago eliminado.',
      Icon: Trash2,
      color: 'var(--danger)',
      duration: 6000,
      action: { label: 'Deshacer', onClick: () => update('nomina', [pago, ...(getData().nomina || [])]) },
    })
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return list
      .filter(r => !q || r.empleado?.toLowerCase().includes(q) || r.concepto?.toLowerCase().includes(q))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [list, search])

  const totalMes = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7)
    return list.filter(r => fechaMes(r.fecha) === mes).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
  }, [list])

  const empleados = useMemo(() => [...new Set(list.map(r => r.empleado).filter(Boolean))], [list])

  const cols = [
    { key: 'fecha',    label: 'Fecha',    render: r => formatDate(r.fecha) },
    { key: 'empleado', label: 'Empleado', render: r => <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{r.empleado}</span> },
    { key: 'concepto', label: 'Concepto' },
    { key: 'periodo',  label: 'Período',  render: r => r.periodo || <span style={{ color: 'var(--text-3)' }}>—</span> },
    { key: 'importe',  label: 'Importe',  render: r => <span className="num font-semibold" style={{ color: ACCENT }}>{formatARS(r.importe)}</span> },
    { key: 'metodo',   label: 'Método',   render: r => r.metodo || <span style={{ color: 'var(--text-3)' }}>—</span> },
    {
      key: 'acciones', label: '', render: r => editable ? (
        <div className="flex gap-1">
          <button
            onClick={() => openEdit(r)}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-2)' }}
            aria-label={`Editar pago a ${r.empleado || 'sin empleado'}`}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-tint-md)'; e.currentTarget.style.color = 'var(--text-1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-2)' }}
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleDelete(r.id)}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--danger)' }}
            aria-label={`Eliminar pago a ${r.empleado || 'sin empleado'}`}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-dim)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ) : null
    }
  ]

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={18} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="mod-h1">Nómina</h1>
            <p className="mod-sub">Pagos de sueldos y haberes</p>
          </div>
        </div>
        {editable && (
          <button className="glass-btn-primary" onClick={openNew}>
            <Plus size={15} /> Registrar pago
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
        {[
          { label: 'Pagado este mes', value: formatARS(totalMes),  color: ACCENT },
          { label: 'Empleados',       value: empleados.length,      color: 'var(--text-1)' },
        ].map((s, i) => (
          <div
            key={s.label}
            className={`surface surface-hover db-in db-d${i + 1}`}
            style={{ padding: '18px 20px 18px 24px', position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', top: 12, bottom: 12, left: 0, width: 3, borderRadius: '0 3px 3px 0', background: s.color === 'var(--text-1)' ? 'var(--chart-tick)' : s.color, opacity: 0.75 }} />
            <p className="db-slabel" style={{ marginBottom: 8 }}>{s.label}</p>
            <div className="num" style={{ fontSize: 19, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Tabla ── */}
      <div className="surface db-in db-d3" style={{ padding: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar empleado, concepto..." />
        </div>
        <Table columns={cols} data={filtered} emptyText="Sin pagos registrados" />
      </div>

      {modal && (
        <Modal title={editId ? 'Editar pago de nómina' : 'Registrar pago de nómina'} onClose={() => setModal(false)}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha" required>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
              {errors.fecha && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.fecha}</p>}
            </Field>
            <Field label="Concepto">
              <Select value={form.concepto} onChange={e => set('concepto', e.target.value)}>
                {conceptosOpciones.map(c => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <div className="col-span-2">
              <Field label="Empleado" required>
                <Input value={form.empleado} onChange={e => set('empleado', e.target.value)} placeholder="Nombre del empleado" list="empleados-list" />
                <datalist id="empleados-list">{empleados.map(e => <option key={e} value={e} />)}</datalist>
                {errors.empleado && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.empleado}</p>}
              </Field>
            </div>
            <Field label="Importe ($)" required>
              <Input type="number" step="0.01" value={form.importe} onChange={e => set('importe', e.target.value)} placeholder="0.00" />
              {errors.importe && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.importe}</p>}
            </Field>
            <Field label="Período">
              <Input value={form.periodo} onChange={e => set('periodo', e.target.value)} placeholder="Ej: Mayo 2026" />
            </Field>
            <Field label="Método de pago">
              <Select value={form.metodo} onChange={e => set('metodo', e.target.value)}>
                {metodosOpciones.map(m => <option key={m}>{m}</option>)}
              </Select>
            </Field>
            <div className="col-span-2">
              <Field label="Notas">
                <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} />
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
