import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId } from '../utils/format'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea } from '../components/shared/Field'
import { Megaphone, Plus, Trash2, Edit2 } from 'lucide-react'

const TIPOS = ['Publicidad online', 'Redes sociales', 'Volantes / Impresión', 'Referido', 'Boca a boca', 'WhatsApp', 'Otro']
const ESTADOS = ['Activo', 'Finalizado', 'Planificado']

const empty = () => ({ id: genId(), fecha: todayISO(), tipo: 'Publicidad online', titulo: '', descripcion: '', presupuesto: '', gastado: '', estado: 'Planificado', resultado: '', notas: '' })

export default function Marketing() {
  const { data, update } = useStore()
  const list = data.marketing || []
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty())
  const [editId, setEditId] = useState(null)
  const [errors, setErrors] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.titulo) e.titulo = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const openNew = () => { setForm(empty()); setEditId(null); setErrors({}); setModal(true) }
  const openEdit = r => { setForm({ ...r }); setEditId(r.id); setErrors({}); setModal(true) }

  const handleSave = () => {
    if (!validate()) return
    if (editId) update('marketing', list.map(r => r.id === editId ? form : r))
    else update('marketing', [{ ...form }, ...list])
    setModal(false)
  }

  const handleDelete = id => {
    if (confirm('¿Eliminar esta campaña?')) update('marketing', list.filter(r => r.id !== id))
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return list
      .filter(r => !q || r.titulo?.toLowerCase().includes(q) || r.tipo?.toLowerCase().includes(q))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [list, search])

  const totalInvertido = list.reduce((s, r) => s + (parseFloat(r.gastado) || 0), 0)

  const estadoColors = { Activo: 'bg-green-500/20 text-green-400', Finalizado: 'bg-gray-500/20 text-gray-400', Planificado: 'bg-blue-500/20 text-blue-400' }

  const cols = [
    { key: 'fecha', label: 'Fecha', render: r => formatDate(r.fecha) },
    { key: 'titulo', label: 'Campaña', render: r => <span className="font-semibold text-white">{r.titulo}</span> },
    { key: 'tipo', label: 'Canal' },
    { key: 'presupuesto', label: 'Presupuesto', render: r => r.presupuesto ? formatARS(r.presupuesto) : '-' },
    { key: 'gastado', label: 'Gastado', render: r => r.gastado ? <span style={{ color: '#4A8FD4' }}>{formatARS(r.gastado)}</span> : '-' },
    { key: 'estado', label: 'Estado', render: r => <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${estadoColors[r.estado] || ''}`}>{r.estado}</span> },
    {
      key: 'acciones', label: '', render: r => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(r)} className="p-1 rounded hover:bg-white/10 text-gray-400"><Edit2 size={15} /></button>
          <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-red-500/20 text-red-400"><Trash2 size={15} /></button>
        </div>
      )
    }
  ]

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(74,143,212,0.2)' }}>
            <Megaphone size={20} style={{ color: '#4A8FD4' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>MARKETING</h1>
            <p className="text-xs text-gray-500">Campañas y acciones comerciales</p>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#4A8FD4' }}>
          <Plus size={16} /> Nueva campaña
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
          <div className="text-xs text-gray-500 mb-1">Total invertido</div>
          <div className="text-xl font-bold" style={{ color: '#4A8FD4' }}>{formatARS(totalInvertido)}</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
          <div className="text-xs text-gray-500 mb-1">Campañas activas</div>
          <div className="text-xl font-bold text-green-400">{list.filter(r => r.estado === 'Activo').length}</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
          <div className="text-xs text-gray-500 mb-1">Total campañas</div>
          <div className="text-xl font-bold text-white">{list.length}</div>
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
        <div className="mb-4">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar campaña, canal..." />
        </div>
        <Table columns={cols} data={filtered} emptyText="Sin campañas registradas" />
      </div>

      {modal && (
        <Modal title={editId ? 'Editar campaña' : 'Nueva campaña'} onClose={() => setModal(false)} size="lg">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Título de la campaña" required>
                <Input value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ej: Promoción invierno 2026" />
                {errors.titulo && <p className="text-red-400 text-xs mt-1">{errors.titulo}</p>}
              </Field>
            </div>
            <Field label="Fecha">
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </Field>
            <Field label="Canal / Tipo">
              <Select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Presupuesto ($)">
              <Input type="number" step="0.01" value={form.presupuesto} onChange={e => set('presupuesto', e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Gastado ($)">
              <Input type="number" step="0.01" value={form.gastado} onChange={e => set('gastado', e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Estado">
              <Select value={form.estado} onChange={e => set('estado', e.target.value)}>
                {ESTADOS.map(e => <option key={e}>{e}</option>)}
              </Select>
            </Field>
            <Field label="Resultado obtenido">
              <Input value={form.resultado} onChange={e => set('resultado', e.target.value)} placeholder="Ej: 5 nuevos clientes" />
            </Field>
            <div className="col-span-2">
              <Field label="Descripción">
                <Textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Notas">
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
