import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId } from '../utils/format'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea } from '../components/shared/Field'
import { Truck, Plus, Trash2 } from 'lucide-react'

const TIPOS = ['Excursión', 'Traslado', 'Turismo', 'Charter', 'Escolar', 'Corporativo', 'Otro']
const ESTADOS = ['Pendiente', 'Confirmado', 'Realizado', 'Cancelado']

const ESTADO_BG = {
  Pendiente: 'rgba(234,179,8,0.18)',
  Confirmado: 'rgba(59,130,246,0.18)',
  Realizado: 'rgba(34,197,94,0.18)',
  Cancelado: 'rgba(239,68,68,0.18)',
}

const ESTADO_COLOR = {
  Pendiente: '#facc15',
  Confirmado: '#60a5fa',
  Realizado: '#4ade80',
  Cancelado: '#f87171',
}

const empty = () => ({
  id: genId(),
  fecha: todayISO(),
  cliente: '',
  tipo: 'Excursión',
  origen: '',
  destino: '',
  monto_sena: '',
  monto_total: '',
  estado: 'Pendiente',
  notas: '',
})

function EstadoBadge({ estado, id, onChange }) {
  const bg = ESTADO_BG[estado] || 'rgba(100,100,100,0.18)'
  const color = ESTADO_COLOR[estado] || '#9ca3af'
  return (
    <select
      value={estado}
      onChange={e => onChange(id, e.target.value)}
      style={{
        background: bg,
        color,
        border: 'none',
        outline: 'none',
        borderRadius: '9999px',
        padding: '2px 10px',
        fontSize: '11px',
        fontWeight: '700',
        cursor: 'pointer',
        letterSpacing: '0.02em',
      }}
    >
      {ESTADOS.map(e => (
        <option key={e} value={e} style={{ background: '#1E1E2E', color: '#e2e8f0' }}>{e}</option>
      ))}
    </select>
  )
}

