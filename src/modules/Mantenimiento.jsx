import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId } from '../utils/format'
import { toISO, fechaMes } from '../utils/fecha'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea, BtnPrimary, BtnCancel } from '../components/shared/Field'
import { Wrench, Plus, Trash2 } from 'lucide-react'

const ACCENT = '#FBBF24'
const MONO   = "'Space Mono', 'Geist Mono', monospace"

const CATEGORIAS = ['Aceite y filtros', 'Frenos', 'Neumáticos', 'Suspensión', 'Motor', 'Eléctrico', 'Carrocería', 'Revisión general', 'Otro']

const empty = () => ({
  id: genId(), fecha: todayISO(), categoria: 'Revisión general', descripcion: '',
  taller: '', costo: '', km: '', proximo_km: '', proximo_fecha: '', estado: 'Realizado', notas: ''
})

const ESTADO_STYLES = {
  Realizado:    { bg: 'rgba(52,211,153,0.12)',  color: '#34D399' },
  Pendiente:    { bg: 'rgba(251,191,36,0.12)',  color: '#FBBF24' },
  'En proceso': { bg: 'rgba(56,189,248,0.12)',  color: '#38BDF8' },
}

export default function Mantenimiento() {
  const { data, update } = useStore()
  const list = (data.mantenimiento || []).filter(r =>
    r.descripcion || r.categoria || r.costo
  )
  const [search, setSearch]           = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [modal, setModal]             = useState(false)
  const [form, setForm]               = useState(empty())
  const [errors, setErrors]           = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.fecha)       e.fecha       = 'Requerido'
    if (!form.descripcion) e.descripcion = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    update('mantenimiento', [{ ...form, fecha: toISO(form.fecha), proximo_fecha: toISO(form.proximo_fecha) }, ...list])
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
    return list.filter(r => fechaMes(r.fecha) === mes).reduce((s, r) => s + (parseFloat(r.costo) || 0), 0)
  }, [list])

  const cols = [
    { key: 'fecha',       label: 'Fecha',       render: r => formatDate(r.fecha) },
    { key: 'categoria',   label: 'Categoría' },
    { key: 'descripcion', label: 'Descripción',  render: r => <span className="max-w-xs truncate block">{r.descripcion}</span> },
    { key: 'taller',      label: 'Taller',       render: r => r.taller || <span style={{ color: 'var(--text-3)' }}>—</span> },
    {
      key: 'costo', label: 'Costo', render: r => r.costo
        ? <span className="num font-semibold" style={{ color: ACCENT }}>{formatARS(r.costo)}</span>
        : <span style={{ color: 'var(--text-3)' }}>—</span>
    },
    { key: 'km',    label: 'KM',    render: r => r.km ? <span className="num">{Number(r.km).toLocaleString('es-AR')}</span> : <span style={{ color: 'var(--text-3)' }}>—</span> },
    {
      key: 'estado', label: 'Estado', render: r => {
        const s = ESTADO_STYLES[r.estado] || { bg: 'rgba(255,255,255,0.08)', color: '#94a3b8' }
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
          className="p-1.5 rounded-lg"
          style={{ color: 'var(--danger)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-dim)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '' }}
        >
          <Trash2 size={14} />
        </button>
      )
    }
  ]

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: `${ACCENT}18`, border: `1px solid ${ACCENT}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Wrench size={18} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="mod-h1">Mantenimiento</h1>
            <p className="mod-sub">Historial de reparaciones y servicios</p>
          </div>
        </div>
        <button
          className="glass-btn-primary"
          style={{ background: `${ACCENT}18`, boxShadow: `0 4px 15px ${ACCENT}22` }}
          onClick={() => { setForm(empty()); setErrors({}); setModal(true) }}
        >
          <Plus size={15} /> Nuevo registro
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 16 }}>
        {[
          { label: 'Gasto del mes',    value: formatARS(totalMes),                          color: ACCENT },
          { label: 'Pendientes',       value: list.filter(r => r.estado === 'Pendiente').length, color: 'var(--danger)' },
          { label: 'Total registros',  value: list.length,                                  color: 'var(--text-1)' },
        ].map((s, i) => (
          <div
            key={s.label}
            className={`surface surface-hover db-in db-d${i + 1}`}
            style={{ padding: '18px 20px 18px 24px', position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', top: 12, bottom: 12, left: 0, width: 3, borderRadius: '0 3px 3px 0', background: s.color, opacity: 0.75 }} />
            <p className="db-slabel" style={{ marginBottom: 8 }}>{s.label}</p>
            <div className="num" style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Tabla ── */}
      <div className="surface db-in db-d4" style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar descripción, taller..." />
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-1)', cursor: 'pointer', borderRadius: 'var(--radius)' }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.target.style.borderColor = '' }}
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
              {errors.fecha && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.fecha}</p>}
            </Field>
            <Field label="Categoría">
              <Select value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <div className="col-span-2">
              <Field label="Descripción" required>
                <Input value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Ej: Cambio de aceite 10W40 + filtro" />
                {errors.descripcion && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.descripcion}</p>}
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
