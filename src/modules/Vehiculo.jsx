import React, { useState, useEffect, useCallback } from 'react'
import { useStore, getData } from '../store/useStore'
import { useRegistroDestacado } from '../hooks/useRegistroDestacado'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { Field, Input, Select, Textarea } from '../components/shared/Field'
import { formatDate, expiryLabel } from '../utils/format'
import { faltantesVehiculo } from '../utils/chequeoVencimientos'
import { Truck, Edit2, Save, X, Plus, Archive, AlertTriangle, CheckCircle, Clock, Fuel } from 'lucide-react'
import EmptyState from '../components/shared/EmptyState'
import { useAuth } from '../context/AuthContext'
import {
  CAMPOS_CONSUMO_VEHICULO, emptyConsumoVehiculo, consumoDisponible,
  claseDe, num, consumoRealVehiculo, fmtL100,
} from '../utils/consumo'
import { MOTORES, GRUPOS_MOTOR, motorPorId, etiquetaMotor, specsDesdeMotor } from '../data/motores'

const ACCENT = 'var(--accent)'

const emptyVehiculo = {
  alias: '', marca: '', modelo: '', anio: '', patente: '', motor: '', chasis: '',
  kilometraje: '', combustible: 'Gasoil', vtv: '', seguro: '',
  aseguradora: '', poliza: '', habilitacion: '', capacidad: '', observaciones: '', activo: true,
  // Specs del estimador de consumo. Van SIEMPRE en el form (inputs controlados),
  // pero handleSave las saca del payload si la migración 20260724120000 no está
  // aplicada (ver utils/consumo.js).
  ...emptyConsumoVehiculo(),
}

const CLASE_LABEL = {
  liviano: 'Liviano (furgón / pickup)',
  mediano: 'Mediano (camión)',
  pesado:  'Pesado (tractor + semi)',
}

// Estado de un vencimiento (color + texto)
function vencStatus(date) {
  if (!date) return null
  const diff = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24))
  if (diff < 0)  return { color: 'var(--danger)',  dim: 'var(--danger-dim)',  Icon: AlertTriangle }
  if (diff <= 30) return { color: 'var(--warning)', dim: 'var(--warning-dim)', Icon: Clock }
  return { color: 'var(--positive)', dim: 'var(--positive-dim)', Icon: CheckCircle }
}

