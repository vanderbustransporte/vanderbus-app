import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId } from '../utils/format'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea } from '../components/shared/Field'
import { TrendingUp, Plus, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

const CATEGORIAS_INGRESO = ['Servicio de transporte', 'Flete', 'Alquiler de vehículo', 'Otro ingreso']
const CATEGORIAS_GASTO = ['Combustible', 'Mantenimiento', 'Nómina', 'Seguro', 'Impuestos y tasas', 'Peajes', 'Administrativo', 'Otro gasto']

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

  return (
    <Modal title={tipo === 'ingreso' ? 'Nuevo ingreso' : 'Nuevo gasto'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Fecha" required>
          <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
          {errors.fecha && <p className="text-red-400 text-xs mt-1">{errors.fecha}</p>}
        </Field>
        <Field label="Categoría">
          <Select value={form.categoria} onChange={e => set('categoria', e.target.value)}>
            {categorias.map(c => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="Descripción" required>
            <Input value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder={tipo === 'ingreso' ? 'Ej: Flete Rosario-CABA' : 'Ej: Reparación frenos'} />
            {errors.descripcion && <p className="text-red-400 text-xs mt-1">{errors.descripcion}</p>}
          </Field>
        </div>
        <Field label="Importe ($)" required>
          <Input type="number" step="0.01" value={form.importe} onChange={e => set('importe', e.target.value)} placeholder="0.00" />
          {errors.importe && <p className="text-red-400 text-xs mt-1">{errors.importe}</p>}
        </Field>
        <Field label={tipo === 'ingreso' ? 'Cliente' : 'Proveedor'}>
          {tipo === 'ingreso' ? (
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
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/10">Cancelar</button>
        <button onClick={() => { if (validate()) onSave(form) }}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: tipo === 'ingreso' ? '#22c55e' : '#ef4444' }}>
          Guardar {tipo === 'ingreso' ? 'ingreso' : 'gasto'}
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

  const all = useMemo(() => [...ingresos.map(r => ({ ...r, tipo: 'ingreso' })), ...gastos.map(r => ({ ...r, tipo: 'gasto' }))].sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')), [ingresos, gastos])

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
    if (form.tipo === 'ingreso') {
      update('ingresos', [form, ...ingresos])
    } else {
      update('gastos', [form, ...gastos])
    }
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
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.tipo === 'ingreso' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {r.tipo === 'ingreso' ? '▲ INGRESO' : '▼ GASTO'}
        </span>
      )
    },
    { key: 'categoria', label: 'Categoría' },
    { key: 'descripcion', label: 'Descripción', render: r => <span className="max-w-xs truncate block">{r.descripcion}</span> },
    {
      key: 'importe', label: 'Importe', render: r => (
        <span className={`font-bold ${r.tipo === 'ingreso' ? 'text-green-400' : 'text-red-400'}`}>
          {r.tipo === 'ingreso' ? '+' : '-'}{formatARS(r.importe)}
        </span>
      )
    },
    {
      key: 'acciones', label: '', render: r => (
        <button onClick={() => handleDelete(r)} className="p-1 rounded hover:bg-red-500/20 text-red-400"><Trash2 size={15} /></button>
      )
    }
  ]

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(74,143,212,0.2)' }}>
            <TrendingUp size={20} style={{ color: '#4A8FD4' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>FINANZAS</h1>
            <p className="text-xs text-gray-500">Ingresos y gastos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModal('ingreso')} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700">
            <ArrowUpCircle size={16} /> Ingreso
          </button>
          <button onClick={() => setModal('gasto')} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700">
            <ArrowDownCircle size={16} /> Gasto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
          <div className="text-xs text-gray-500 mb-1">Ingresos del mes</div>
          <div className="text-xl font-bold text-green-400">{formatARS(totalIngresosMes)}</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
          <div className="text-xs text-gray-500 mb-1">Gastos del mes</div>
          <div className="text-xl font-bold text-red-400">{formatARS(totalGastosMes)}</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: balance >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: '1px solid #2E2E42' }}>
          <div className="text-xs text-gray-500 mb-1">Balance neto</div>
          <div className={`text-xl font-bold ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatARS(balance)}</div>
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
        <div className="flex flex-wrap gap-3 mb-4">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar descripción, categoría..." />
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #2E2E42' }}>
            {[['todos', 'Todos'], ['ingreso', 'Ingresos'], ['gasto', 'Gastos']].map(([val, lbl]) => (
              <button key={val} onClick={() => setTab(val)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${tab === val ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                style={tab === val ? { background: '#4A8FD4' } : { background: '#252535' }}>
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
