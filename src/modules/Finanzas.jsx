import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId } from '../utils/format'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea, BtnCancel } from '../components/shared/Field'
import { TrendingUp, Plus, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

const CATEGORIAS_INGRESO = ['Servicio de transporte', 'Flete', 'Alquiler de vehículo', 'Otro ingreso']
const CATEGORIAS_GASTO = ['Combustible', 'Mantenimiento', 'Nómina', 'Seguro', 'Impuestos y tasas', 'Peajes', 'Administrativo', 'Otro gasto']

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  borderRadius: '12px',
}

const emptyIngreso = () => ({ id: genId(), tipo: 'ingreso', fecha: todayISO(), descripcion: '', categoria: 'Servicio de transporte', importe: '', cliente: '', comprobante: '', notas: '' })
const emptyGasto = () => ({ id: genId(), tipo: 'gasto', fecha: todayISO(), descripcion: '', categoria: 'Combustible', importe: '', proveedor: '', comprobante: '', notas: '' })

function MovimientoModal({ onClose, onSave, tipo }) {
  const { data } = useStore()
  const contactos = data.contactos || []
  const clientes = contactos.filter(c => c.tipo === 'Cliente').map(c => c.nombre)
  const proveedores = contactos.filter(c => c.tipo === 'Proveedor').map(c => c.nombre)

  const [form, setForm] = useState(tipo === 'ingreso' ? emptyIngreso() : emptyGasto())
  const [errors, setErrors] = useState({})
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.fecha) e.fecha = 'Requerido'
    if (!form.descripcion) e.descripcion = 'Requerido'
    if (!form.importe || isNaN(form.importe)) e.importe = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const categorias = tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO
  const isIngreso = tipo === 'ingreso'

  return (
    <Modal title={isIngreso ? 'Nuevo ingreso' : 'Nuevo gasto'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Fecha" required>
          <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
          {errors.fecha && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.fecha}</p>}
        </Field>
        <Field label="Categoría">
          <Select value={form.categoria} onChange={e => set('categoria', e.target.value)}>
            {categorias.map(c => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="Descripción" required>
            <Input
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              placeholder={isIngreso ? 'Ej: Flete Rosario-CABA' : 'Ej: Reparación frenos'}
            />
            {errors.descripcion && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.descripcion}</p>}
          </Field>
        </div>
        <Field label="Importe ($)" required>
          <Input type="number" step="0.01" value={form.importe} onChange={e => set('importe', e.target.value)} placeholder="0.00" />
          {errors.importe && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.importe}</p>}
        </Field>
        <Field label={isIngreso ? 'Cliente' : 'Proveedor'}>
          {isIngreso ? (
            <>
              <Input value={form.cliente} onChange={e => set('cliente', e.target.value)} list="clientes-list" />
              <datalist id="clientes-list">{clientes.map(c => <option key={c} value={c} />)}</datalist>
            </>
          ) : (
            <>
              <Input value={form.proveedor} onChange={e => set('proveedor', e.target.value)} list="proveedores-list" />
              <datalist id="proveedores-list">{proveedores.map(c => <option key={c} value={c} />)}</datalist>
            </>
          )}
        </Field>
        <Field label="N° Comprobante / Factura">
          <Input value={form.comprobante} onChange={e => set('comprobante', e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Field label="Notas">
            <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <BtnCancel onClick={onClose} />
        <button
          onClick={() => { if (validate()) onSave(form) }}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: isIngreso ? '#16A34A' : '#DC2626', borderRadius: '8px' }}
        >
          Guardar {isIngreso ? 'ingreso' : 'gasto'}
        </button>
      </div>
    </Modal>
  )
}