function ExpiryBadge({ label, date }) {
  const st = vencStatus(date)
  if (!st) return (
    <div className="db-in db-d1" style={{ padding: 16, borderRadius: 'var(--radius)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
      <div className="db-slabel" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Sin fecha</div>
    </div>
  )
  const { color, dim, Icon } = st
  return (
    <div className="db-in db-d1" style={{ padding: 16, borderRadius: 'var(--radius)', background: 'var(--bg-elevated)', border: `1px solid ${dim}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Icon size={13} style={{ color }} />
        <div className="db-slabel" style={{ marginBottom: 0 }}>{label}</div>
      </div>
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', marginBottom: 6 }}>{formatDate(date)}</div>
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: dim, color }}>
        {expiryLabel(date)}
      </span>
    </div>
  )
}

// Tarjeta de un vehiculo en la grilla de flota
function VehiculoCard({ v, onEdit, onArchive, editable, faltan = [], flash = false }) {
  const chips = [['VTV', v.vtv], ['Seguro', v.seguro], ['Habil.', v.habilitacion]]
  // Deep link: scrollear la tarjeta resaltada al montarse (el ref sólo se ata a esa).
  const flashRef = useCallback(node => {
    if (!node) return
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    node.scrollIntoView({ block: 'center', behavior: reducido ? 'auto' : 'smooth' })
  }, [])
  return (
    <div
      ref={flash ? flashRef : null}
      className={`surface db-in db-d2${flash ? ' row-flash' : ''}`}
      style={{
        padding: 18, borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 12,
        border: faltan.length ? '1px solid var(--warning)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--accent-dim)', border: '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Truck size={16} style={{ color: ACCENT }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {v.alias || v.patente || 'Sin nombre'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
            {[v.marca, v.modelo, v.anio].filter(Boolean).join(' ') || '—'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {chips.map(([lbl, date]) => {
          const st = vencStatus(date)
          return (
            <span key={lbl} style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
              background: st ? st.dim : 'var(--bg-elevated)',
              color: st ? st.color : 'var(--text-3)',
              border: `1px solid ${st ? st.color + '33' : 'var(--border)'}`
            }}>
              {lbl}{st ? '' : ' —'}
            </span>
          )
        })}
      </div>

      {faltan.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--warning-dim)' }}>
          <AlertTriangle size={14} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)' }}>Faltan datos obligatorios</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 1 }}>{faltan.join(', ')}</div>
            {editable && (
              <button
                onClick={() => onEdit(v)}
                style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 'var(--radius)', border: '1px solid transparent', color: 'var(--warning)', background: 'var(--warning-dim)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                <Edit2 size={11} /> Completar ahora
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
        Patente: <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{v.patente || '—'}</span>
        {v.kilometraje ? <> · {Number(v.kilometraje).toLocaleString('es-AR')} km</> : null}
      </div>

      {editable && (
        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
          <button
            onClick={() => onEdit(v)}
            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--radius)', border: '1px solid transparent', color: 'var(--accent)', background: 'var(--accent-dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <Edit2 size={13} /> Editar
          </button>
          <button
            onClick={() => onArchive(v)}
            className="btn-ghost-danger"
            title="Archivar"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '7px 11px', cursor: 'pointer' }}
          >
            <Archive size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

// Specs que alimentan el estimador de consumo por viaje (utils/consumo.js).
// Se cargan una vez por unidad. El catálogo de motores (data/motores.js) sólo
// PRECARGA valores de referencia: lo que queda guardado es lo que el usuario
// deja en los campos, y esos son los que manda el cálculo.
function ConsumoSpecs({ form, set, setForm, combustible }) {
  const tara  = num(form.tara_kg)
  const clase = claseDe(tara)
  const real  = consumoRealVehiculo(combustible, form.id)

  const precargar = (id) => {
    const m = motorPorId(id)
    if (m) setForm(f => ({ ...f, ...specsDesdeMotor(m) }))
  }

  return (
    <div className="surface db-in db-d5" style={{ padding: 24, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Fuel size={15} style={{ color: ACCENT }} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Consumo y pesos</h2>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 18 }}>
        Con esto la app estima cuántos litros va a gastar cada viaje de esta unidad
        antes de salir, según los km y el peso de la carga. Los valores del manual
        son <strong style={{ color: 'var(--text-1)' }}>con la unidad vacía</strong>: el
        peso de la carga lo suma el cálculo.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          {/* Select-acción: elegir precarga los campos de abajo (que siguen
              editables) y vuelve a vacío. Mismo patrón que "elegir chofer del
              legajo" en Viajes. */}
          <Field label="Precargar desde el catálogo (valores de referencia, ajustables)">
            <Select value="" onChange={e => precargar(e.target.value)}>
              <option value="">— Cargar a mano o elegir una unidad parecida —</option>
              {GRUPOS_MOTOR.map(g => (
                <optgroup key={g} label={g}>
                  {MOTORES.filter(m => m.grupo === g).map(m => (
                    <option key={m.id} value={m.id}>{etiquetaMotor(m)}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Motorización">
            <Input value={form.motor_desc} onChange={e => set('motor_desc', e.target.value)} placeholder="Ej: 2.3 dCi (G9U/M9T) 130 cv" />
          </Field>
        </div>

        <Field label="Consumo urbano vacío (L/100km)">
          <Input type="number" step="0.1" min="0" value={form.consumo_urbano_l100} onChange={e => set('consumo_urbano_l100', e.target.value)} placeholder="Ej: 12.5" />
        </Field>
        <Field label="Consumo en ruta vacío (L/100km)">
          <Input type="number" step="0.1" min="0" value={form.consumo_ruta_l100} onChange={e => set('consumo_ruta_l100', e.target.value)} placeholder="Ej: 9.5" />
        </Field>
        <Field label="Tara — peso de la unidad vacía (kg)">
          <Input type="number" step="1" min="0" value={form.tara_kg} onChange={e => set('tara_kg', e.target.value)} placeholder="Ej: 2150" />
        </Field>
        <Field label="Carga útil máxima (kg)">
          <Input type="number" step="1" min="0" value={form.carga_max_kg} onChange={e => set('carga_max_kg', e.target.value)} placeholder="Ej: 1550" />
        </Field>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16, fontSize: 11, color: 'var(--text-2)' }}>
        <span style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--bg-overlay)' }}>
          Clase para el cálculo: <strong style={{ color: 'var(--text-1)' }}>{CLASE_LABEL[clase]}</strong>
          {tara == null && ' (se afina al cargar la tara)'}
        </span>
        {real.l100 != null && (
          <span style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--bg-overlay)' }}>
            Consumo real medido: <strong className="num" style={{ color: 'var(--text-1)' }}>{fmtL100(real.l100)}</strong>
            {' '}· {real.muestras} {real.muestras === 1 ? 'intervalo' : 'intervalos'} del historial de cargas
          </span>
        )}
      </div>
    </div>
  )
}

export default function Vehiculo() {
  const { data, update } = useStore()
  const { puedeEditar } = useAuth()
  const editable = puedeEditar('vehiculo')
  const { addToast } = useToast()
  const confirmar = useConfirm()
  const flota = (data.vehiculos || []).filter(x => x.activo !== false)

  const [editingId, setEditingId] = useState(null)   // null | 'new' | id
  const [form, setForm] = useState(emptyVehiculo)

  // ¿Está aplicada la migración del estimador de consumo?
  const [consumoOn, setConsumoOn] = useState(false)
  useEffect(() => { let vivo = true; consumoDisponible().then(ok => { if (vivo) setConsumoOn(ok) }); return () => { vivo = false } }, [])

  const set = (k, val) => setForm(f => ({ ...f, [k]: val }))

  const handleNew    = () => { setForm({ ...emptyVehiculo, id: crypto.randomUUID() }); setEditingId('new') }
  // null → '' : la base guarda null en las columnas nuevas de las filas viejas y
  // React pasa el input a no controlado ("`value` prop should not be null").
  const handleEdit   = (v) => {
    setForm({ ...emptyVehiculo, ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x ?? ''])) })
    setEditingId(v.id)
  }
  const handleCancel = () => setEditingId(null)

  // Deep link a un vehículo (/#/vehiculo/:id): resalta la tarjeta. Un archivado
  // no está en la grilla (la palette igual lo lista), así que se abre su ficha.
  const destacadoId = useRegistroDestacado(data.vehiculos || [], {
    onEncontrado: (v) => { if (v.activo === false && editable) handleEdit(v) },
  })

  const handleSave = () => {
    const fila = { ...form }
    // Sin la migración de consumo aplicada estas columnas no existen: mandarlas
    // haría fallar el guardado ENTERO del vehículo (mismo patrón que despacho).
    if (!consumoOn) for (const k of CAMPOS_CONSUMO_VEHICULO) delete fila[k]
    const all = data.vehiculos || []
    const next = editingId === 'new'
      ? [...all, { ...fila, activo: true }]
      : all.map(x => x.id === editingId ? fila : x)
    update('vehiculos', next)
    setEditingId(null)
  }

  const handleArchive = async (v) => {
    const nombre = v.alias || v.patente || 'este vehículo'
    const ok = await confirmar({
      titulo: `Archivar ${nombre}`,
      mensaje: 'Sale de la flota activa pero el historial no se borra. Se puede desarchivar cuando quieras.',
      accion: 'Archivar',
      tono: 'normal',
      Icon: Archive,
    })
    if (!ok) return
    update('vehiculos', (data.vehiculos || []).map(x => x.id === v.id ? { ...x, activo: false } : x))
    addToast({
      message: `${nombre} archivado.`,
      Icon: Archive,
      color: 'var(--accent)',
      duration: 6000,
      action: {
        label: 'Deshacer',
        onClick: () => update('vehiculos', (getData().vehiculos || []).map(x => x.id === v.id ? { ...x, activo: true } : x)),
      },
    })
  }

  // ── Modo formulario (alta o edicion) ──
  if (editingId) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Truck size={18} style={{ color: ACCENT }} />
            </div>
            <div>
              <h1 className="mod-h1">{editingId === 'new' ? 'Nuevo vehículo' : 'Editar vehículo'}</h1>
              <p className="mod-sub">Ficha técnica y documentación</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCancel}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', color: 'var(--text-2)', background: 'var(--bg-overlay)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              <X size={14} /> Cancelar
            </button>
            <button className="glass-btn-primary" onClick={handleSave}>
              <Save size={15} /> Guardar
            </button>
          </div>
        </div>

        <div className="surface db-in db-d4" style={{ padding: 24 }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Nombre / Alias (para identificarlo en las listas)" required>
                <Input value={form.alias} onChange={e => set('alias', e.target.value)} placeholder="Ej: Camión 1, Master Blanca…" />
              </Field>
            </div>
            <Field label="Marca"   required><Input value={form.marca}   onChange={e => set('marca', e.target.value)}   placeholder="Ej: Mercedes-Benz" /></Field>
            <Field label="Modelo"  required><Input value={form.modelo}  onChange={e => set('modelo', e.target.value)}  placeholder="Ej: Sprinter 515" /></Field>
            <Field label="Año"><Input type="number" value={form.anio} onChange={e => set('anio', e.target.value)} placeholder="Ej: 2018" /></Field>
            <Field label="Patente / Dominio" required><Input value={form.patente} onChange={e => set('patente', e.target.value)} placeholder="Ej: AB 123 CD" /></Field>
            <Field label="N° Motor"><Input value={form.motor}  onChange={e => set('motor', e.target.value)} /></Field>
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
        </div>

        {consumoOn && <ConsumoSpecs form={form} set={set} setForm={setForm} combustible={data.combustible} />}
      </div>
    )
  }

  // ── Modo lista (flota) ──
  return (
    <div className="max-w-5xl mx-auto">
      <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Truck size={18} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="mod-h1">Flota</h1>
            <p className="mod-sub">{flota.length} {flota.length === 1 ? 'vehículo' : 'vehículos'}</p>
          </div>
        </div>
        {editable && (
          <button className="glass-btn-primary" onClick={handleNew}>
            <Plus size={15} /> Agregar vehículo
          </button>
        )}
      </div>

      {flota.length === 0 ? (
        <div className="surface db-in db-d4" style={{ borderRadius: 'var(--radius)' }}>
          <EmptyState
            Icon={Truck}
            title="Todavía no hay vehículos"
            hint="Cargá tu flota para seguir vencimientos (VTV, seguro, habilitación), consumo y mantenimiento de cada unidad."
            action={editable ? { label: 'Agregar el primero', Icon: Plus, onClick: handleNew } : null}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {flota.map(v => (
            <VehiculoCard
              key={v.id}
              v={v}
              onEdit={handleEdit}
              onArchive={handleArchive}
              editable={editable}
              faltan={faltantesVehiculo(v, data.mantenimiento)}
              flash={v.id === destacadoId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
