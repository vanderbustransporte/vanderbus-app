import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId } from '../utils/format'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea } from '../components/shared/Field'
import { Wrench, Plus, Trash2 } from 'lucide-react'

const CATEGORIAS = ['Aceite y filtros', 'Frenos', 'Neumáticos', 'Suspensión', 'Motor', 'Eléctrico', 'Carrocería', 'Revisión general', 'Otro']

const empty = () => ({
  id: genId(), fecha: todayISO(), categoria: 'Revisión general', descripcion: '',
  taller: '', costo: '', km: '', proximo_km: '', proximo_fecha: '', estado: 'Realizado', notas: ''
})

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

  const estadoColor = { Realizado: 'text-green-400', Pendiente: 'text-yellow-400', 'En proceso': 'text-blue-400' }

  const cols = [
    { key: 'fecha', label: 'Fecha', render: r => formatDate(r.fecha) },
    { key: 'categoria', label: 'Categoría' },
    { key: 'descripcion', label: 'Descripción', render: r => <span className="max-w-xs truncate block">{r.descripcion}</span> },
    { key: 'taller', label: 'Taller', render: r => r.taller || '-' },
    { key: 'costo', label: 'Costo', render: r => r.costo ? <span className="font-semibold" style={{ color: '#4A8FD4' }}>{formatARS(r.costo)}</span> : '-' },
    { key: 'km', label: 'KM', render: r => r.km ? `${Number(r.km).toLocaleString('es-AR')}` : '-' },
    { key: 'estado', label: 'Estado', render: r => <span className={`text-xs font-semibold ${estadoColor[r.estado] || 'text-gray-400'}`}>{r.estado}</span> },
    {
      key: 'acciones', label: '', render: r => (
        <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-red-500/20 text-red-400">
          <Trash2 size={15} />
        </button>
      )
    }
  ]

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(74,143,212,0.2)' }}>
            <Wrench size={20} style={{ color: '#4A8FD4' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>MANTENIMIENTO</h1>
            <p className="text-xs text-gray-500">Historial de reparaciones y servicios</p>
          </div>
        </div>
        <button onClick={() => { setForm(empty()); setErrors({}); setModal(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#4A8FD4' }}>
          <Plus size={16} /> Nuevo registro
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
          <div className="text-xs text-gray-500 mb-1">Gasto del mes</div>
          <div className="text-xl font-bold" style={{ color: '#4A8FD4' }}>{formatARS(totalMes)}</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
          <div className="text-xs text-gray-500 mb-1">Pendientes</div>
          <div className="text-xl font-bold text-yellow-400">{list.filter(r => r.estado === 'Pendiente').length}</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
          <div className="text-xs text-gray-500 mb-1">Total registros</div>
          <div className="text-xl font-bold text-white">{list.length}</div>
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
        <div className="flex flex-wrap gap-3 mb-4">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar descripción, taller..." />
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm text-white" style={{ background: '#252535', border: '1px solid #2E2E42' }}>
            <option value="">Todos los estados</option>
            <option>Realizado</option><option>Pendiente</option><option>En proceso</option>
          </select>
        </div>
        <Table columns={cols} data={filtered} emptyText="Sin registros de mantenimiento" />
      </div>

      {modal && (
        <Modal title="Nuevo mantenimiento / arreglo" onClose={() => setModal(false)} size="lg">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha" required>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
              {errors.fecha && <p className="text-red-400 text-xs mt-1">{errors.fecha}</p>}
            </Field>
            <Field label="Categoría">
              <Select value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <div className="col-span-2">
              <Field label="Descripción" required>
                <Input value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Ej: Cambio de aceite 10W40 + filtro" />
                {errors.descripcion && <p className="text-red-400 text-xs mt-1">{errors.descripcion}</p>}
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
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/10">Cancelar</button>
            <button onClick={handleSave} className="px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#4A8FD4' }}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
