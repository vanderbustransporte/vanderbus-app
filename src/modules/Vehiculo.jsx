import React, { useState } from 'react'
import { useStore } from '../store/useStore'
import { Field, Input, Select, Textarea } from '../components/shared/Field'
import { formatDate, expiryBg, expiryLabel } from '../utils/format'
import { Truck, Edit2, Save, X } from 'lucide-react'

const emptyVehiculo = {
  marca: '', modelo: '', anio: '', patente: '', motor: '', chasis: '',
  kilometraje: '', combustible: 'Gasoil', vtv: '', seguro: '',
  aseguradora: '', poliza: '', habilitacion: '', capacidad: '', observaciones: ''
}

function ExpiryBadge({ label, date }) {
  if (!date) return (
    <div className="rounded-lg p-4" style={{ background: '#252535', border: '1px solid #2E2E42' }}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-gray-400 text-sm">Sin fecha</div>
    </div>
  )
  const cls = expiryBg(date)
  return (
    <div className={`rounded-lg p-4 ${cls.split(' ')[0]}`} style={{ border: '1px solid #2E2E42' }}>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="font-semibold text-sm">{formatDate(date)}</div>
      <div className={`text-xs mt-1 ${cls.split(' ')[1]}`}>{expiryLabel(date)}</div>
    </div>
  )
}

export default function Vehiculo() {
  const { data, update } = useStore()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(data.vehiculo || emptyVehiculo)

  const handleEdit = () => { setForm(data.vehiculo || emptyVehiculo); setEditing(true) }
  const handleCancel = () => setEditing(false)
  const handleSave = () => {
    update('vehiculo', form)
    setEditing(false)
  }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const v = data.vehiculo || emptyVehiculo

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(74,143,212,0.2)' }}>
            <Truck size={20} style={{ color: '#4A8FD4' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>VEHÍCULO</h1>
            <p className="text-xs text-gray-500">Ficha técnica y documentación</p>
          </div>
        </div>
        {!editing ? (
          <button onClick={handleEdit} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors" style={{ background: '#4A8FD4' }}>
            <Edit2 size={16} /> Editar
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-gray-300 hover:bg-white/10 transition-colors">
              <X size={16} /> Cancelar
            </button>
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors" style={{ background: '#4A8FD4' }}>
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

      <div className="rounded-xl p-6" style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}>
        {!editing ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-5">
            {[
              ['Marca', v.marca], ['Modelo', v.modelo], ['Año', v.anio],
              ['Patente', v.patente], ['N° Motor', v.motor], ['N° Chasis', v.chasis],
              ['Kilometraje', v.kilometraje ? `${Number(v.kilometraje).toLocaleString('es-AR')} km` : '-'],
              ['Combustible', v.combustible], ['Capacidad', v.capacidad],
              ['Aseguradora', v.aseguradora], ['N° Póliza', v.poliza],
            ].map(([lbl, val]) => (
              <div key={lbl}>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{lbl}</div>
                <div className="text-white font-medium">{val || <span className="text-gray-600">-</span>}</div>
              </div>
            ))}
            {v.observaciones && (
              <div className="col-span-full">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Observaciones</div>
                <div className="text-white">{v.observaciones}</div>
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
