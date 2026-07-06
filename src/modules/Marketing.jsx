import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId } from '../utils/format'
import { toISO } from '../utils/fecha'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea, BtnPrimary, BtnCancel } from '../components/shared/Field'
import { Megaphone, Plus, Trash2, Edit2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ACCENT = 'var(--accent)'

const TIPOS   = ['Publicidad online', 'Redes sociales', 'Volantes / Impresión', 'Referido', 'Boca a boca', 'WhatsApp', 'Otro']
const ESTADOS = ['Activo', 'Finalizado', 'Planificado']

const ESTADO_STYLES = {
  Activo:      { bg: 'var(--positive-dim)', color: 'var(--positive)' },
  Finalizado:  { bg: 'var(--bg-overlay)',   color: 'var(--text-3)' },
  Planificado: { bg: 'var(--accent-dim)',   color: 'var(--accent)' },
}

const empty = () => ({
  id: genId(), fecha: todayISO(), tipo: 'Publicidad online', titulo: '',
  descripcion: '', presupuesto: '', gastado: '', estado: 'Planificado', resultado: '', notas: ''
})

export default function Marketing() {
  const { data, update } = useStore()
  const list = (data.marketing || []).filter(r =>
    r.nombre || r.canal || r.presupuesto
  )
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState(empty())
  const [editId, setEditId] = useState(null)
  const [errors, setErrors] = useState({})

  const { puedeEditar } = useAuth()
  const editable = puedeEditar('marketing')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.titulo) e.titulo = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const openNew  = ()  => { setForm(empty());   setEditId(null);  setErrors({}); setModal(true) }
  const openEdit = r   => { setForm({ ...r });  setEditId(r.id);  setErrors({}); setModal(true) }

  const handleSave   = ()  => {
    if (!validate()) return
    const normalized = { ...form, fecha: toISO(form.fecha) }
    if (editId) update('marketing', list.map(r => r.id === editId ? normalized : r))
    else        update('marketing', [normalized, ...list])
    setModal(false)
  }

  const handleDelete = id  => {
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
    { key: 'fecha',       label: 'Fecha',       render: r => formatDate(r.fecha) },
    { key: 'titulo',      label: 'Campaña',     render: r => <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{r.titulo}</span> },
    { key: 'tipo',        label: 'Canal' },
    { key: 'presupuesto', label: 'Presupuesto', render: r => r.presupuesto ? <span className="num">{formatARS(r.presupuesto)}</span> : <span style={{ color: 'var(--text-3)' }}>—</span> },
    {
      key: 'gastado', label: 'Gastado',
      render: r => r.gastado ? <span className="num font-semibold" style={{ color: ACCENT }}>{formatARS(r.gastado)}</span> : <span style={{ color: 'var(--text-3)' }}>—</span>
    },
    {
      key: 'estado', label: 'Estado', render: r => {
        const s = ESTADO_STYLES[r.estado] || { bg: 'var(--bg-overlay)', color: 'var(--text-3)' }
        return (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>
            {r.estado}
          </span>
        )
      }
    },
    {
      key: 'acciones', label: '', render: r => editable ? (
        <div className="flex gap-1">
          <button
            onClick={() => openEdit(r)}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-2)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-tint-md)'; e.currentTarget.style.color = 'var(--text-1)' }}
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
    }
  ]

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Megaphone size={18} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="mod-h1">Marketing</h1>
            <p className="mod-sub">Campañas y acciones comerciales</p>
          </div>
        </div>
        {editable && (
          <button
            className="glass-btn-primary" onClick={openNew}
          >
            <Plus size={15} /> Nueva campaña
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 16 }}>
        {[
          { label: 'Total invertido',   value: formatARS(totalInvertido),                          color: ACCENT },
          { label: 'Campañas activas',  value: list.filter(r => r.estado === 'Activo').length,     color: 'var(--positive)' },
          { label: 'Total campañas',    value: list.length,                                        color: 'var(--text-1)' },
        ].map((s, i) => (
          <div
            key={s.label}
            className={`surface surface-hover db-in db-d${i + 1}`}
            style={{ padding: '18px 20px 18px 24px', position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', top: 12, bottom: 12, left: 0, width: 3, borderRadius: '0 3px 3px 0', background: s.color === 'var(--text-1)' ? 'var(--chart-tick)' : s.color, opacity: 0.75 }} />
            <p className="db-slabel" style={{ marginBottom: 8 }}>{s.label}</p>
            <div className="num" style={{ fontSize: 19, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Tabla ── */}
      <div className="surface db-in db-d4" style={{ padding: 20 }}>
        <div style={{ marginBottom: 16 }}>
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
                {errors.titulo && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.titulo}</p>}
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
              <Input type="number" step="0.01" value={form.gastado}     onChange={e => set('gastado', e.target.value)}     placeholder="0.00" />
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
