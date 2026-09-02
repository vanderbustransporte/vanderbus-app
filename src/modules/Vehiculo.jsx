import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useStore, getData } from '../store/useStore'
import { useRegistroDestacado } from '../hooks/useRegistroDestacado'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { Field, Input, Select, Textarea } from '../components/shared/Field'
import { formatDate, expiryLabel } from '../utils/format'
import { faltantesVehiculo } from '../utils/chequeoVencimientos'
import { Truck, Edit2, Save, X, Plus, Archive, AlertTriangle, CheckCircle, Clock, Fuel, ChevronDown, ChevronRight } from 'lucide-react'
import EmptyState from '../components/shared/EmptyState'
import { useAuth } from '../context/AuthContext'
import {
  CAMPOS_CONSUMO_VEHICULO, CAMPOS_FICHA_VEHICULO,
  emptyConsumoVehiculo, emptyFichaVehiculo,
  consumoDisponible, fichaExtDisponible,
  claseDe, num, fmtL100, specsVehiculo, baseTeorica,
} from '../utils/consumo'
import { calibracionVehiculo } from '../utils/calibracion'
import {
  CLASES, CLASE_IDS, CARROCERIAS,
  COMBUSTIBLES_MOTOR, TRANSMISIONES, NORMAS_EMISION, ralentiEstimado,
} from '../data/clases'
import { MOTORES, motorPorId, etiquetaMotor, specsDesdeMotor } from '../data/motores'
import { fuenteCatalogo } from '../utils/vehiculosRef'
import PrecargaReferencia from '../components/PrecargaReferencia'
import { docsDisponible } from '../utils/docsVehiculo'
import DocsVehiculo from '../components/DocsVehiculo'
import ExtraerFicha from '../components/ExtraerFicha'

const ACCENT = 'var(--accent)'

