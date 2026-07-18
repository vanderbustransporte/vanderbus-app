import React, { useState, useMemo } from 'react'
import { useStore, getData } from '../store/useStore'
import { useRegistroDestacado } from '../hooks/useRegistroDestacado'
import { formatDate, formatARS, todayISO, genId } from '../utils/format'
import { toISO, fechaMes } from '../utils/fecha'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea, BtnPrimary, BtnCancel } from '../components/shared/Field'
import { Wrench, Plus, Trash2, Edit2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { conValorActual, vehiculosSeleccionables } from '../utils/form'

const ACCENT = 'var(--accent)'
const MONO   = "'Geist', system-ui, sans-serif"

const CATEGORIAS = ['Aceite y filtros', 'Frenos', 'Neumáticos', 'Suspensión', 'Motor', 'Eléctrico', 'Carrocería', 'Revisión general', 'Otro']
const ESTADOS    = ['Realizado', 'Pendiente', 'En proceso']

const empty = () => ({
  id: genId(), fecha: todayISO(), categoria: 'Revisión general', descripcion: '',
  taller: '', costo: '', km: '', proximo_km: '', proximo_fecha: '', estado: 'Realizado', notas: '',
  vehiculo_id: '',
})

const ESTADO_STYLES = {
  Realizado:    { bg: 'var(--positive-dim)', color: 'var(--positive)' },
  Pendiente:    { bg: 'var(--warning-dim)',  color: 'var(--warning)' },
  'En proceso': { bg: 'var(--accent-dim)',   color: 'var(--accent)' },
}

export default function Mantenimiento() {
  const { data, update, loading } = useStore()
  const list = (data.mantenimiento || []).filter(r =>
    r.descripcion || r.categoria || r.costo
  )
  const [search, setSearch]           = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  // Deep link a un service (/#/mantenimiento/:id): las notificaciones de próximo
  // service llegan acá con la fila exacta. Limpia filtros y la resalta.
  const destacadoId = useRegistroDestacado(list, {
    listo: !loading,
    onEncontrado: () => { setSearch(''); setFiltroEstado('') },
  })
  const [modal, setModal]             = useState(false)
  const [editId, setEditId]           = useState(null)
  const [form, setForm]               = useState(empty())
  const [errors, setErrors]           = useState({})

  const { puedeEditar } = useAuth()
  const editable = puedeEditar('mantenimiento')
  const { addToast } = useToast()
  const confirmar = useConfirm()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Opciones preservando valores legacy y el vehículo asignado aunque esté
  // archivado (ver utils/form.js).
  const categoriasOpciones = useMemo(() => conValorActual(CATEGORIAS, form.categoria), [form.categoria])
  const estadosOpciones    = useMemo(() => conValorActual(ESTADOS, form.estado), [form.estado])
  const vehiculosOpciones  = useMemo(
    () => vehiculosSeleccionables(data.vehiculos, form.vehiculo_id),
    [data.vehiculos, form.vehiculo_id]
  )

  const validate = () => {
    const e = {}
    if (!form.fecha)       e.fecha       = 'Requerido'
    if (!form.descripcion) e.descripcion = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const openNew = () => { setEditId(null); setForm(empty()); setErrors({}); setModal(true) }

  // `...empty()` primero para que las filas viejas tengan todas las claves
  // definidas, null → '' para inputs controlados, y fechas normalizadas a ISO
  // (el <input type="date"> rechaza otros formatos y borraría el dato).
  const openEdit = (r) => {
    setEditId(r.id)
    setForm({
      ...empty(),
      ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ''])),
      fecha: toISO(r.fecha),
      proximo_fecha: toISO(r.proximo_fecha),
    })
    setErrors({})
    setModal(true)
  }

  const handleSave = () => {
    if (!validate()) return
    const registro = {
      ...form,
      fecha: toISO(form.fecha),
      proximo_fecha: toISO(form.proximo_fecha),
      // vehiculo_id es uuid: '' de "Sin asignar" se guarda como NULL (mismo
      // bug que tenía Viajes: el string vacío hacía fallar el guardado entero).
      vehiculo_id: form.vehiculo_id || null,
    }
    if (editId) update('mantenimiento', list.map(r => r.id === editId ? registro : r))
    else        update('mantenimiento', [registro, ...list])
    setModal(false)
  }

  const handleDelete = async id => {
    const registro = list.find(r => r.id === id)
    if (!registro) return
    const ok = await confirmar({
      titulo: 'Eliminar registro',
      mensaje: `Se elimina "${registro.descripcion || registro.categoria || 'este registro'}" del ${formatDate(registro.fecha)}.`,
    })
    if (!ok) return
    update('mantenimiento', list.filter(r => r.id !== id))
    addToast({
      message: 'Registro eliminado.',
      Icon: Trash2,
      color: 'var(--danger)',
      duration: 6000,
      action: { label: 'Deshacer', onClick: () => update('mantenimiento', [registro, ...(getData().mantenimiento || [])]) },
    })
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
            className="icon-btn"
            aria-label={`Editar registro del ${formatDate(r.fecha)}`}
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleDelete(r.id)}
            className="icon-btn icon-btn-danger"
            aria-label={`Eliminar registro del ${formatDate(r.fecha)}`}
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
            <Wrench size={18} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="mod-h1">Mantenimiento</h1>
            <p className="mod-sub">Historial de reparaciones y servicios</p>
          </div>
        </div>
        {editable && (
          <button className="glass-btn-primary" onClick={openNew}>
            <Plus size={15} /> Nuevo registro
          </button>
        )}
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
            className="input-base"
            style={{ width: 'auto' }}
          >
            <option value="">Todos los estados</option>
            <option>Realizado</option>
            <option>Pendiente</option>
            <option>En proceso</option>
          </select>
        </div>
        <Table columns={cols} data={filtered} emptyText="Sin registros de mantenimiento" highlightId={destacadoId} />
      </div>

      {modal && (
        <Modal title={editId ? 'Editar mantenimiento / arreglo' : 'Nuevo mantenimiento / arreglo'} onClose={() => setModal(false)} size="lg">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Vehículo">
              <Select value={form.vehiculo_id || ''} onChange={e => set('vehiculo_id', e.target.value)}>
                <option value="">— Sin asignar —</option>
                {vehiculosOpciones.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.alias || v.patente || 'Vehículo'}{v.activo === false ? ' (archivado)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fecha" required>
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
              {errors.fecha && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.fecha}</p>}
            </Field>
            <Field label="Categoría">
              <Select value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                {categoriasOpciones.map(c => <option key={c}>{c}</option>)}
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
                {estadosOpciones.map(e => <option key={e}>{e}</option>)}
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