export default function Finanzas() {
  const { data, update } = useStore()
  const ingresos = data.ingresos || []
  const gastos = data.gastos || []
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('todos')
  const [modal, setModal] = useState(null)

  const all = useMemo(() =>
    [...ingresos.map(r => ({ ...r, tipo: 'ingreso' })), ...gastos.map(r => ({ ...r, tipo: 'gasto' }))]
      .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')),
    [ingresos, gastos])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return all
      .filter(r => tab === 'todos' || r.tipo === tab)
      .filter(r => !q || r.descripcion?.toLowerCase().includes(q) || r.categoria?.toLowerCase().includes(q))
  }, [all, search, tab])

  const mesActual = new Date().toISOString().slice(0, 7)
  const totalIngresosMes = ingresos.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
  const totalGastosMes = gastos.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
  const balance = totalIngresosMes - totalGastosMes

  const handleSave = (form) => {
    if (form.tipo === 'ingreso') update('ingresos', [form, ...ingresos])
    else update('gastos', [form, ...gastos])
    setModal(null)
  }

  const handleDelete = r => {
    if (!confirm('¿Eliminar este movimiento?')) return
    if (r.tipo === 'ingreso') update('ingresos', ingresos.filter(x => x.id !== r.id))
    else update('gastos', gastos.filter(x => x.id !== r.id))
  }

  const cols = [
    { key: 'fecha', label: 'Fecha', render: r => formatDate(r.fecha) },
    {
      key: 'tipo', label: 'Tipo', render: r => (
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={
            r.tipo === 'ingreso'
              ? { background: 'rgba(34,197,94,0.12)', color: '#16A34A' }
              : { background: 'rgba(239,68,68,0.1)', color: '#DC2626' }
          }
        >
          {r.tipo === 'ingreso' ? '▲ Ingreso' : '▼ Gasto'}
        </span>
      )
    },
    { key: 'categoria', label: 'Categoría' },
    { key: 'descripcion', label: 'Descripción', render: r => <span className="max-w-xs truncate block">{r.descripcion}</span> },
    {
      key: 'importe', label: 'Importe', render: r => (
        <span className="font-bold" style={{ color: r.tipo === 'ingreso' ? '#16A34A' : '#DC2626' }}>
          {r.tipo === 'ingreso' ? '+' : '−'}{formatARS(r.importe)}
        </span>
      )
    },
    {
      key: 'acciones', label: '', render: r => (
        <button
          onClick={() => handleDelete(r)}
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
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(61,143,209,0.1)' }}>
            <TrendingUp size={20} style={{ color: '#3D8FD1' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1A202C', fontFamily: "'Inter', sans-serif" }}>Finanzas</h1>
            <p className="text-xs" style={{ color: '#64748B' }}>Ingresos y gastos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModal('ingreso')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: '#16A34A', borderRadius: '8px' }}
          >
            <ArrowUpCircle size={16} /> Ingreso
          </button>
          <button
            onClick={() => setModal('gasto')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: '#DC2626', borderRadius: '8px' }}
          >
            <ArrowDownCircle size={16} /> Gasto
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-xl" style={cardStyle}>
          <div className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Ingresos del mes</div>
          <div className="text-xl font-bold" style={{ color: '#16A34A' }}>{formatARS(totalIngresosMes)}</div>
        </div>
        <div className="p-4 rounded-xl" style={cardStyle}>
          <div className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Gastos del mes</div>
          <div className="text-xl font-bold" style={{ color: '#DC2626' }}>{formatARS(totalGastosMes)}</div>
        </div>
        <div
          className="p-4 rounded-xl"
          style={{
            ...cardStyle,
            background: balance >= 0 ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
            border: balance >= 0 ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(239,68,68,0.2)',
          }}
        >
          <div className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Balance neto</div>
          <div className="text-xl font-bold" style={{ color: balance >= 0 ? '#16A34A' : '#DC2626' }}>{formatARS(balance)}</div>
        </div>
      </div>

      {/* Table card */}
      <div className="p-5 rounded-xl" style={cardStyle}>
        <div className="flex flex-wrap gap-3 mb-4">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar descripción, categoría..." />
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
            {[['todos', 'Todos'], ['ingreso', 'Ingresos'], ['gasto', 'Gastos']].map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setTab(val)}
                className="px-3 py-2 text-sm font-medium transition-colors"
                style={
                  tab === val
                    ? { background: '#3D8FD1', color: '#FFFFFF' }
                    : { background: '#F8FAFC', color: '#64748B' }
                }
                onMouseEnter={e => { if (tab !== val) e.currentTarget.style.background = '#F0F4F8' }}
                onMouseLeave={e => { if (tab !== val) e.currentTarget.style.background = '#F8FAFC' }}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <Table columns={cols} data={filtered} emptyText="Sin movimientos registrados" />
      </div>

      {modal && <MovimientoModal tipo={modal} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  )
}