const emptyVehiculo = {
  alias: '', marca: '', modelo: '', anio: '', patente: '', motor: '', chasis: '',
  kilometraje: '', combustible: 'Gasoil', vtv: '', seguro: '',
  aseguradora: '', poliza: '', habilitacion: '', capacidad: '', observaciones: '', activo: true,
  // Specs del estimador de consumo. Van SIEMPRE en el form (inputs controlados),
  // pero handleSave las saca del payload si la migración correspondiente no está
  // aplicada (20260724120000 / 20260724130000, ver utils/consumo.js).
  ...emptyConsumoVehiculo(),
  ...emptyFichaVehiculo(),
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
//
// Estratificado en 3 niveles (rediseño 2026-08-25, ver auditoría del estimador):
// el operario no técnico sólo necesita ver el buscador y dos números (consumo +
// tara) para tener un estimado; todo lo demás — potencia, torque, norma de
// emisión, PBT, carrocería... — no mueve el cálculo o tiene un fallback por
// clase, y va detrás de "Ficha técnica completa (opcional)".
function ConsumoSpecs({ form, set, setForm, combustible, viajes, fichaExt }) {
  const tara  = num(form.tara_kg)
  const clase = claseDe(form)
  // Los tres números de la unidad, sobre un recorrido mixto (acá no hay viaje
  // que fije la mezcla urbano/ruta). El de Viajes usa la mezcla real de ese viaje.
  const cal = useMemo(() => {
    const specs = specsVehiculo(form)
    if (!specs.ok) return null
    return calibracionVehiculo({
      combustible, viajes, vehiculoId: form.id, specs,
      teoricoBase: baseTeorica(specs, 'Mixto'),
    })
  }, [form, combustible, viajes])
  // Ralentí: si la ficha no lo trae se estima por clase y cilindrada, y se dice
  // que es estimado. Nunca se muestra un número inventado como si fuera del manual.
  const ralentiFicha = num(form.consumo_ralenti_lh)
  const ralentiUsado = ralentiFicha ?? ralentiEstimado(clase, num(form.motor_cilindrada_l))

  const precargar = (id) => {
    const m = motorPorId(id)
    if (m) setForm(f => ({ ...f, ...specsDesdeMotor(m, { fichaExt }) }))
  }
  const [motorTexto, setMotorTexto] = useState('')
  const elegirMotorTexto = (texto) => {
    setMotorTexto(texto)
    const m = MOTORES.find(x => etiquetaMotor(x) === texto)
    if (m) precargar(m.id)
  }

  // Fuente del catálogo de precarga. 'referencia' = buscador contra la tabla
  // global (sólo si está aplicada Y sembrada); 'legacy' = buscador sobre el
  // catálogo estático de data/motores.js, como hasta hoy. Mientras resuelve, y
  // ante cualquier duda, cae a 'legacy': la app no depende de la tabla nueva.
  const [fuenteCat, setFuenteCat] = useState('legacy')
  useEffect(() => { let vivo = true; fuenteCatalogo().then(f => { if (vivo) setFuenteCat(f) }); return () => { vivo = false } }, [])

  // ¿Hay algún consumo cargado? Recién ahí tiene sentido preguntar de dónde
  // salió — antes de eso el campo no está haciendo nada.
  const huboConsumo = !!(form.consumo_urbano_l100 || form.consumo_ruta_l100 || form.consumo_mixto_l100)

  // Nivel 3 colapsado por defecto — el operario no lo necesita para tener un
  // estimado. Se auto-abre UNA vez si la ficha ya trae algo ahí adentro (por
  // ejemplo, una precarga desde el catálogo), para que no queden datos
  // "escondidos" sin que el usuario sepa que están.
  const [verDetalle, setVerDetalle] = useState(false)
  const detalleTieneValor = fichaExt
    ? !!(form.clase || form.motor_cilindrada_l || form.motor_potencia_cv || form.motor_torque_nm ||
         form.motor_combustible || form.norma_emision || form.transmision || form.relacion_diferencial ||
         form.consumo_mixto_l100 || form.pbt_kg || form.tanque_l || form.consumo_ralenti_lh || form.carga_max_kg)
    : !!form.carga_max_kg
  useEffect(() => { if (detalleTieneValor) setVerDetalle(true) }, [detalleTieneValor])

  return (
    <div className="surface db-in db-d5" style={{ padding: 24, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Fuel size={15} style={{ color: ACCENT }} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Consumo y pesos</h2>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 18 }}>
        Con esto la app estima cuántos litros va a gastar cada viaje de esta unidad
        antes de salir, según los km y el peso de la carga. Los valores de acá abajo
        son <strong style={{ color: 'var(--text-1)' }}>con la unidad vacía</strong>: el
        peso de la carga lo suma el cálculo solo. Si no sabés algún dato, dejalo en
        blanco — <strong style={{ color: 'var(--text-1)' }}>la app lo aprende de las
        cargas de combustible</strong> a medida que las vayas cargando.
      </p>

      {/* NIVEL 1 — identificar la unidad. Un solo buscador en vez de una
          cascada de selects: escribir "Renault Master" alcanza, no hace falta
          saber el año ni la versión exactos de memoria. */}
      <div style={{ marginBottom: 20 }}>
        {fuenteCat === 'referencia' ? (
          // Rama referencia: buscador contra la tabla global, con prellenado +
          // trazabilidad (verificado / sin verificar). Lo que precarga va al
          // form (per-tenant) y sigue editable abajo.
          <PrecargaReferencia
            fichaExt={fichaExt}
            vehiculoAnio={form.anio}
            onPrecargar={specs => setForm(f => ({ ...f, ...specs }))}
          />
        ) : (
          // Rama legacy (tabla ausente o sin sembrar): buscador sobre
          // data/motores.js. Elegir precarga los campos de abajo (que siguen
          // editables). Mismo patrón que "elegir chofer del legajo" en Viajes.
          <Field label="Buscá la unidad en el catálogo (valores de referencia, ajustables)">
            <Input
              list="catalogo-motores-legacy"
              value={motorTexto}
              onChange={e => elegirMotorTexto(e.target.value)}
              placeholder="Ej: Renault Master, Toyota Hilux…"
            />
            <datalist id="catalogo-motores-legacy">
              {MOTORES.map(m => <option key={m.id} value={etiquetaMotor(m)} />)}
            </datalist>
          </Field>
        )}
      </div>

      {/* NIVEL 2 — lo esencial: sólo estos dos datos mueven el número. Todo lo
          demás tiene un valor de referencia por clase si falta. */}
      <p className="db-slabel" style={{ marginBottom: 10 }}>Lo esencial para estimar</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="¿Cuánto gasta en ciudad, vacía? (litros cada 100 km)">
          <Input type="number" step="0.1" min="0" value={form.consumo_urbano_l100} onChange={e => set('consumo_urbano_l100', e.target.value)} placeholder="Ej: 12.5" />
        </Field>
        <Field label="¿Cuánto gasta en ruta, vacía? (litros cada 100 km)">
          <Input type="number" step="0.1" min="0" value={form.consumo_ruta_l100} onChange={e => set('consumo_ruta_l100', e.target.value)} placeholder="Ej: 9.5" />
        </Field>

        {/* Fuente del consumo, como pregunta binaria en vez de un select con
            4 términos técnicos (homologado/fabricante/benchmark/estimado): el
            operario no tiene que saber qué significa cada uno. "Sí" = el dato
            que salió de la precarga del catálogo o de la ficha técnica oficial
            (se corrige +18%, es optimista); "No" = un número aproximado, de
            experiencia o de otra fuente (se usa tal cual). Sólo aparece una vez
            que hay algo escrito arriba — antes de eso no está preguntando nada
            todavía. */}
        {fichaExt && huboConsumo && (
          <div className="sm:col-span-2">
            <Field label="¿Es el dato oficial de la ficha técnica de fábrica?">
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  ['homologado', 'Sí, es de la ficha oficial'],
                  ['benchmark_flota', 'No, es aproximado'],
                ].map(([valor, label]) => {
                  const activo = form.fuente_consumo === valor
                  return (
                    <button
                      key={valor}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => set('fuente_consumo', valor)}
                      style={{
                        flex: 1, padding: '9px 12px', borderRadius: 'var(--radius)', cursor: 'pointer',
                        fontSize: 12.5, fontWeight: 600, transition: 'background 120ms, color 120ms',
                        border: `1px solid ${activo ? 'transparent' : 'var(--border)'}`,
                        background: activo ? 'var(--accent-dim)' : 'var(--bg-overlay)',
                        color: activo ? 'var(--accent)' : 'var(--text-2)',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              {form.fuente_consumo === 'homologado' && (
                <p style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.5 }}>
                  El dato oficial suele ser optimista frente al uso real: se corrige un 18% al alza.
                </p>
              )}
              {form.fuente_consumo === 'benchmark_flota' && (
                <p style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.5 }}>
                  Se usa tal cual, sin corrección — ya es un número de uso real.
                </p>
              )}
            </Field>
          </div>
        )}

        <div className="sm:col-span-2">
          <Field label="¿Cuánto pesa esta unidad vacía? (kg)">
            <Input type="number" step="1" min="0" value={form.tara_kg} onChange={e => set('tara_kg', e.target.value)} placeholder="Ej: 2150" />
          </Field>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16, fontSize: 11, color: 'var(--text-2)' }}>
        <span style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--bg-overlay)' }}>
          Clase para el cálculo: <strong style={{ color: 'var(--text-1)' }}>{CLASES[clase].label}</strong>
          {!form.clase && (tara == null ? ' (sin tara ni clase declarada)' : ' (deducida de la tara)')}
        </span>
        {fichaExt && (
          <span style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--bg-overlay)' }}>
            Ralentí usado: <strong className="num" style={{ color: 'var(--text-1)' }}>{ralentiUsado.toFixed(1)} L/h</strong>
            {ralentiFicha == null ? ' · estimado por clase y cilindrada' : ' · de la ficha'}
          </span>
        )}
      </div>

      {/* Los tres números de la unidad. El teórico es de la ficha, el real sale
          de las cargas a tanque lleno y el usado es la mezcla que estima: se
          muestran juntos para que el desvío se vea, no sólo el resultado. */}
      {cal && (
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {[
            ['Teórico (ficha, mixto)', fmtL100(cal.teoricoBase), 'corregido por la fuente del dato', !cal.ok],
            ['Real medido', cal.real != null ? fmtL100(cal.real) : '—',
              cal.real != null
                ? `${cal.n} ${cal.n === 1 ? 'carga medible' : 'cargas medibles'} a tanque lleno · ${Math.round(cal.kmCubiertos).toLocaleString('es-AR')} km`
                : (fichaExt ? 'marcá las cargas hechas a tanque lleno para poder medirlo' : 'requiere la migración de la ficha extendida'),
              false],
            ['Usado por el estimador', fmtL100(cal.ok ? cal.usadoBase : cal.teoricoBase),
              cal.ok ? `el medido pesa ${Math.round(cal.w * 100)}%` : 'todavía es el teórico', cal.ok],
          ].map(([label, valor, sub, destacado]) => (
            <div key={label} style={{
              padding: '9px 11px', borderRadius: 'var(--radius-sm)',
              background: destacado ? 'var(--accent-dim)' : 'var(--bg-overlay)',
              border: `1px solid ${destacado ? 'transparent' : 'var(--border)'}`,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: destacado ? 'var(--accent)' : 'var(--text-3)' }}>{label}</div>
              <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginTop: 3 }}>{valor}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.4 }}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {cal?.ok && cal.desvio != null && Math.abs(cal.desvio) > 0.10 && (
        <p style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 10, lineHeight: 1.5 }}>
          Esta unidad consume un{' '}
          <strong style={{ color: cal.desvio > 0 ? 'var(--warning)' : 'var(--positive)' }}>
            {Math.round(Math.abs(cal.desvio) * 100)}% {cal.desvio > 0 ? 'más' : 'menos'}
          </strong>{' '}
          de lo que dice su ficha. Si el desvío se sostiene, el dato de la ficha está
          mal cargado o la unidad tiene algo.
        </p>
      )}

      {/* NIVEL 3 — el resto de la ficha. Nada de acá es obligatorio para tener
          un estimado: potencia, torque, norma de emisión, etc. no entran al
          cálculo, y PBT/carrocería/tanque/ralentí tienen un valor de
          referencia por clase si faltan. Colapsado por defecto. */}
      <button
        type="button"
        onClick={() => setVerDetalle(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 18, padding: 0,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 12, fontWeight: 700, color: 'var(--text-1)',
        }}
      >
        {verDetalle ? <ChevronDown size={14} style={{ color: ACCENT }} /> : <ChevronRight size={14} style={{ color: ACCENT }} />}
        Ficha técnica completa
        <span style={{ fontWeight: 500, color: 'var(--text-2)' }}>— opcional, para más precisión</span>
      </button>

      {verDetalle && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginTop: 14 }}>
          <div className="sm:col-span-2">
            <Field label="Motorización (descriptivo)">
              <Input value={form.motor_desc} onChange={e => set('motor_desc', e.target.value)} placeholder="Ej: 2.3 dCi (G9U/M9T) 130 cv" />
            </Field>
          </div>
          <Field label="Carga útil máxima (kg)">
            <Input type="number" step="1" min="0" value={form.carga_max_kg} onChange={e => set('carga_max_kg', e.target.value)} placeholder="Ej: 1550" />
          </Field>

          {fichaExt && <>
            <Field label="Clase de unidad">
              <Select value={form.clase} onChange={e => set('clase', e.target.value)}>
                <option value="">— Deducir de la tara —</option>
                {CLASE_IDS.map(id => <option key={id} value={id}>{CLASES[id].label} · {CLASES[id].hint}</option>)}
              </Select>
            </Field>
            <Field label="Cilindrada (L)">
              <Input type="number" step="0.1" min="0" value={form.motor_cilindrada_l} onChange={e => set('motor_cilindrada_l', e.target.value)} placeholder="Ej: 2.3" />
            </Field>
            <Field label="Potencia (CV)">
              <Input type="number" step="1" min="0" value={form.motor_potencia_cv} onChange={e => set('motor_potencia_cv', e.target.value)} placeholder="Ej: 130" />
            </Field>
            <Field label="Torque (Nm)">
              <Input type="number" step="1" min="0" value={form.motor_torque_nm} onChange={e => set('motor_torque_nm', e.target.value)} placeholder="Ej: 320" />
            </Field>
            <Field label="Combustible del motor">
              <Select value={form.motor_combustible} onChange={e => set('motor_combustible', e.target.value)}>
                <option value="">— Sin declarar —</option>
                {COMBUSTIBLES_MOTOR.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </Field>
            <Field label="Norma de emisión">
              <Input value={form.norma_emision} onChange={e => set('norma_emision', e.target.value)} list="normas-emision" placeholder="Ej: Euro V" />
              <datalist id="normas-emision">{NORMAS_EMISION.map(n => <option key={n} value={n} />)}</datalist>
            </Field>
            <Field label="Transmisión">
              <Select value={form.transmision} onChange={e => set('transmision', e.target.value)}>
                <option value="">— Sin declarar —</option>
                {TRANSMISIONES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Relación de diferencial">
              <Input value={form.relacion_diferencial} onChange={e => set('relacion_diferencial', e.target.value)} placeholder="Ej: 3.42" />
            </Field>
            <Field label="Consumo mixto (L/100km)">
              <Input type="number" step="0.1" min="0" value={form.consumo_mixto_l100} onChange={e => set('consumo_mixto_l100', e.target.value)} placeholder="Se usa sólo si faltan los dos de arriba" />
            </Field>
            <Field label="PBT — peso bruto total (kg)">
              <Input type="number" step="1" min="0" value={form.pbt_kg} onChange={e => set('pbt_kg', e.target.value)} placeholder="Ej: 3500" />
            </Field>
            <Field label="Tipo de carrocería">
              <Select value={form.carroceria} onChange={e => set('carroceria', e.target.value)}>
                {Object.entries(CARROCERIAS).map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
              </Select>
            </Field>
            <Field label="Capacidad del tanque (L)">
              <Input type="number" step="1" min="0" value={form.tanque_l} onChange={e => set('tanque_l', e.target.value)} placeholder="Ej: 80" />
            </Field>
            <Field label="Consumo en ralentí (L/h)">
              <Input type="number" step="0.1" min="0" value={form.consumo_ralenti_lh} onChange={e => set('consumo_ralenti_lh', e.target.value)} placeholder={`Si falta: ${ralentiUsado.toFixed(1)} estimado`} />
            </Field>
          </>}
        </div>
      )}

    </div>
  )
}

