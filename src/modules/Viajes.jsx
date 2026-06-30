import React, { useState, useMemo, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId } from '../utils/format'
import { toISO } from '../utils/fecha'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea, BtnPrimary, BtnCancel } from '../components/shared/Field'
import { MapPin, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ACCENT = '#34D399'

const TIPOS   = ['Excursión', 'Traslado', 'Turismo', 'Charter', 'Escolar', 'Corporativo', 'Otro']
const ESTADOS = ['Pendiente', 'Confirmado', 'Realizado', 'Cancelado']

const ESTADO_STYLES = {
  Pendiente:  { bg: 'rgba(251,191,36,0.12)',   color: '#FBBF24' },
  Confirmado: { bg: 'rgba(56,189,248,0.12)',   color: '#38BDF8' },
  Realizado:  { bg: 'rgba(52,211,153,0.12)',   color: '#34D399' },
  Cancelado:  { bg: 'rgba(248,113,113,0.12)',  color: '#F87171' },
}

const empty = () => ({
  id: genId(), fecha: todayISO(), cliente: '', tipo: 'Excursión',
  origen: '', destino: '', monto_sena: '', monto_total: '', estado: 'Pendiente', notas: '',
  vehiculo_id: '',
})

function EstadoBadge({ estado, id, onChange }) {
  const s = ESTADO_STYLES[estado] || { bg: 'rgba(255,255,255,0.08)', color: '#94a3b8' }
  return (
    <select
      value={estado}
      onChange={e => onChange(id, e.target.value)}
      style={{
        background: s.bg, color: s.color, border: 'none', outline: 'none',
        borderRadius: '9999px', padding: '3px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer',
      }}
    >
      {ESTADOS.map(e => (
        <option key={e} value={e} style={{ background: 'var(--bg-elevated)', color: 'var(--text-1)' }}>{e}</option>
      ))}
    </select>
  )
}

export default function Viajes() {
  const { data, update, loading } = useStore()
  const list = (data.viajes || []).filter(r =>
    r.cliente || r.destino || r.origen
  )
  const [search, setSearch]           = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [modal, setModal]             = useState(false)
  const [form, setForm]               = useState(empty())
  const [errors, setErrors]           = useState({})

  const { puedeEditar } = useAuth()
  const editable = puedeEditar('viajes')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.cliente.trim()) e.cliente  = 'Requerido'
    if (!form.origen.trim())  e.origen   = 'Requerido'
    if (!form.destino.trim()) e.destino  = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const openNew    = () => { setForm(empty()); setErrors({}); setModal(true) }
  const handleSave = () => { if (!validate()) return; update('viajes', [{ ...form, fecha: toISO(form.fecha) }, ...list]); setModal(false) }
  const handleDelete = id => { if (confirm('¿Eliminar este viaje?')) update('viajes', list.filter(r => r.id !== id)) }

  const handleEstado = (id, nuevoEstado) => {
    const viaje = list.find(r => r.id === id)
    const ingresos = data.ingresos || []
    if (nuevoEstado === 'Realizado' && viaje?.monto_total) {
      if (!ingresos.some(i => i.viaje_id === id)) {
        update('ingresos', [{
          id: genId(), tipo: 'ingreso', viaje_id: id,
          fecha: toISO(viaje.fecha),
          descripcion: `Viaje: ${viaje.cliente} — ${viaje.origen} → ${viaje.destino}`,
          categoria: 'Servicio de transporte',
          importe: viaje.monto_total, cliente: viaje.cliente,
          comprobante: '', notas: '',
        }, ...ingresos])
      }
    } else if (viaje?.estado === 'Realizado' && nuevoEstado !== 'Realizado') {
      const filtrados = ingresos.filter(i => i.viaje_id !== id)
      if (filtrados.length !== ingresos.length) update('ingresos', filtrados)
    }
    update('viajes', list.map(r => r.id === id ? { ...r, estado: nuevoEstado } : r))
  }

  useEffect(() => {
    if (loading) return
    const ingresos = data.ingresos || []
    const existingViajeIds = new Set(ingresos.filter(i => i.viaje_id).map(i => i.viaje_id))
    const faltantes = (data.viajes || []).filter(
      r => r.estado === 'Realizado' && r.monto_total && (r.cliente || r.destino || r.origen) && !existingViajeIds.has(r.id)
    )
    if (!faltantes.length) return
    update('ingresos', [
      ...faltantes.map(v => ({
        id: genId(), tipo: 'ingreso', viaje_id: v.id,
        fecha: toISO(v.fecha),
        descripcion: `Viaje: ${v.cliente} — ${v.origen} → ${v.destino}`,
        categoria: 'Servicio de transporte',
        importe: v.monto_total, cliente: v.cliente,
        comprobante: '', notas: '',
      })),
      ...ingresos,
    ])
  }, [loading, data.viajes, data.ingresos])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return list
      .filter(r => {
        const matchQ      = !q || r.cliente?.toLowerCase().includes(q) || r.tipo?.toLowerCase().includes(q) || r.estado?.toLowerCase().includes(q)
        const matchEstado = !estadoFilter || r.estado === estadoFilter
        return matchQ && matchEstado
      })
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
  }, [list, search, estadoFilter])

  const totalEsperado  = list.filter(r => r.estado === 'Pendiente' || r.estado === 'Confirmado').reduce((s, r) => s + (parseFloat(r.monto_total) || 0), 0)
  const totalConfirmado = list.filter(r => r.estado === 'Confirmado').reduce((s, r) => s + (parseFloat(r.monto_total) || 0), 0)
  const totalRealizado  = list.filter(r => r.estado === 'Realizado').reduce((s, r) => s + (parseFloat(r.monto_total) || 0), 0)

  const cols = [
    { key: 'fecha',   label: 'Fecha',   render: r => formatDate(r.fecha) },
    { key: 'cliente', label: 'Cliente', render: r => <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{r.cliente}</span> },
    { key: 'tipo',    label: 'Tipo' },
    { key: 'origen',  label: 'Origen' },
    { key: 'destino', label: 'Destino' },
    { key: 'monto_sena',  label: 'Seña',  render: r => r.monto_sena  ? <span className="num">{formatARS(r.monto_sena)}</span>  : <span style={{ color: 'var(--text-3)' }}>—</span> },
    { key: 'monto_total', label: 'Total', render: r => r.monto_total ? <span className="num font-semibold" style={{ color: ACCENT }}>{formatARS(r.monto_total)}</span> : <span style={{ color: 'var(--text-3)' }}>—</span> },
    { key: 'estado', label: 'Estado', render: r => editable
        ? <EstadoBadge estado={r.estado} id={r.id} onChange={handleEstado} />
        : <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: ESTADO_STYLES[r.estado]?.bg || 'rgba(255,255,255,0.08)', color: ESTADO_STYLES[r.estado]?.color || '#94a3b8' }}>{r.estado}</span>
    },
    {
      key: 'acciones', label: '', render: r => editable ? (
        <button
          onClick={() => handleDelete(r.id)}
          className="p-1.5 rounded-lg"
          style={{ color: '#F87171' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.10)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '' }}
        >
          <Trash2 size={14} />
        </button>
      ) : null
    },
  ]

  return (
    <div className="max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: `${ACCENT}18`, border: `1px solid ${ACCENT}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MapPin size={18} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="mod-h1">Viajes</h1>
            <p className="mod-sub">Gestión de viajes y traslados</p>
          </div>
        </div>
        {editable && (
          <button
            className="glass-btn-primary"
            style={{ background: `${ACCENT}18`, boxShadow: `0 4px 15px ${ACCENT}22` }}
            onClick={openNew}
          >
            <Plus size={15} /> Nuevo viaje
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 16 }}>
        {[
          { label: 'Ingresos esperados',  value: formatARS(totalEsperado),   color: '#FBBF24', sub: 'Pendientes + Confirmados' },
          { label: 'Confirmados',         value: formatARS(totalConfirmado), color: '#38BDF8', sub: `${list.filter(r => r.estado === 'Confirmado').length} viajes` },
          { label: 'Realizados',          value: formatARS(totalRealizado),  color: ACCENT,    sub: `${list.filter(r => r.estado === 'Realizado').length} viajes` },
        ].map((s, i) => (
          <div
            key={s.label}
            className={`surface surface-hover db-in db-d${i + 1}`}
            style={{ padding: '18px 20px 18px 24px', position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', top: 12, bottom: 12, left: 0, width: 3, borderRadius: '0 3px 3px 0', background: s.color, opacity: 0.75 }} />
            <p className="db-slabel" style={{ marginBottom: 8 }}>{s.label}</p>
            <div className="num" style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Tabla ── */}
      <div className="surface db-in db-d4" style={{ padding: 20 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar por cliente, tipo, estado..." />
          </div>
          <select
            value={estadoFilter}
            onChange={e => setEstadoFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-1)', cursor: 'pointer', borderRadius: 'var(--radius)' }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.target.style.borderColor = '' }}
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <Table columns={cols} data={filtered} emptyText="Sin viajes registrados" />
      </div>

      {/* ── Modal ── */}
      {modal && (
        <Modal title="Nuevo viaje" onClose={() => setModal(false)} size="lg">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Vehículo">
              <Select value={form.vehiculo_id || ''} onChange={e => set('vehiculo_id', e.target.value)}>
                <option value="">— Sin asignar —</option>
                {(data.vehiculos || []).filter(v => v.activo !== false).map(v => (
                  <option key={v.id} value={v.id}>{v.alias || v.patente || 'Vehículo'}</option>
                ))}
              </Select>
            </Field>
            <Field label="Fecha">
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </Field>
            <Field label="Tipo de viaje">
              <Select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Cliente" required>
              <Input value={form.cliente} onChange={e => set('cliente', e.target.value)} placeholder="Nombre del cliente o grupo" />
              {errors.cliente && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.cliente}</p>}
            </Field>
            <Field label="Estado">
              <Select value={form.estado} onChange={e => set('estado', e.target.value)}>
                {ESTADOS.map(e => <option key={e}>{e}</option>)}
              </Select>
            </Field>
            <Field label="Origen" required>
              <Input value={form.origen} onChange={e => set('origen', e.target.value)} placeholder="Ciudad / Punto de salida" />
              {errors.origen && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.origen}</p>}
            </Field>
            <Field label="Destino" required>
              <Input value={form.destino} onChange={e => set('destino', e.target.value)} placeholder="Ciudad / Punto de llegada" />
              {errors.destino && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.destino}</p>}
            </Field>
            <Field label="Monto seña ($)">
              <Input type="number" step="0.01" min="0" value={form.monto_sena}  onChange={e => set('monto_sena', e.target.value)}  placeholder="0.00" />
            </Field>
            <Field label="Monto total ($)">
              <Input type="number" step="0.01" min="0" value={form.monto_total} onChange={e => set('monto_total', e.target.value)} placeholder="0.00" />
            </Field>
            <div className="col-span-2">
              <Field label="Notas">
                <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Observaciones adicionales..." />
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
