import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { genId } from '../utils/format'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea } from '../components/shared/Field'
import { Users, Plus, Trash2, Edit2 } from 'lucide-react'

const TIPOS = ['Cliente', 'Proveedor', 'Taller mecánico', 'Seguro', 'Empleado', 'Otro']

const empty = () => ({ id: genId(), nombre: '', tipo: 'Cliente', telefono: '', email: '', empresa: '', direccion: '', notas: '' })

export default function Contactos() {
  const { data, update } = useStore()
  const list = data.contactos || []
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty())
  const [editId, setEditId] = useState(null)
  const [errors, setErrors] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.nombre) e.nombre = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const openNew = () => { setForm(empty()); setEditId(null); setErrors({}); setModal(true) }
  const openEdit = r => { setForm({ ...r }); setEditId(r.id); setErrors({}); setModal(true) }

  const handleSave = () => {
    if (!validate()) return
    if (editId) {
      update('contactos', list.map(r => r.id === editId ? form : r))
    } else {
      update('contactos', [{ ...form }, ...list])
    }
    setModal(false)
  }

  const handleDelete = id => {
    if (confirm('¿Eliminar contacto?')) update('contactos', list.filter(r => r.id !== id))
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return list
      .filter(r => !q || r.nombre?.toLowerCase().includes(q) || r.empresa?.toLowerCase().includes(q) || r.telefono?.includes(q))
      .filter(r => !filtroTipo || r.tipo === filtroTipo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [list, search, filtroTipo])

  const tipoColors = { Cliente: 'text-blue-400', Proveedor: 'text-purple-400', 'Taller mecánico': 'text-orange-400', Seguro: 'text-green-400', Empleado: 'text-yellow-400', Otro: 'text-gray-400' }

  const cols = [
    { key: 'nombre', label: 'Nombre', render: r => <span className="font-semibold text-white">{r.nombre}</span> },
    { key: 'tipo', label: 'Tipo', render: r => <span className={`text-xs font-semibold ${tipoColors[r.tipo] || 'text-gray-400'}`}>{r.tipo}</span> },
    { key: 'empresa', label: 'Empresa', render: r => r.empresa || '-' },
    { key: 'telefono', label: 'Teléfono', render: r => r.telefono || '-' },
    { key: 'email', label: 'Email', render: r => r.email || '-' },
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
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-dim)' }}>
            <Users size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>CONTACTOS</h1>
            <p className="text-xs text-gray-500">Clientes, proveedores y más</p>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent)', color: 'var(--badge-text)' }}>
          <Plus size={16} /> Nuevo contacto
        </button>
      </div>

      <div className="rounded-xl p-5" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        <div className="flex flex-wrap gap-3 mb-4">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar nombre, empresa..." />
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm text-white" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-1)' }}>
            <option value="">Todos los tipos</option>
            {TIPOS.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <Table columns={cols} data={filtered} emptyText="Sin contactos registrados" />
      </div>

      {modal && (
        <Modal title={editId ? 'Editar contacto' : 'Nuevo contacto'} onClose={() => setModal(false)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Nombre completo" required>
                <Input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Juan Pérez" />
                {errors.nombre && <p className="text-red-400 text-xs mt-1">{errors.nombre}</p>}
              </Field>
            </div>
            <Field label="Tipo">
              <Select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Empresa / Organización">
              <Input value={form.empresa} onChange={e => set('empresa', e.target.value)} />
            </Field>
            <Field label="Teléfono">
              <Input value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="Ej: +54 9 11 1234-5678" />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </Field>
            <div className="col-span-2">
              <Field label="Dirección">
                <Input value={form.direccion} onChange={e => set('direccion', e.target.value)} />
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
            <button onClick={handleSave} className="px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent)', color: 'var(--badge-text)' }}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
