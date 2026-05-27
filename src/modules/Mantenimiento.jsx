import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId } from '../utils/format'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea, BtnPrimary, BtnCancel } from '../components/shared/Field'
import { Wrench, Plus, Trash2 } from 'lucide-react'

const CATEGORIAS = ['Aceite y filtros', 'Frenos', 'Neumáticos', 'Suspensión', 'Motor', 'Eléctrico', 'Carrocería', 'Revisión general', 'Otro']

const cardStyle = {
  background: 'rgba(255,255,255,0.6)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.8)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
  borderRadius: '16px',
}

const empty = () => ({
  id: genId(), fecha: todayISO(), categoria: 'Revisión general', descripcion: '',
  taller: '', costo: '', km: '', proximo_km: '', proximo_fecha: '', estado: 'Realizado', notas: ''
})

const ESTADO_STYLES = {
  Realizado: { bg: 'rgba(34,197,94,0.1)', color: '#16A34A' },
  Pendiente: { bg: 'rgba(217,119,6,0.1)', color: '#D97706' },
  'En proceso': { bg: 'rgba(61,143,209,0.1)', color: '#3D8FD1' },
}

export default function Mantenimiento() {
  const { data, update } = useStore()
  const list = data.mantenimiento || []
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty())
  const [errors, setErrors] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.fecha) e.fecha = 'Requerido'
    if (!form.descripcion) e.descripcion = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    update('mantenimiento', [{ ...form }, ...list])
    setModal(false)
    setForm(empty())
  }

  const handleDelete = id => {
    if (confirm('¿Eliminar este registro?')) update('mantenimiento', list.filter(r => r.id !== id))
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return list
      .filter(r => (!q || r.descripcion?.toLowerCase().includes(q) || r.taller?.toLowerCase().includes(q) || r.categoria?.toLowerCase().includes(q)))
      .filter(r => !filtroEstado || r.estado === filtroEstado)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [list, search, filtroEstado])

  const totalMes = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7)
    return list.filter(r => r.fecha?.startsWith(mes)).reduce((s, r) => s + (parseFloat(r.costo) || 0), 0)
  }, [list])

  const cols = [
    { key: 'fecha', label: 'Fecha', render: r => formatDate(r.fecha) },
    { key: 'categoria', label: 'Categoría' },
    { key: 'descripcion', label: 'Descripción', render: r => <span className="max-w-xs truncate block">{r.descripcion}</span> },
    { key: 'taller', label: 'Taller', render: r => r.taller || '—' },
    {
      key: 'costo', label: 'Costo', render: r => r.costo
        ? <span className="font-semibold" style={{ color: '#3D8FD1' }}>{formatARS(r.costo)}</span>
        : '—'
    },
    { key: 'km', label: 'KM', render: r => r.km ? `${Number(r.km).toLocaleString('es-AR')}` : '—' },
    {
      key: 'estado', label: 'Estado', render: r => {
        const s = ESTADO_STYLES[r.estado] || { bg: '#F8FAFC', color: '#64748B' }
        return (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>
            {r.estado}
          </span>
        )
      }
    },
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(61,143,209,0.1)' }}>
            <Wrench size={20} style={{ color: '#3D8FD1' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1A202C', fontFamily: "'Inter', sans-serif" }}>Mantenimiento</h1>
            <p className="text-xs" style={{ color: '#64748B' }}>Historial de reparaciones y servicios</p>
          </div>
        </div>
        <button
          onClick={() => { setForm(empty()); setErrors({}); setModal(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'rgba(61,143,209,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 4px 15px rgba(61,143,209,0.3)', borderRadius: '10px' }}
        >
          <Plus size={16} /> Nuevo registro
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-xl" style={cardStyle}>
          <div className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Gasto del mes</div>
          <div className="text-xl font-bold" style={{ color: '#3D8FD1' }}>{formatARS(totalMes)}</div>
        </div>
        <div className="p-4 rounded-xl" style={cardStyle}>
          <div className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Pendientes</div>
          <div className="text-xl font-bold" style={{ color: '#D97706' }}>{list.filter(r => r.estado === 'Pendiente').length}</div>
        </div>
        <div className="p-4 rounded-xl" style={cardStyle}>
          <div className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Total registros</div>
          <div className="text-xl font-bold" style={{ color: '#1A202C' }}>{list.length}</div>
        </div>
      </div>

      {/* Table card */}
      <div className="p-5 rounded-xl" style={cardStyle}>
        <div className="flex flex-wrap gap-3 mb-4">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar descripción, taller..." />
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.6)', color: '#374151', cursor: 'pointer', borderRadius: '10px' }}
            onFocus={e => { e.target.style.borderColor = 'rgba(61,143,209,0.6)' }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.6)' }}
          >
            <option value="">Todos los estados</option>
            <option>Realizado</option>
            <option>Pendiente</option>
            <option>En proceso</option>
          </select>
        </div>
        <Table columns={cols} data={filtered} emptyText="Sin registros de mantenimiento" />
      </div>

      {modal && (
        <Modal title="Nuevo mantenimiento / arreglo" onClose={() => setModal(false)} size="lg">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha" required>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
              {errors.fecha && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.fecha}</p>}
            </Field>
            <Field label="Categoría">
              <Select value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <div className="col-span-2">
              <Field label="Descripción" required>
                <Input value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Ej: Cambio de aceite 10W40 + filtro" />
                {errors.descripcion && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.descripcion}</p>}
              </Field>
            </div>
            <Field label="Taller / Mecánico">
              <Input value={form.taller} onChange={e => set('taller', e.target.value)} placeholder="Ej: Taller El Gaucho" />
            </Field>
            <Field label="Costo ($)">
              <Input type="number" step="0.01" value={form.costo} onChange={e => set('costo', e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="KM al momento">
              <Input type="number" value={form.km} onChange={e => set('km', e.target.value)} />
            </Field>
            <Field label="Estado">
              <Select value={form.estado} onChange={e => set('estado', e.target.value)}>
                <option>Realizado</option><option>Pendiente</option><option>En proceso</option>
              </Select>
            </Field>
            <Field label="Próximo service (KM)">
              <Input type="number" value={form.proximo_km} onChange={e => set('proximo_km', e.target.value)} />
            </Field>
            <Field label="Próximo service (fecha)">
              <Input type="date" value={form.proximo_fecha} onChange={e => set('proximo_fecha', e.target.value)} />
            </Field>
            <div className="col-span-2">
              <Field label="Notas adicionales">
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
