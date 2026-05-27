import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId } from '../utils/format'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea, BtnPrimary, BtnCancel } from '../components/shared/Field'
import { MapPin, Plus, Trash2 } from 'lucide-react'

const TIPOS = ['Excursión', 'Traslado', 'Turismo', 'Charter', 'Escolar', 'Corporativo', 'Otro']
const ESTADOS = ['Pendiente', 'Confirmado', 'Realizado', 'Cancelado']

const ESTADO_STYLES = {
  Pendiente: { bg: 'rgba(217,119,6,0.1)', color: '#D97706' },
  Confirmado: { bg: 'rgba(61,143,209,0.1)', color: '#3D8FD1' },
  Realizado: { bg: 'rgba(34,197,94,0.1)', color: '#16A34A' },
  Cancelado: { bg: 'rgba(239,68,68,0.1)', color: '#DC2626' },
}

const empty = () => ({
  id: genId(), fecha: todayISO(), cliente: '', tipo: 'Excursión',
  origen: '', destino: '', monto_sena: '', monto_total: '', estado: 'Pendiente', notas: '',
})

function EstadoBadge({ estado, id, onChange }) {
  const s = ESTADO_STYLES[estado] || { bg: '#F8FAFC', color: '#64748B' }
  return (
    <select
      value={estado}
      onChange={e => onChange(id, e.target.value)}
      style={{
        background: s.bg,
        color: s.color,
        border: 'none',
        outline: 'none',
        borderRadius: '9999px',
        padding: '3px 10px',
        fontSize: '11px',
        fontWeight: '700',
        cursor: 'pointer',
      }}
    >
      {ESTADOS.map(e => (
        <option key={e} value={e} style={{ background: '#FFFFFF', color: '#1A202C' }}>{e}</option>
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
        const matchQ = !q || r.cliente?.toLowerCase().includes(q) || r.tipo?.toLowerCase().includes(q) || r.estado?.toLowerCase().includes(q)
        const matchEstado = !estadoFilter || r.estado === estadoFilter
        return matchQ && matchEstado
      })
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
  }, [list, search, estadoFilter])

  const totalEsperado = list.filter(r => r.estado === 'Pendiente' || r.estado === 'Confirmado').reduce((s, r) => s + (parseFloat(r.monto_total) || 0), 0)
  const totalConfirmado = list.filter(r => r.estado === 'Confirmado').reduce((s, r) => s + (parseFloat(r.monto_total) || 0), 0)
  const totalRealizado = list.filter(r => r.estado === 'Realizado').reduce((s, r) => s + (parseFloat(r.monto_total) || 0), 0)

  const cols = [
    { key: 'fecha', label: 'Fecha', render: r => formatDate(r.fecha) },
    { key: 'cliente', label: 'Cliente', render: r => <span className="font-semibold" style={{ color: '#1A202C' }}>{r.cliente}</span> },
    { key: 'tipo', label: 'Tipo' },
    { key: 'origen', label: 'Origen' },
    { key: 'destino', label: 'Destino' },
    {
      key: 'monto_sena', label: 'Seña',
      render: r => r.monto_sena ? formatARS(r.monto_sena) : <span style={{ color: '#CBD5E1' }}>—</span>
    },
    {
      key: 'monto_total', label: 'Total',
      render: r => r.monto_total
        ? <span className="font-semibold" style={{ color: '#3D8FD1' }}>{formatARS(r.monto_total)}</span>
        : <span style={{ color: '#CBD5E1' }}>—</span>
    },
    { key: 'estado', label: 'Estado', render: r => <EstadoBadge estado={r.estado} id={r.id} onChange={handleEstado} /> },
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
    },
  ]

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(61,143,209,0.2)' }}>
            <MapPin size={20} style={{ color: '#3D8FD1' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#FFFFFF', fontFamily: "'Inter', sans-serif" }}>Viajes</h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>Gestión de viajes y traslados</p>
          </div>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'rgba(61,143,209,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 4px 15px rgba(61,143,209,0.3)', borderRadius: '10px' }}
        >
          <Plus size={16} /> Nuevo viaje
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 glass">
          <div className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Ingresos esperados</div>
          <div className="text-xl font-bold" style={{ color: '#D97706' }}>{formatARS(totalEsperado)}</div>
          <div className="text-xs mt-1" style={{ color: '#64748B' }}>Pendientes + Confirmados</div>
        </div>
        <div className="p-4 glass">
          <div className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Confirmados</div>
          <div className="text-xl font-bold" style={{ color: '#3D8FD1' }}>{formatARS(totalConfirmado)}</div>
          <div className="text-xs mt-1" style={{ color: '#64748B' }}>{list.filter(r => r.estado === 'Confirmado').length} viajes</div>
        </div>
        <div className="p-4 glass">
          <div className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Realizados</div>
          <div className="text-xl font-bold" style={{ color: '#16A34A' }}>{formatARS(totalRealizado)}</div>
          <div className="text-xs mt-1" style={{ color: '#64748B' }}>{list.filter(r => r.estado === 'Realizado').length} viajes</div>
        </div>
      </div>

      {/* Table */}
      <div className="p-5 glass">
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar por cliente, tipo, estado..." />
          </div>
          <select
            value={estadoFilter}
            onChange={e => setEstadoFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.6)', color: '#374151', cursor: 'pointer', borderRadius: '10px' }}
            onFocus={e => { e.target.style.borderColor = 'rgba(61,143,209,0.6)' }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.6)' }}
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
              {errors.cliente && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.cliente}</p>}
            </Field>
            <Field label="Estado">
              <Select value={form.estado} onChange={e => set('estado', e.target.value)}>
                {ESTADOS.map(e => <option key={e}>{e}</option>)}
              </Select>
            </Field>
            <Field label="Origen" required>
              <Input value={form.origen} onChange={e => set('origen', e.target.value)} placeholder="Ciudad / Punto de salida" />
              {errors.origen && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.origen}</p>}
            </Field>
            <Field label="Destino" required>
              <Input value={form.destino} onChange={e => set('destino', e.target.value)} placeholder="Ciudad / Punto de llegada" />
              {errors.destino && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.destino}</p>}
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
            <BtnCancel onClick={() => setModal(false)} />
            <BtnPrimary onClick={handleSave}>Guardar</BtnPrimary>
          </div>
        </Modal>
      )}
    </div>
  )
}
