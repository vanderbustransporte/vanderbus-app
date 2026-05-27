import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId } from '../utils/format'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea, BtnPrimary, BtnCancel } from '../components/shared/Field'
import { DollarSign, Plus, Trash2 } from 'lucide-react'

const CONCEPTOS = ['Sueldo mensual', 'Horas extra', 'Aguinaldo', 'Vacaciones', 'Bono', 'Anticipo', 'Liquidación', 'Otro']

const empty = () => ({
  id: genId(), fecha: todayISO(), empleado: '', concepto: 'Sueldo mensual',
  importe: '', periodo: '', metodo: 'Efectivo', notas: ''
})

export default function Nomina() {
  const { data, update } = useStore()
  const list = data.nomina || []
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty())
  const [errors, setErrors] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.fecha) e.fecha = 'Requerido'
    if (!form.empleado) e.empleado = 'Requerido'
    if (!form.importe || isNaN(form.importe)) e.importe = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    update('nomina', [{ ...form }, ...list])
    setModal(false)
    setForm(empty())
  }

  const handleDelete = id => {
    if (confirm('¿Eliminar este pago?')) update('nomina', list.filter(r => r.id !== id))
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return list
      .filter(r => !q || r.empleado?.toLowerCase().includes(q) || r.concepto?.toLowerCase().includes(q))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [list, search])

  const totalMes = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7)
    return list.filter(r => r.fecha?.startsWith(mes)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
  }, [list])

  const empleados = useMemo(() => [...new Set(list.map(r => r.empleado).filter(Boolean))], [list])

  const cols = [
    { key: 'fecha', label: 'Fecha', render: r => formatDate(r.fecha) },
    { key: 'empleado', label: 'Empleado', render: r => <span className="font-semibold" style={{ color: '#1A202C' }}>{r.empleado}</span> },
    { key: 'concepto', label: 'Concepto' },
    { key: 'periodo', label: 'Período', render: r => r.periodo || '—' },
    { key: 'importe', label: 'Importe', render: r => <span className="font-semibold" style={{ color: '#3D8FD1' }}>{formatARS(r.importe)}</span> },
    { key: 'metodo', label: 'Método', render: r => r.metodo || '—' },
    {
      key: 'acciones', label: '', render: r => (
        <button
          onClick={() => handleDelete(r.id)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: '#EF4444' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '' }}
        >
          <Trash2 size={14} />
        </button>
      )
    }
  ]

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(61,143,209,0.2)' }}>
            <DollarSign size={20} style={{ color: '#3D8FD1' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#FFFFFF', fontFamily: "'Inter', sans-serif" }}>Nómina</h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>Pagos de sueldos y haberes</p>
          </div>
        </div>
        <button
          onClick={() => { setForm(empty()); setErrors({}); setModal(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'rgba(61,143,209,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 4px 15px rgba(61,143,209,0.3)', borderRadius: '10px' }}
        >
          <Plus size={16} /> Registrar pago
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 glass">
          <div className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Pagado este mes</div>
          <div className="text-xl font-bold" style={{ color: '#3D8FD1' }}>{formatARS(totalMes)}</div>
        </div>
        <div className="p-4 glass">
          <div className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Empleados</div>
          <div className="text-xl font-bold" style={{ color: '#1A202C' }}>{empleados.length}</div>
        </div>
      </div>

      {/* Table */}
      <div className="p-5 glass">
        <div className="flex flex-wrap gap-3 mb-4">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar empleado, concepto..." />
        </div>
        <Table columns={cols} data={filtered} emptyText="Sin pagos registrados" />
      </div>

      {modal && (
        <Modal title="Registrar pago de nómina" onClose={() => setModal(false)}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha" required>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
              {errors.fecha && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.fecha}</p>}
            </Field>
            <Field label="Concepto">
              <Select value={form.concepto} onChange={e => set('concepto', e.target.value)}>
                {CONCEPTOS.map(c => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <div className="col-span-2">
              <Field label="Empleado" required>
                <Input value={form.empleado} onChange={e => set('empleado', e.target.value)} placeholder="Nombre del empleado" list="empleados-list" />
                <datalist id="empleados-list">{empleados.map(e => <option key={e} value={e} />)}</datalist>
                {errors.empleado && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.empleado}</p>}
              </Field>
            </div>
            <Field label="Importe ($)" required>
              <Input type="number" step="0.01" value={form.importe} onChange={e => set('importe', e.target.value)} placeholder="0.00" />
              {errors.importe && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.importe}</p>}
            </Field>
            <Field label="Período">
              <Input value={form.periodo} onChange={e => set('periodo', e.target.value)} placeholder="Ej: Mayo 2026" />
            </Field>
            <Field label="Método de pago">
              <Select value={form.metodo} onChange={e => set('metodo', e.target.value)}>
                <option>Efectivo</option><option>Transferencia</option><option>Cheque</option>
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