export default function Vehiculo() {
  const { data, update } = useStore()
  const { puedeEditar, profile } = useAuth()
  const editable = puedeEditar('vehiculo')
  const { addToast } = useToast()
  const confirmar = useConfirm()
  const flota = (data.vehiculos || []).filter(x => x.activo !== false)

  const [editingId, setEditingId] = useState(null)   // null | 'new' | id
  const [form, setForm] = useState(emptyVehiculo)

  // ¿Están aplicadas las migraciones del estimador? Son dos y se chequean por
  // separado: con la primera aplicada y la segunda no, la ficha muestra los
  // campos básicos y esconde los extendidos.
  const [consumoOn, setConsumoOn] = useState(false)
  const [fichaExtOn, setFichaExtOn] = useState(false)
  useEffect(() => { let vivo = true; consumoDisponible().then(ok => { if (vivo) setConsumoOn(ok) }); return () => { vivo = false } }, [])
  useEffect(() => { let vivo = true; fichaExtDisponible().then(ok => { if (vivo) setFichaExtOn(ok) }); return () => { vivo = false } }, [])

  // ¿Y la de documentos por vehículo? (tabla vehiculo_docs + bucket)
  const [docsOn, setDocsOn] = useState(false)
  useEffect(() => { let vivo = true; docsDisponible().then(ok => { if (vivo) setDocsOn(ok) }); return () => { vivo = false } }, [])

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
    // Marca de si el ralentí lo puso el usuario o lo estima la app. Se guarda
    // para que la ficha no presente después un número estimado como si fuera del
    // manual (lo lee specsVehiculo).
    if (fichaExtOn) fila.consumo_ralenti_est = fila.consumo_ralenti_lh ? '' : 'si'
    // Sin la migración de consumo aplicada estas columnas no existen: mandarlas
    // haría fallar el guardado ENTERO del vehículo (mismo patrón que despacho).
    if (!consumoOn)  for (const k of CAMPOS_CONSUMO_VEHICULO) delete fila[k]
    if (!fichaExtOn) for (const k of CAMPOS_FICHA_VEHICULO)   delete fila[k]
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

        {consumoOn && (
          <ConsumoSpecs
            form={form} set={set} setForm={setForm}
            combustible={data.combustible}
            viajes={data.viajes}
            fichaExt={fichaExtOn}
          />
        )}

        {/* Sólo al editar una unidad que YA existe: la fila de `vehiculo_docs`
            referencia `vehiculos.id` y con un vehículo sin guardar el insert
            fallaría por la foreign key. */}
        {docsOn && editingId !== 'new' && (
          <DocsVehiculo
            vehiculoId={form.id}
            organizationId={profile?.organization_id}
            editable={editable}
            // La lectura asistida sólo aparece con la ficha extendida aplicada:
            // sin esas columnas no habría dónde poner lo que se extraiga. Los
            // valores propuestos van al FORM, nunca directo a la base — la
            // confirmación humana es parte del flujo, no un extra.
            extraAccion={(editable && fichaExtOn) ? (d => (
              <ExtraerFicha
                doc={d}
                clase={claseDe(form)}
                onAplicar={patch => setForm(f => ({ ...f, ...patch }))}
              />
            )) : null}
          />
        )}
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
