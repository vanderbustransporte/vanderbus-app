import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { genId } from '../utils/format'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea, BtnPrimary, BtnCancel } from '../components/shared/Field'
import { Contact, Plus, Trash2, Edit2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const TIPOS = ['Cliente', 'Proveedor', 'Taller mecánico', 'Seguro', 'Empleado', 'Otro']

const empty = () => ({ id: genId(), nombre: '', tipo: 'Cliente', telefono: '', email: '', empresa: '', direccion: '', notas: '' })

export default function Contactos() {
  const { data, update } = useStore()
  const list = data.contactos || []
  const [search, setSearch]       = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState(empty())
  const [editId, setEditId]       = useState(null)
  const [errors, setErrors]       = useState({})

  const { puedeEditar } = useAuth()
  const editable = puedeEditar('contactos')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const openNew  = () => { setForm(empty()); setEditId(null); setErrors({}); setModal(true) }
  const openEdit = r => { setForm({ ...r }); setEditId(r.id); setErrors({}); setModal(true) }

  const handleSave = () => {
    if (!validate()) return
    if (editId) update('contactos', list.map(r => r.id === editId ? form : r))
    else        update('contactos', [{ ...form }, ...list])
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
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
  }, [list, search, filtroTipo])

  const dash = <span style={{ color: 'var(--text-3)' }}>—</span>

  const cols = [
    { key: 'nombre',   label: 'Nombre',   render: r => <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{r.nombre}</span> },
    {
      key: 'tipo', label: 'Tipo', render: r => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-overlay)', color: 'var(--text-2)' }}>
          {r.tipo}
        </span>
      )
    },
    { key: 'empresa',  label: 'Empresa',  render: r => r.empresa  || dash },
    { key: 'telefono', label: 'Teléfono', render: r => r.telefono || dash },
    { key: 'email',    label: 'Email',    render: r => r.email    || dash },
    {
      key: 'acciones', label: '', render: r => editable ? (
        <div className="flex gap-1">
          <button
            onClick={() => openEdit(r)}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-2)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-tint)'; e.currentTarget.style.color = 'var(--text-1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-2)' }}
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleDelete(r.id)}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--danger)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-dim)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ) : null
    },
  ]

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Contact size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 className="mod-h1">Contactos</h1>
            <p className="mod-sub">Clientes, proveedores y más</p>
          </div>
        </div>
        {editable && (
          <button className="glass-btn-primary" onClick={openNew}>
            <Plus size={15} /> Nuevo contacto
          </button>
        )}
      </div>

      {/* ── Tabla ── */}
      <div className="surface db-in db-d4" style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar nombre, empresa..." />
          </div>
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-1)', cursor: 'pointer', borderRadius: 'var(--radius)' }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.target.style.borderColor = '' }}
          >
            <option value="">Todos los tipos</option>
            {TIPOS.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <Table columns={cols} data={filtered} emptyText="Sin contactos registrados" />
      </div>

      {/* ── Modal ── */}
      {modal && (
        <Modal title={editId ? 'Editar contacto' : 'Nuevo contacto'} onClose={() => setModal(false)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Nombre completo" required>
                <Input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Juan Pérez" />
                {errors.nombre && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.nombre}</p>}
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
            <BtnCancel onClick={() => setModal(false)} />
            <BtnPrimary onClick={handleSave}>Guardar</BtnPrimary>
          </div>
        </Modal>
      )}
    </div>
  )
}
