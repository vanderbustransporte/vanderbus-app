import React, { useState, useMemo, useEffect } from 'react'
import { useStore, getData } from '../store/useStore'
import { formatDate, todayISO, genId, daysDiff, expiryBg, expiryLabel } from '../utils/format'
import { toISO } from '../utils/fecha'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Textarea, BtnPrimary, BtnCancel } from '../components/shared/Field'
import { IdCard, Plus, Edit2, Archive, ArchiveRestore } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { useRegistroDestacado } from '../hooks/useRegistroDestacado'
import { choferesDisponible, CAMPOS_VENC_CHOFER, nombreChofer } from '../utils/choferes'

const empty = () => ({
  id: genId(), nombre: '', dni: '', celular: '', email: '',
  licencia_categoria: '', licencia_venc: '', habilitacion_venc: '', psicofisico_venc: '',
  notas: '', activo: true,
})

function VencBadge({ fecha }) {
  if (!fecha) return <span style={{ color: 'var(--text-3)' }}>—</span>
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${expiryBg(fecha)}`} title={expiryLabel(fecha)}>
      {formatDate(fecha)}
    </span>
  )
}

export default function Choferes() {
  const { data, update, loading } = useStore()
  const list = data.choferes || []
  const { puedeEditar } = useAuth()
  const editable = puedeEditar('choferes')
  const { addToast } = useToast()
  const confirmar = useConfirm()

  const [disponible, setDisponible] = useState(true)
  useEffect(() => { let vivo = true; choferesDisponible().then(ok => { if (vivo) setDisponible(ok) }); return () => { vivo = false } }, [])

  const [search, setSearch]   = useState('')
  const [filtro, setFiltro]   = useState('activos')   // activos | archivados | todos
  const [modal, setModal]     = useState(false)
  const [editId, setEditId]   = useState(null)
  const [form, setForm]       = useState(empty())
  const [errors, setErrors]   = useState({})
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Deep link (/#/choferes/:id): un chofer archivado no está en la vista por
  // defecto → se pasa a 'todos' para que la fila exista y se resalte.
  const destacadoId = useRegistroDestacado(list, {
    listo: !loading,
    onEncontrado: () => { setSearch(''); setFiltro('todos') },
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return list
      .filter(c => filtro === 'todos' || (filtro === 'activos' ? c.activo !== false : c.activo === false))
      .filter(c => !q || (c.nombre || '').toLowerCase().includes(q) || (c.dni || '').includes(q))
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
  }, [list, search, filtro])

  const activos = list.filter(c => c.activo !== false)
  const diasVenc = c => CAMPOS_VENC_CHOFER.map(({ campo }) => c[campo] ? daysDiff(c[campo]) : null).filter(d => d != null)
  const conVencidos  = activos.filter(c => diasVenc(c).some(d => d < 0)).length
  const conProximos  = activos.filter(c => { const ds = diasVenc(c); return ds.some(d => d >= 0 && d <= 30) && !ds.some(d => d < 0) }).length

  const validate = () => {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const openNew = () => { setEditId(null); setForm(empty()); setErrors({}); setModal(true) }
  const openEdit = c => {
    setEditId(c.id)
    setForm({
      ...empty(),
      ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v ?? ''])),
      activo: c.activo !== false,
      licencia_venc: toISO(c.licencia_venc), habilitacion_venc: toISO(c.habilitacion_venc), psicofisico_venc: toISO(c.psicofisico_venc),
    })
    setErrors({})
    setModal(true)
  }

  const handleSave = () => {
    if (!validate()) return
    const chofer = {
      ...form,
      licencia_venc: toISO(form.licencia_venc), habilitacion_venc: toISO(form.habilitacion_venc), psicofisico_venc: toISO(form.psicofisico_venc),
    }
    if (editId) update('choferes', list.map(c => c.id === editId ? chofer : c))
    else update('choferes', [chofer, ...list])
    setModal(false)
  }

  // Soft delete (igual que la flota): archivar, no borrar — el historial de
  // viajes y las fichas de despacho pueden referenciarlo.
  const archivar = async c => {
    const ok = await confirmar({
      titulo: 'Archivar chofer',
      mensaje: `${nombreChofer(c)} deja de aparecer en los selectores y en los avisos de vencimiento. Se puede reactivar cuando quieras.`,
      accion: 'Archivar', tono: 'normal', Icon: Archive,
    })
    if (!ok) return
    update('choferes', list.map(x => x.id === c.id ? { ...x, activo: false } : x))
    addToast({
      message: `${nombreChofer(c)} archivado.`,
      Icon: Archive,
      color: 'var(--warning)',
      duration: 6000,
      action: { label: 'Deshacer', onClick: () => update('choferes', (getData().choferes || []).map(x => x.id === c.id ? { ...x, activo: true } : x)) },
    })
  }
  const reactivar = c => update('choferes', list.map(x => x.id === c.id ? { ...x, activo: true } : x))

  const cols = [
    { key: 'nombre', label: 'Nombre', render: c => (
        <span className="font-semibold" style={{ color: 'var(--text-1)' }}>
          {c.nombre || <span style={{ color: 'var(--text-3)' }}>Sin nombre</span>}
          {c.activo === false && <span className="text-xs font-normal px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-overlay)', color: 'var(--text-2)', marginLeft: 8 }}>Archivado</span>}
        </span>
      ) },
    { key: 'dni',     label: 'DNI',     render: c => c.dni ? <span className="num">{c.dni}</span> : <span style={{ color: 'var(--text-3)' }}>—</span> },
    { key: 'celular', label: 'Celular', render: c => c.celular ? <span className="num">{c.celular}</span> : <span style={{ color: 'var(--text-3)' }}>—</span> },
    { key: 'licencia', label: 'Licencia', render: c => (
        <span>{c.licencia_categoria && <span style={{ marginRight: 8 }}>{c.licencia_categoria}</span>}<VencBadge fecha={c.licencia_venc} /></span>
      ) },
    { key: 'habilitacion_venc', label: 'Habilitación', render: c => <VencBadge fecha={c.habilitacion_venc} /> },
    { key: 'psicofisico_venc',  label: 'Psicofísico',  render: c => <VencBadge fecha={c.psicofisico_venc} /> },
    {
      key: 'acciones', label: '', render: c => editable ? (
        <div className="flex gap-1">
          <button
            onClick={() => openEdit(c)}
            className="icon-btn"
            aria-label={`Editar ${nombreChofer(c)}`}
          >
            <Edit2 size={14} />
          </button>
          {c.activo !== false ? (
            <button
              onClick={() => archivar(c)}
              className="icon-btn icon-btn-warning"
              aria-label={`Archivar ${nombreChofer(c)}`}
              title="Archivar"
            >
              <Archive size={14} />
            </button>
          ) : (
            <button
              onClick={() => reactivar(c)}
              className="icon-btn icon-btn-positive"
              aria-label={`Reactivar ${nombreChofer(c)}`}
              title="Reactivar"
            >
              <ArchiveRestore size={14} />
            </button>
          )}
        </div>
      ) : null
    },
  ]

  return (
    <div className="max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IdCard size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 className="mod-h1">Choferes</h1>
            <p className="mod-sub">Legajo, contacto y vencimientos de licencias</p>
          </div>
        </div>
        {editable && disponible && (
          <button className="glass-btn-primary" onClick={openNew}>
            <Plus size={15} /> Nuevo chofer
          </button>
        )}
      </div>

      {!disponible ? (
        <div className="surface db-in db-d1" style={{ padding: 26 }}>
          <p style={{ fontSize: 14, color: 'var(--text-1)', fontWeight: 600, marginBottom: 8 }}>Módulo pendiente de habilitar</p>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
            Falta aplicar la migración <code style={{ color: 'var(--text-1)' }}>20260718130000_choferes.sql</code> en
            el SQL editor de Supabase. Una vez aplicada, recargá la página: el legajo de choferes se habilita solo
            (y sus vencimientos de licencia, habilitación y psicofísico entran al sistema de notificaciones).
          </p>
        </div>
      ) : (
        <>
          {/* ── Stats ── */}
          <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 16 }}>
            {[
              { label: 'Choferes activos',        value: activos.length, color: 'var(--accent)' },
              { label: 'Con vencimientos < 30 días', value: conProximos,  color: 'var(--warning)' },
              { label: 'Con documentación vencida',  value: conVencidos,  color: 'var(--danger)' },
            ].map((s, i) => (
              <div key={s.label} className={`surface surface-hover db-in db-d${i + 1}`} style={{ padding: '18px 22px' }}>
                <p className="db-slabel" style={{ marginBottom: 8 }}>{s.label}</p>
                <div className="num" style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* ── Tabla ── */}
          <div className="surface db-in db-d4" style={{ padding: 20 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre o DNI..." />
              </div>
              <div className="seg">
                {[['activos', 'Activos'], ['archivados', 'Archivados'], ['todos', 'Todos']].map(([val, lbl]) => (
                  <button key={val} onClick={() => setFiltro(val)} className={filtro === val ? 'seg-btn is-active' : 'seg-btn'}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            <Table
              columns={cols} data={filtered} highlightId={destacadoId}
              emptyIcon={IdCard}
              emptyText={search ? 'Sin resultados' : filtro === 'archivados' ? 'Sin choferes archivados' : 'Todavía no hay choferes'}
              emptyHint={search
                ? 'Probá con otro nombre o DNI.'
                : filtro === 'archivados'
                  ? 'Los choferes que archives van a aparecer acá.'
                  : 'Cargá el legajo de tus choferes para controlar los vencimientos de licencia, habilitación y psicofísico.'}
              emptyAction={!search && filtro !== 'archivados' && editable ? { label: 'Nuevo chofer', Icon: Plus, onClick: openNew } : null}
            />
          </div>
        </>
      )}

      {/* ── Modal ── */}
      {modal && (
        <Modal title={editId ? 'Editar chofer' : 'Nuevo chofer'} onClose={() => setModal(false)}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre y apellido" required>
              <Input value={form.nombre} onChange={e => set('nombre', e.target.value)} />
              {errors.nombre && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.nombre}</p>}
            </Field>
            <Field label="DNI">
              <Input value={form.dni} onChange={e => set('dni', e.target.value)} />
            </Field>
            <Field label="Celular">
              <Input value={form.celular} onChange={e => set('celular', e.target.value)} placeholder="11-..." />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </Field>
            <Field label="Categoría de licencia">
              <Input value={form.licencia_categoria} onChange={e => set('licencia_categoria', e.target.value)} placeholder="Ej: C1, E1" />
            </Field>
            <Field label="Vencimiento de licencia">
              <Input type="date" value={form.licencia_venc} onChange={e => set('licencia_venc', e.target.value)} />
            </Field>
            <Field label="Vencimiento habilitación (LNH/CNRT)">
              <Input type="date" value={form.habilitacion_venc} onChange={e => set('habilitacion_venc', e.target.value)} />
            </Field>
            <Field label="Vencimiento psicofísico">
              <Input type="date" value={form.psicofisico_venc} onChange={e => set('psicofisico_venc', e.target.value)} />
            </Field>
            <div className="col-span-2">
              <Field label="Notas">
                <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Observaciones, ART, categoría CCT..." />
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
