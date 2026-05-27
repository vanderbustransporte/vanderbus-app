import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId } from '../utils/format'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea, BtnPrimary, BtnCancel } from '../components/shared/Field'
import { Megaphone, Plus, Trash2, Edit2 } from 'lucide-react'

const TIPOS = ['Publicidad online', 'Redes sociales', 'Volantes / Impresión', 'Referido', 'Boca a boca', 'WhatsApp', 'Otro']
const ESTADOS = ['Activo', 'Finalizado', 'Planificado']


const ESTADO_STYLES = {
  Activo: { bg: 'rgba(34,197,94,0.1)', color: '#16A34A' },
  Finalizado: { bg: 'rgba(100,116,139,0.1)', color: '#475569' },
  Planificado: { bg: 'rgba(61,143,209,0.1)', color: '#3D8FD1' },
}

const empty = () => ({
  id: genId(), fecha: todayISO(), tipo: 'Publicidad online', titulo: '',
  descripcion: '', presupuesto: '', gastado: '', estado: 'Planificado', resultado: '', notas: ''
})

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

  const cols = [
    { key: 'fecha', label: 'Fecha', render: r => formatDate(r.fecha) },
    { key: 'titulo', label: 'Campaña', render: r => <span className="font-semibold" style={{ color: '#1A202C' }}>{r.titulo}</span> },
    { key: 'tipo', label: 'Canal' },
    { key: 'presupuesto', label: 'Presupuesto', render: r => r.presupuesto ? formatARS(r.presupuesto) : '—' },
    {
      key: 'gastado', label: 'Gastado',
      render: r => r.gastado ? <span className="font-semibold" style={{ color: '#3D8FD1' }}>{formatARS(r.gastado)}</span> : '—'
    },
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
        <div className="flex gap-1">
          <button
            onClick={() => openEdit(r)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#64748B' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F0F4F8' }}
            onMouseLeave={e => { e.currentTarget.style.background = '' }}
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleDelete(r.id)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#EF4444' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(61,143,209,0.2)' }}>
            <Megaphone size={20} style={{ color: '#3D8FD1' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#FFFFFF', fontFamily: "'Inter', sans-serif" }}>Marketing</h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>Campañas y acciones comerciales</p>
          </div>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'rgba(61,143,209,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 4px 15px rgba(61,143,209,0.3)', borderRadius: '10px' }}
        >
          <Plus size={16} /> Nueva campaña
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 glass">
          <div className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Total invertido</div>
          <div className="text-xl font-bold" style={{ color: '#3D8FD1' }}>{formatARS(totalInvertido)}</div>
        </div>
        <div className="p-4 glass">
          <div className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Campañas activas</div>
          <div className="text-xl font-bold" style={{ color: '#16A34A' }}>{list.filter(r => r.estado === 'Activo').length}</div>
        </div>
        <div className="p-4 glass">
          <div className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Total campañas</div>
          <div className="text-xl font-bold" style={{ color: '#1A202C' }}>{list.length}</div>
        </div>
      </div>

      {/* Table */}
      <div className="p-5 glass">
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
                {errors.titulo && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.titulo}</p>}
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
            <BtnCancel onClick={() => setModal(false)} />
            <BtnPrimary onClick={handleSave}>Guardar</BtnPrimary>
          </div>
        </Modal>
      )}
    </div>
  )
}
