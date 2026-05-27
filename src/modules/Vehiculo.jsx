import React, { useState } from 'react'
import { useStore } from '../store/useStore'
import { Field, Input, Select, Textarea } from '../components/shared/Field'
import { formatDate, expiryBg, expiryLabel } from '../utils/format'
import { Truck, Edit2, Save, X, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

const emptyVehiculo = {
  marca: '', modelo: '', anio: '', patente: '', motor: '', chasis: '',
  kilometraje: '', combustible: 'Gasoil', vtv: '', seguro: '',
  aseguradora: '', poliza: '', habilitacion: '', capacidad: '', observaciones: ''
}

function ExpiryBadge({ label, date }) {
  if (!date) return (
    <div className="p-4 glass">
      <div className="text-xs font-medium mb-1" style={{ color: '#94a3b8' }}>{label}</div>
      <div className="text-sm" style={{ color: '#94a3b8' }}>Sin fecha</div>
    </div>
  )

  // Determine status from expiry
  const today = new Date()
  const exp = new Date(date)
  const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24))

  let bg, borderColor, textColor, badgeBg, badgeColor, Icon
  if (diffDays < 0) {
    bg = 'rgba(239,68,68,0.05)'; borderColor = 'rgba(239,68,68,0.3)'; textColor = '#DC2626'
    badgeBg = 'rgba(239,68,68,0.1)'; badgeColor = '#DC2626'; Icon = AlertTriangle
  } else if (diffDays <= 30) {
    bg = 'rgba(217,119,6,0.05)'; borderColor = 'rgba(217,119,6,0.3)'; textColor = '#D97706'
    badgeBg = 'rgba(217,119,6,0.1)'; badgeColor = '#D97706'; Icon = Clock
  } else {
    bg = 'rgba(34,197,94,0.05)'; borderColor = 'rgba(34,197,94,0.3)'; textColor = '#16A34A'
    badgeBg = 'rgba(34,197,94,0.1)'; badgeColor = '#16A34A'; Icon = CheckCircle
  }

  return (
    <div className="p-4 rounded-xl" style={{ background: bg, border: `1px solid ${borderColor}`, borderRadius: '12px' }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={13} style={{ color: textColor }} />
        <div className="text-xs font-medium" style={{ color: '#64748B' }}>{label}</div>
      </div>
      <div className="font-semibold text-sm mb-1" style={{ color: '#f1f5f9' }}>{formatDate(date)}</div>
      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: badgeBg, color: badgeColor }}>
        {expiryLabel(date)}
      </span>
    </div>
  )
}

export default function Vehiculo() {
  const { data, update } = useStore()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(data.vehiculo || emptyVehiculo)

  const handleEdit = () => { setForm(data.vehiculo || emptyVehiculo); setEditing(true) }
  const handleCancel = () => setEditing(false)
  const handleSave = () => { update('vehiculo', form); setEditing(false) }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const v = data.vehiculo || emptyVehiculo

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(61,143,209,0.2)' }}>
            <Truck size={20} style={{ color: '#3D8FD1' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#FFFFFF', fontFamily: "'Inter', sans-serif" }}>Vehículo</h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>Ficha técnica y documentación</p>
          </div>
        </div>
        {!editing ? (
          <button
            onClick={handleEdit}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'rgba(61,143,209,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 4px 15px rgba(61,143,209,0.3)', borderRadius: '10px' }}
          >
            <Edit2 size={16} /> Editar
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ border: '1px solid var(--border)', color: 'var(--text-2)', background: 'var(--bg-overlay)', borderRadius: 'var(--radius)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hi)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '' }}
            >
              <X size={16} /> Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'rgba(61,143,209,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 4px 15px rgba(61,143,209,0.3)', borderRadius: '10px' }}
            >
              <Save size={16} /> Guardar
            </button>
          </div>
        )}
      </div>

      {/* Vencimientos */}
      {!editing && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <ExpiryBadge label="VTV" date={v.vtv} />
          <ExpiryBadge label="Seguro" date={v.seguro} />
          <ExpiryBadge label="Habilitación Municipal" date={v.habilitacion} />
        </div>
      )}

      {/* Data card */}
      <div className="p-6 glass">
        {!editing ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-5">
            {[
              ['Marca', v.marca], ['Modelo', v.modelo], ['Año', v.anio],
              ['Patente', v.patente], ['N° Motor', v.motor], ['N° Chasis', v.chasis],
              ['Kilometraje', v.kilometraje ? `${Number(v.kilometraje).toLocaleString('es-AR')} km` : '—'],
              ['Combustible', v.combustible], ['Capacidad', v.capacidad],
              ['Aseguradora', v.aseguradora], ['N° Póliza', v.poliza],
            ].map(([lbl, val]) => (
              <div key={lbl}>
                <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#94A3B8' }}>{lbl}</div>
                <div className="font-medium text-sm" style={{ color: val ? '#f1f5f9' : '#52525b' }}>{val || '—'}</div>
              </div>
            ))}
            {v.observaciones && (
              <div className="col-span-full pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Observaciones</div>
                <div className="text-sm" style={{ color: '#94a3b8' }}>{v.observaciones}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Marca" required><Input value={form.marca} onChange={e => set('marca', e.target.value)} placeholder="Ej: Mercedes-Benz" /></Field>
            <Field label="Modelo" required><Input value={form.modelo} onChange={e => set('modelo', e.target.value)} placeholder="Ej: Sprinter 515" /></Field>
            <Field label="Año"><Input type="number" value={form.anio} onChange={e => set('anio', e.target.value)} placeholder="Ej: 2018" /></Field>
            <Field label="Patente / Dominio" required><Input value={form.patente} onChange={e => set('patente', e.target.value)} placeholder="Ej: AB 123 CD" /></Field>
            <Field label="N° Motor"><Input value={form.motor} onChange={e => set('motor', e.target.value)} /></Field>
            <Field label="N° Chasis"><Input value={form.chasis} onChange={e => set('chasis', e.target.value)} /></Field>
            <Field label="Kilometraje actual"><Input type="number" value={form.kilometraje} onChange={e => set('kilometraje', e.target.value)} placeholder="Ej: 145000" /></Field>
            <Field label="Tipo de combustible">
              <Select value={form.combustible} onChange={e => set('combustible', e.target.value)}>
                <option>Gasoil</option><option>Diésel</option><option>GNC</option><option>Nafta</option>
              </Select>
            </Field>
            <Field label="Capacidad de carga"><Input value={form.capacidad} onChange={e => set('capacidad', e.target.value)} placeholder="Ej: 2000 kg" /></Field>
            <Field label="Venc. VTV"><Input type="date" value={form.vtv} onChange={e => set('vtv', e.target.value)} /></Field>
            <Field label="Venc. Seguro"><Input type="date" value={form.seguro} onChange={e => set('seguro', e.target.value)} /></Field>
            <Field label="Aseguradora"><Input value={form.aseguradora} onChange={e => set('aseguradora', e.target.value)} /></Field>
            <Field label="N° Póliza"><Input value={form.poliza} onChange={e => set('poliza', e.target.value)} /></Field>
            <Field label="Venc. Habilitación Municipal"><Input type="date" value={form.habilitacion} onChange={e => set('habilitacion', e.target.value)} /></Field>
            <div className="sm:col-span-2">
              <Field label="Observaciones"><Textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} /></Field>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