export default function Viajes() {
  const { data, update } = useStore()
  const list = data.viajes || []
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty())
  const [errors, setErrors] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.cliente.trim()) e.cliente = 'Requerido'
    if (!form.origen.trim()) e.origen = 'Requerido'
    if (!form.destino.trim()) e.destino = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const openNew = () => { setForm(empty()); setErrors({}); setModal(true) }

  const handleSave = () => {
    if (!validate()) return
    update('viajes', [{ ...form }, ...list])
    setModal(false)
  }

  const handleDelete = id => {
    if (confirm('¿Eliminar este viaje?')) update('viajes', list.filter(r => r.id !== id))
  }

  const handleEstado = (id, estado) => {
    update('viajes', list.map(r => r.id === id ? { ...r, estado } : r))
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return list
      .filter(r => {
        const matchQ = !q ||
          r.cliente?.toLowerCase().includes(q) ||
          r.tipo?.toLowerCase().includes(q) ||
          r.estado?.toLowerCase().includes(q)
        const matchEstado = !estadoFilter || r.estado === estadoFilter
        return matchQ && matchEstado
      })
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
  }, [list, search, estadoFilter])

  const totalEsperado = list
    .filter(r => r.estado === 'Pendiente' || r.estado === 'Confirmado')
    .reduce((s, r) => s + (parseFloat(r.monto_total) || 0), 0)

  const totalConfirmado = list
    .filter(r => r.estado === 'Confirmado')
    .reduce((s, r) => s + (parseFloat(r.monto_total) || 0), 0)

  const totalRealizado = list
    .filter(r => r.estado === 'Realizado')
    .reduce((s, r) => s + (parseFloat(r.monto_total) || 0), 0)

  const cols = [
    { key: 'fecha', label: 'Fecha', render: r => formatDate(r.fecha) },
    { key: 'cliente', label: 'Cliente', render: r => <span className="font-semibold text-white">{r.cliente}</span> },
    { key: 'tipo', label: 'Tipo' },
    { key: 'origen', label: 'Origen' },
    { key: 'destino', label: 'Destino' },
    { key: 'monto_sena', label: 'Monto seña', render: r => r.monto_sena ? formatARS(r.monto_sena) : <span className="text-gray-600">—</span> },
    { key: 'monto_total', label: 'Monto total', render: r => r.monto_total ? <span style={{ color: '#4A8FD4' }}>{formatARS(r.monto_total)}</span> : <span className="text-gray-600">—</span> },
    { key: 'estado', label: 'Estado', render: r => <EstadoBadge estado={r.estado} id={r.id} onChange={handleEstado} /> },
    {
      key: 'acciones', label: '', render: r => (
        <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-red-500/20 text-red-400">
          <Trash2 size={15} />
        </button>
      )
    },
  ]

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(74,143,212,0.2)' }}>
            <Truck size={20} style={{ color: '#4A8FD4' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>VIAJES</h1>
            <p className="text-xs text-gray-500">Gestión de viajes y traslados</p>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#4A8FD4' }}>
          <Plus size={16} /> Nuevo viaje
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
          <div className="text-xs text-gray-500 mb-1">Ingresos esperados</div>
          <div className="text-xl font-bold text-yellow-400">{formatARS(totalEsperado)}</div>
          <div className="text-xs text-gray-600 mt-1">Pendientes + Confirmados</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
          <div className="text-xs text-gray-500 mb-1">Confirmados</div>
          <div className="text-xl font-bold" style={{ color: '#4A8FD4' }}>{formatARS(totalConfirmado)}</div>
          <div className="text-xs text-gray-600 mt-1">{list.filter(r => r.estado === 'Confirmado').length} viajes</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
          <div className="text-xs text-gray-500 mb-1">Realizados</div>
          <div className="text-xl font-bold text-green-400">{formatARS(totalRealizado)}</div>
          <div className="text-xs text-gray-600 mt-1">{list.filter(r => r.estado === 'Realizado').length} viajes</div>
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-xl p-5" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar por cliente, tipo, estado..." />
          </div>
          <select
            value={estadoFilter}
            onChange={e => setEstadoFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm text-gray-300"
            style={{ background: '#252535', border: '1px solid #2E2E42' }}
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <Table columns={cols} data={filtered} emptyText="Sin viajes registrados" />
      </div>

      {/* Modal */}
      {modal && (
        <Modal title="Nuevo viaje" onClose={() => setModal(false)} size="lg">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha">
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </Field>
            <Field label="Tipo de viaje">
              <Select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Cliente" required>
              <Input value={form.cliente} onChange={e => set('cliente', e.target.value)} placeholder="Nombre del cliente o grupo" />
              {errors.cliente && <p className="text-red-400 text-xs mt-1">{errors.cliente}</p>}
            </Field>
            <Field label="Estado">
              <Select value={form.estado} onChange={e => set('estado', e.target.value)}>
                {ESTADOS.map(e => <option key={e}>{e}</option>)}
              </Select>
            </Field>
            <Field label="Origen" required>
              <Input value={form.origen} onChange={e => set('origen', e.target.value)} placeholder="Ciudad / Punto de salida" />
              {errors.origen && <p className="text-red-400 text-xs mt-1">{errors.origen}</p>}
            </Field>
            <Field label="Destino" required>
              <Input value={form.destino} onChange={e => set('destino', e.target.value)} placeholder="Ciudad / Punto de llegada" />
              {errors.destino && <p className="text-red-400 text-xs mt-1">{errors.destino}</p>}
            </Field>
            <Field label="Monto seña ($)">
              <Input type="number" step="0.01" min="0" value={form.monto_sena} onChange={e => set('monto_sena', e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Monto total ($)">
              <Input type="number" step="0.01" min="0" value={form.monto_total} onChange={e => set('monto_total', e.target.value)} placeholder="0.00" />
            </Field>
            <div className="col-span-2">
              <Field label="Notas">
                <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Observaciones adicionales..." />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/10">Cancelar</button>
            <button onClick={handleSave} className="px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#4A8FD4' }}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
