import React, { useState, useMemo, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useStore, getData } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId } from '../utils/format'
import { toISO } from '../utils/fecha'
import { toHora, formatHora, horaOrden } from '../utils/hora'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea, BtnPrimary, BtnCancel } from '../components/shared/Field'
import { MapPin, Plus, Trash2, Edit2, Calculator, FileText, ChevronRight, ChevronDown, Copy, Share2, Power, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { useRegistroDestacado } from '../hooks/useRegistroDestacado'
import { conValorActual, vehiculosSeleccionables } from '../utils/form'
import { calcularTarifa, tarifasConfiguradas } from '../utils/tarifas'
import {
  CAMPOS_DESPACHO, CARGA_TIPOS, CUSTODIA_TIPOS,
  emptyDespacho, despachoDisponible, armarFichaDespacho,
} from '../utils/despacho'
import { trackingDisponible, generarTokenTracking, linkTracking } from '../utils/tracking'

const TIPOS   = ['Excursión', 'Traslado', 'Turismo', 'Charter', 'Escolar', 'Corporativo', 'Otro']
const ESTADOS = ['Pendiente', 'Confirmado', 'Realizado', 'Cancelado']

const ESTADO_STYLES = {
  Pendiente:  { bg: 'var(--warning-dim)',  color: 'var(--warning)'  },
  Confirmado: { bg: 'var(--accent-dim)',   color: 'var(--accent)'   },
  Realizado:  { bg: 'var(--positive-dim)', color: 'var(--positive)' },
  Cancelado:  { bg: 'var(--danger-dim)',   color: 'var(--danger)'   },
}

const ESTADO_FALLBACK = { bg: 'var(--bg-overlay)', color: 'var(--text-2)' }

// Los campos de despacho van en el form SIEMPRE (inputs controlados), pero
// handleSave los saca del payload si la migración 20260718120000 no está
// aplicada (ver utils/despacho.js).
const empty = () => ({
  id: genId(), fecha: todayISO(), hora: '', cliente: '', tipo: 'Excursión',
  origen: '', destino: '', monto_sena: '', monto_total: '', estado: 'Pendiente', notas: '',
  vehiculo_id: '',
  ...emptyDespacho(),
})

function EstadoBadge({ estado, id, onChange }) {
  const s = ESTADO_STYLES[estado] || ESTADO_FALLBACK
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

  // La command palette (Ctrl+K) llega con la búsqueda elegida en location.state.q
  // (ver useNav). Efecto y no initial state: si ya estás parado en Viajes, el
  // componente no se remonta y el valor nuevo tiene que entrar igual.
  const location = useLocation()
  useEffect(() => {
    if (location.state?.q != null) setSearch(location.state.q)
  }, [location.state])

  // Deep link a un viaje (/#/viajes/:id): limpia filtros que taparían la fila y
  // la resalta. Llegan así la palette, las notificaciones y el Dashboard.
  const destacadoId = useRegistroDestacado(list, {
    listo: !loading,
    onEncontrado: () => { setSearch(''); setEstadoFilter('') },
  })
  const [modal, setModal]             = useState(false)
  const [editId, setEditId]           = useState(null)
  const [form, setForm]               = useState(empty())
  const [errors, setErrors]           = useState({})
  const [calc, setCalc]               = useState({ horas: '', conPeon: false })
  const [ficha, setFicha]             = useState(null)   // viaje cuya ficha de despacho se muestra
  const [share, setShare]             = useState(null)   // viaje cuyo link de seguimiento se comparte
  const [showDespacho, setShowDespacho] = useState(false)
  const [despachoOn, setDespachoOn]   = useState(false)
  const [trackingOn, setTrackingOn]   = useState(false)
  useEffect(() => { let vivo = true; despachoDisponible().then(ok => { if (vivo) setDespachoOn(ok) }); return () => { vivo = false } }, [])
  useEffect(() => { let vivo = true; trackingDisponible().then(ok => { if (vivo) setTrackingOn(ok) }); return () => { vivo = false } }, [])

  const orgSettings  = data.orgSettings || {}
  const mostrarCalc  = tarifasConfiguradas(orgSettings)
  const choferesActivos = useMemo(
    () => (data.choferes || []).filter(c => c.activo !== false && (c.nombre || c.dni)),
    [data.choferes]
  )

  // Opciones del modal, preservando lo que la fila ya tiene guardado (valores
  // legacy tipo 'Mudanza'/'Flete' y vehículos archivados; ver utils/form.js).
  const tiposOpciones   = useMemo(() => conValorActual(TIPOS, form.tipo), [form.tipo])
  const estadosOpciones = useMemo(() => conValorActual(ESTADOS, form.estado), [form.estado])
  const vehiculosOpciones = useMemo(
    () => vehiculosSeleccionables(data.vehiculos, form.vehiculo_id),
    [data.vehiculos, form.vehiculo_id]
  )

  const { puedeEditar } = useAuth()
  const editable = puedeEditar('viajes')
  const { addToast } = useToast()
  const confirmar = useConfirm()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.cliente.trim()) e.cliente  = 'Requerido'
    if (!form.origen.trim())  e.origen   = 'Requerido'
    if (!form.destino.trim()) e.destino  = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const openNew = () => {
    setEditId(null); setForm(empty()); setErrors({})
    setCalc({ horas: '', conPeon: false }); setShowDespacho(false); setModal(true)
  }

  // Al abrir para editar hay que NORMALIZAR sí o sí: <input type="date"> sólo
  // acepta 'YYYY-MM-DD' y <input type="time"> sólo 'HH:MM' 24h. La base tiene
  // filas con fecha '6/6/2026' y hora '9:00:00 AM' (las que escribe n8n): el
  // navegador las rechaza como valor inválido, deja el campo VACÍO y al guardar
  // se borraba el dato. `...empty()` primero para que las filas viejas sin
  // `hora`/`vehiculo_id` tengan la clave definida y el input quede controlado.
  const openEdit = (r) => {
    setEditId(r.id)
    setForm({
      ...empty(),
      // null → '' : la base guarda null en los campos vacíos (notas, vehiculo_id)
      // y React avisa "`value` prop should not be null" y pasa el input a no
      // controlado. Los inputs quieren string; el '' vuelve a null al guardar.
      ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ''])),
      fecha: toISO(r.fecha),
      hora: toHora(r.hora),
    })
    setErrors({})
    setCalc({ horas: '', conPeon: false })
    // Si la fila ya tiene datos de despacho, la sección arranca abierta.
    setShowDespacho(CAMPOS_DESPACHO.some(k => r[k]))
    setModal(true)
  }

  // Calculadora de tarifa: autocompleta monto_total y monto_sena desde org_settings
  const aplicarCalc = (next) => {
    setCalc(next)
    const { total, sena } = calcularTarifa(orgSettings, next)
    setForm(f => ({
      ...f,
      monto_total: total ? String(Math.round(total)) : '',
      monto_sena:  sena  ? String(Math.round(sena))  : '',
    }))
  }
  // Un viaje Realizado con monto tiene un ingreso espejo en Finanzas, vinculado
  // por `viaje_id`. Esta es la ÚNICA función que lo mantiene al día: crea, refresca
  // o borra según corresponda.
  //
  // Antes la lógica vivía sólo acá adentro de handleEstado (el dropdown de la
  // tabla), que únicamente cambia el estado. Al sumar la edición aparecieron dos
  // casos que quedaban rotos: pasar un viaje de Realizado a Cancelado DESDE EL
  // MODAL dejaba el ingreso colgado, y editarle el monto a un viaje ya Realizado
  // dejaba a Finanzas con el importe viejo (el useEffect de abajo sólo crea los
  // que faltan, nunca actualiza ni borra).
  //
  // Sólo para viajes que YA existen en la base. Para uno nuevo lo sigue creando
  // el useEffect una vez guardado el viaje, para no insertar el ingreso antes que
  // el viaje que referencia.
  const sincronizarIngreso = (viaje) => {
    const ingresos = data.ingresos || []
    const existente = ingresos.find(i => i.viaje_id === viaje.id)
    const corresponde = viaje.estado === 'Realizado' && viaje.monto_total

    if (!corresponde) {
      if (existente) update('ingresos', ingresos.filter(i => i.viaje_id !== viaje.id))
      return
    }

    const campos = {
      fecha: toISO(viaje.fecha),
      descripcion: `Viaje: ${viaje.cliente} — ${viaje.origen} → ${viaje.destino}`,
      importe: viaje.monto_total,
      cliente: viaje.cliente,
    }

    if (!existente) {
      update('ingresos', [{
        id: genId(), tipo: 'ingreso', viaje_id: viaje.id,
        categoria: 'Servicio de transporte',
        comprobante: '', notas: '',
        ...campos,
      }, ...ingresos])
      return
    }

    // Ya existe: reescribir sólo si algo cambió, para no mandar un UPDATE al pedo.
    if (Object.entries(campos).some(([k, v]) => existente[k] !== v)) {
      update('ingresos', ingresos.map(i => i.viaje_id === viaje.id ? { ...i, ...campos } : i))
    }
  }

  // Se guarda normalizado: fecha ISO y hora 'HH:MM' 24h. La base tiene filas
  // viejas en otros formatos (n8n escribe '9:00:00 AM'), pero las nuevas salen
  // todas iguales.
  const handleSave = () => {
    if (!validate()) return
    const viaje = {
      ...form,
      fecha: toISO(form.fecha),
      hora: toHora(form.hora),
      // `vehiculo_id` es uuid en la base y el Select manda '' en "Sin asignar".
      // Postgres rechaza el string vacío ("invalid input syntax for type uuid"),
      // así que guardar un viaje sin vehículo fallaba entero y el viaje se perdía
      // con un toast genérico. uuid vacío se representa con NULL, no con ''.
      vehiculo_id: form.vehiculo_id || null,
    }
    // Sin la migración de despacho aplicada, estas columnas no existen en la
    // base y mandarlas haría fallar el guardado ENTERO del viaje.
    if (!despachoOn) for (const k of CAMPOS_DESPACHO) delete viaje[k]
    if (editId) {
      update('viajes', list.map(r => r.id === editId ? viaje : r))
      sincronizarIngreso(viaje)
    } else {
      update('viajes', [viaje, ...list])
      // El ingreso lo crea el useEffect cuando el viaje ya está guardado.
    }
    setModal(false)
  }

  // Borrar el viaje tiene que llevarse su ingreso espejo. Antes no lo hacía:
  // borrar un viaje Realizado dejaba el ingreso colgado en Finanzas para siempre,
  // sin viaje que lo respalde y sin forma de encontrarlo desde acá.
  //
  // El deshacer restaura SOLO el viaje contra el estado fresco del store
  // (getData); el ingreso espejo lo recrea el useEffect de abajo — reinsertarlo
  // acá correría en paralelo con el insert del viaje y rompería la FK viaje_id.
  const handleDelete = async id => {
    const viaje = list.find(r => r.id === id)
    if (!viaje) return
    const tieneEspejo = (data.ingresos || []).some(i => i.viaje_id === id)
    const ok = await confirmar({
      titulo: 'Eliminar viaje',
      mensaje: `Se elimina el viaje de ${viaje.cliente || 'sin cliente'} del ${formatDate(viaje.fecha)}.`
        + (tieneEspejo ? ' También se elimina su ingreso en Finanzas.' : ''),
    })
    if (!ok) return
    if (tieneEspejo) {
      update('ingresos', (data.ingresos || []).filter(i => i.viaje_id !== id))
    }
    update('viajes', list.filter(r => r.id !== id))
    addToast({
      message: 'Viaje eliminado.',
      Icon: Trash2,
      color: 'var(--danger)',
      duration: 6000,
      action: { label: 'Deshacer', onClick: () => update('viajes', [viaje, ...(getData().viajes || [])]) },
    })
  }

  const handleEstado = (id, nuevoEstado) => {
    const viaje = list.find(r => r.id === id)
    if (!viaje) return
    const actualizado = { ...viaje, estado: nuevoEstado }
    sincronizarIngreso(actualizado)
    update('viajes', list.map(r => r.id === id ? actualizado : r))
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
      // Más reciente primero y, dentro del mismo día, por hora.
      //
      // Se ordena por toISO(fecha) y no por el string crudo: la base tiene fechas
      // mezcladas ('2026-05-28' y '6/6/2026'), y comparar eso como texto ponía
      // cualquier fila con barras arriba de todo sin importar la fecha real.
      .sort((a, b) => {
        const f = toISO(b.fecha || '').localeCompare(toISO(a.fecha || ''))
        return f !== 0 ? f : horaOrden(a.hora) - horaOrden(b.hora)
      })
  }, [list, search, estadoFilter])

  const totalEsperado  = list.filter(r => r.estado === 'Pendiente' || r.estado === 'Confirmado').reduce((s, r) => s + (parseFloat(r.monto_total) || 0), 0)
  const totalConfirmado = list.filter(r => r.estado === 'Confirmado').reduce((s, r) => s + (parseFloat(r.monto_total) || 0), 0)
  const totalRealizado  = list.filter(r => r.estado === 'Realizado').reduce((s, r) => s + (parseFloat(r.monto_total) || 0), 0)

  const cols = [
    { key: 'fecha',   label: 'Fecha',   render: r => formatDate(r.fecha) },
    { key: 'hora',    label: 'Hora',    render: r => r.hora
        ? <span className="num">{formatHora(r.hora)}</span>
        : <span style={{ color: 'var(--text-3)' }}>—</span> },
    { key: 'cliente', label: 'Cliente', render: r => <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{r.cliente}</span> },
    { key: 'tipo',    label: 'Tipo' },
    { key: 'origen',  label: 'Origen' },
    { key: 'destino', label: 'Destino' },
    { key: 'monto_sena',  label: 'Seña',  render: r => r.monto_sena  ? <span className="num">{formatARS(r.monto_sena)}</span>  : <span style={{ color: 'var(--text-3)' }}>—</span> },
    { key: 'monto_total', label: 'Total', render: r => r.monto_total ? <span className="num font-semibold" style={{ color: 'var(--accent)' }}>{formatARS(r.monto_total)}</span> : <span style={{ color: 'var(--text-3)' }}>—</span> },
    { key: 'estado', label: 'Estado', render: r => editable
        ? <EstadoBadge estado={r.estado} id={r.id} onChange={handleEstado} />
        : <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: (ESTADO_STYLES[r.estado] || ESTADO_FALLBACK).bg, color: (ESTADO_STYLES[r.estado] || ESTADO_FALLBACK).color }}>{r.estado}</span>
    },
    {
      key: 'acciones', label: '', render: r => (
        <div className="flex gap-1">
          <button
            onClick={() => setFicha(r)}
            className="icon-btn icon-btn-accent"
            aria-label={`Ficha de despacho del viaje de ${r.cliente || 'sin cliente'}`}
            title="Ficha de despacho"
          >
            <FileText size={14} />
          </button>
          {editable && trackingOn && (
            <button
              onClick={() => setShare(r)}
              className={`icon-btn${r.tracking_activo ? ' icon-btn-accent' : ''}`}
              aria-label={`Compartir seguimiento del viaje de ${r.cliente || 'sin cliente'}`}
              title={r.tracking_activo ? 'Link de seguimiento activo' : 'Compartir seguimiento'}
            >
              <Share2 size={14} />
            </button>
          )}
          {editable && <>
          <button
            onClick={() => openEdit(r)}
            className="icon-btn"
            aria-label={`Editar viaje de ${r.cliente || 'sin cliente'}`}
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleDelete(r.id)}
            className="icon-btn icon-btn-danger"
            aria-label={`Eliminar viaje de ${r.cliente || 'sin cliente'}`}
          >
            <Trash2 size={14} />
          </button>
          </>}
        </div>
      )
    },
  ]

  return (
    <div className="max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MapPin size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 className="mod-h1">Viajes</h1>
            <p className="mod-sub">Gestión de viajes y traslados</p>
          </div>
        </div>
        {editable && (
          <button className="glass-btn-primary" onClick={openNew}>
            <Plus size={15} /> Nuevo viaje
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 16 }}>
        {[
          { label: 'Ingresos esperados',  value: formatARS(totalEsperado),   color: 'var(--warning)',  sub: 'Pendientes + Confirmados' },
          { label: 'Confirmados',         value: formatARS(totalConfirmado), color: 'var(--accent)',   sub: `${list.filter(r => r.estado === 'Confirmado').length} viajes` },
          { label: 'Realizados',          value: formatARS(totalRealizado),  color: 'var(--positive)', sub: `${list.filter(r => r.estado === 'Realizado').length} viajes` },
        ].map((s, i) => (
          <div
            key={s.label}
            className={`surface surface-hover db-in db-d${i + 1}`}
            style={{ padding: '18px 22px' }}
          >
            <p className="db-slabel" style={{ marginBottom: 8 }}>{s.label}</p>
            <div className="nums" style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
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
            className="input-base"
            style={{ width: 'auto' }}
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <Table
          columns={cols} data={filtered} highlightId={destacadoId}
          emptyIcon={MapPin}
          emptyText={search || estadoFilter ? 'Sin resultados' : 'Todavía no hay viajes'}
          emptyHint={search || estadoFilter
            ? 'Probá con otros términos o quitá los filtros.'
            : 'Cargá tu primer viaje o esperá a que lleguen desde el formulario de carga.'}
          emptyAction={!search && !estadoFilter && editable ? { label: 'Nuevo viaje', Icon: Plus, onClick: openNew } : null}
        />
      </div>

      {/* ── Modal ── */}
      {modal && (
        <Modal title={editId ? 'Editar viaje' : 'Nuevo viaje'} onClose={() => setModal(false)} size="lg">
          <div className="grid grid-cols-2 gap-4">
            {mostrarCalc ? (
              <div className="col-span-2" style={{ padding: 14, borderRadius: 'var(--radius)', background: 'var(--accent-dim)', border: '1px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Calculator size={14} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>Calcular por tarifa</span>
                </div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ width: 120 }}>
                    <Field label="Horas">
                      <Input type="number" step="0.5" min="0" value={calc.horas} onChange={e => aplicarCalc({ ...calc, horas: e.target.value })} placeholder="0" />
                    </Field>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text-1)', cursor: 'pointer', padding: '9px 0' }}>
                    <input type="checkbox" checked={calc.conPeon} onChange={e => aplicarCalc({ ...calc, conPeon: e.target.checked })} style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
                    Con peón
                  </label>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-2)' }}>
                    Autocompleta total y seña ↓
                  </span>
                </div>
              </div>
            ) : (
              <div className="col-span-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                Cargá las tarifas en <strong style={{ color: 'var(--text-1)' }}>Configuración</strong> para calcular el precio automáticamente.
              </div>
            )}
            {/* Orden pensado para la grilla de 2 columnas: cada fila es un par que
                se lee junto (Fecha|Hora, Vehículo|Tipo, Cliente|Estado, Origen|Destino). */}
            <Field label="Fecha">
              <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </Field>
            <Field label="Hora de salida">
              <Input type="time" value={form.hora} onChange={e => set('hora', e.target.value)} />
            </Field>
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
            <Field label="Tipo de viaje">
              <Select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                {tiposOpciones.map(t => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Cliente" required>
              <Input value={form.cliente} onChange={e => set('cliente', e.target.value)} placeholder="Nombre del cliente o grupo" />
              {errors.cliente && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.cliente}</p>}
            </Field>
            <Field label="Estado">
              <Select value={form.estado} onChange={e => set('estado', e.target.value)}>
                {estadosOpciones.map(e => <option key={e}>{e}</option>)}
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
            {despachoOn ? (
              <div className="col-span-2">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowDespacho(s => !s)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-1)', padding: '9px 12px', width: '100%', cursor: 'pointer' }}
                >
                  {showDespacho ? <ChevronDown size={14} style={{ color: 'var(--accent)' }} /> : <ChevronRight size={14} style={{ color: 'var(--accent)' }} />}
                  Datos de despacho
                  <span style={{ fontWeight: 500, color: 'var(--text-2)' }}>— carga · chofer · custodia</span>
                </button>
              </div>
            ) : (
              <div className="col-span-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                Los datos de despacho (carga, chofer, custodia) se habilitan aplicando la migración
                {' '}<code style={{ color: 'var(--text-1)' }}>20260718120000_viajes_despacho.sql</code> en el SQL editor de Supabase.
              </div>
            )}
            {despachoOn && showDespacho && <>
              <div className="col-span-2" style={{ marginTop: 4 }}><p className="db-slabel">Carga</p></div>
              <Field label="Tipo de carga">
                <Input value={form.carga_tipo} onChange={e => set('carga_tipo', e.target.value)} list="carga-tipos" placeholder="General, pallets, granel..." />
                <datalist id="carga-tipos">{CARGA_TIPOS.map(t => <option key={t} value={t} />)}</datalist>
              </Field>
              <Field label="Bultos / pallets">
                <Input value={form.carga_bultos} onChange={e => set('carga_bultos', e.target.value)} placeholder="Ej: 32 pallets" />
              </Field>
              <Field label="Peso (kg)">
                <Input type="number" step="0.01" min="0" value={form.carga_peso_kg} onChange={e => set('carga_peso_kg', e.target.value)} placeholder="0" />
              </Field>
              <Field label="Volumen (m³)">
                <Input type="number" step="0.01" min="0" value={form.carga_volumen_m3} onChange={e => set('carga_volumen_m3', e.target.value)} placeholder="0" />
              </Field>
              <Field label="Valor declarado ($)">
                <Input type="number" step="0.01" min="0" value={form.carga_valor} onChange={e => set('carga_valor', e.target.value)} placeholder="0.00" />
              </Field>
              <Field label="Referencia / OC del dador">
                <Input value={form.referencia} onChange={e => set('referencia', e.target.value)} placeholder="Ej: OC-2026-114" />
              </Field>
              <div className="col-span-2">
                <Field label="Destinatario (recibe en destino)">
                  <Input value={form.destinatario} onChange={e => set('destinatario', e.target.value)} placeholder="Empresa / persona que recibe" />
                </Field>
              </div>

              <div className="col-span-2" style={{ marginTop: 4 }}><p className="db-slabel">Chofer y unidad</p></div>
              {choferesActivos.length > 0 && (
                <div className="col-span-2">
                  <Field label="Elegir chofer del legajo">
                    {/* Select-acción: elegir uno copia nombre/DNI/celular a los
                        campos de abajo (que siguen editables) y vuelve a vacío. */}
                    <Select
                      value=""
                      onChange={e => {
                        const c = choferesActivos.find(x => x.id === e.target.value)
                        if (c) setForm(f => ({ ...f, chofer_nombre: c.nombre || '', chofer_dni: c.dni || '', chofer_cel: c.celular || '' }))
                      }}
                    >
                      <option value="">— Completar a mano o elegir del legajo —</option>
                      {choferesActivos.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre || c.dni}{c.dni && c.nombre ? ` (DNI ${c.dni})` : ''}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              )}
              <Field label="Chofer">
                <Input value={form.chofer_nombre} onChange={e => set('chofer_nombre', e.target.value)} placeholder="Nombre y apellido" />
              </Field>
              <Field label="DNI">
                <Input value={form.chofer_dni} onChange={e => set('chofer_dni', e.target.value)} />
              </Field>
              <Field label="Celular">
                <Input value={form.chofer_cel} onChange={e => set('chofer_cel', e.target.value)} placeholder="11-..." />
              </Field>
              <Field label="Patente semi / acoplado">
                <Input value={form.patente_semi} onChange={e => set('patente_semi', e.target.value)} />
              </Field>

              <div className="col-span-2" style={{ marginTop: 4 }}><p className="db-slabel">Custodia y seguridad</p></div>
              <Field label="Custodia">
                <Select value={form.custodia_tipo} onChange={e => set('custodia_tipo', e.target.value)}>
                  <option value="">— Sin custodia —</option>
                  {CUSTODIA_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="Empresa de custodia">
                <Input value={form.custodia_empresa} onChange={e => set('custodia_empresa', e.target.value)} />
              </Field>
              <Field label="Contacto de custodia">
                <Input value={form.custodia_contacto} onChange={e => set('custodia_contacto', e.target.value)} placeholder="Nombre / teléfono" />
              </Field>
              <Field label="Empresa satelital">
                <Input value={form.satelital_empresa} onChange={e => set('satelital_empresa', e.target.value)} />
              </Field>
              <Field label="ID equipo satelital">
                <Input value={form.satelital_equipo} onChange={e => set('satelital_equipo', e.target.value)} />
              </Field>
              <Field label="Precintos">
                <Input value={form.precintos} onChange={e => set('precintos', e.target.value)} placeholder="Números, separados por coma" />
              </Field>
            </>}
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

      {/* ── Ficha de despacho ── */}
      {ficha && (() => {
        const veh   = (data.vehiculos || []).find(v => v.id === ficha.vehiculo_id)
        const texto = armarFichaDespacho(ficha, veh)
        const copiar = async () => {
          try {
            await navigator.clipboard.writeText(texto)
            addToast({ message: 'Ficha copiada al portapapeles.', Icon: Copy, color: 'var(--accent)' })
          } catch {
            addToast({ message: 'No se pudo copiar. Seleccioná el texto a mano.', color: 'var(--danger)' })
          }
        }
        return (
          <Modal title="Ficha de despacho" onClose={() => setFicha(null)}>
            <pre style={{
              whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, color: 'var(--text-1)',
              background: 'var(--bg-overlay)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: 16, maxHeight: 380, overflowY: 'auto',
            }}>{texto}</pre>
            {despachoOn && !CAMPOS_DESPACHO.some(k => ficha[k]) && (
              <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 10 }}>
                Este viaje no tiene datos de despacho todavía: editálo y completá la sección
                "Datos de despacho" para que la ficha salga con carga, chofer y custodia.
              </p>
            )}
            <div className="flex justify-end gap-3 mt-5">
              <BtnCancel onClick={() => setFicha(null)}>Cerrar</BtnCancel>
              <a
                className="glass-btn-primary"
                href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
                target="_blank" rel="noopener noreferrer"
              >
                Enviar por WhatsApp
              </a>
              <BtnPrimary onClick={copiar}><Copy size={14} /> Copiar</BtnPrimary>
            </div>
          </Modal>
        )
      })()}

      {/* ── Compartir seguimiento (link público por viaje) ── */}
      {share && (() => {
        // El viaje fresco del store: refleja el token/activo tras generar o apagar.
        const v      = (data.viajes || []).find(x => x.id === share.id) || share
        const activo = !!v.tracking_activo && !!v.tracking_token
        const link   = v.tracking_token ? linkTracking(v.tracking_token) : ''

        const guardar = campos =>
          update('viajes', (data.viajes || []).map(x => x.id === v.id ? { ...x, ...campos } : x))
        const activar   = () => guardar({ tracking_token: v.tracking_token || generarTokenTracking(), tracking_activo: true })
        const desactivar = () => guardar({ tracking_activo: false })
        const regenerar  = () => guardar({ tracking_token: generarTokenTracking(), tracking_activo: true })
        const copiar = async () => {
          try {
            await navigator.clipboard.writeText(link)
            addToast({ message: 'Link copiado al portapapeles.', Icon: Copy, color: 'var(--accent)' })
          } catch {
            addToast({ message: 'No se pudo copiar. Seleccioná el texto a mano.', color: 'var(--danger)' })
          }
        }
        const msgWa = `Seguí tu viaje${v.destino ? ` a ${v.destino}` : ''} en tiempo real: ${link}`

        return (
          <Modal title="Compartir seguimiento" onClose={() => setShare(null)}>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 16 }}>
              Un link para que el cliente vea el <strong>estado y la ubicación</strong> de este viaje
              sin entrar al sistema. No expone montos ni datos internos. Podés desactivarlo cuando
              quieras y el link deja de funcionar al instante.
            </p>

            {activo ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input
                    readOnly value={link}
                    onFocus={e => e.target.select()}
                    className="input-base"
                    style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                  />
                  <BtnPrimary onClick={copiar}><Copy size={14} /> Copiar</BtnPrimary>
                </div>
                <div className="flex justify-between items-center mt-5">
                  <button onClick={desactivar} className="quiet-btn" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <Power size={14} /> Desactivar link
                  </button>
                  <div className="flex gap-3">
                    <button onClick={regenerar} className="quiet-btn" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }} title="Invalida el link anterior y genera uno nuevo">
                      <RefreshCw size={14} /> Generar nuevo
                    </button>
                    <a className="glass-btn-primary" href={`https://wa.me/?text=${encodeURIComponent(msgWa)}`} target="_blank" rel="noopener noreferrer">
                      Enviar por WhatsApp
                    </a>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex justify-end gap-3 mt-2">
                <BtnCancel onClick={() => setShare(null)}>Cerrar</BtnCancel>
                <BtnPrimary onClick={activar}><Share2 size={14} /> Generar link</BtnPrimary>
              </div>
            )}
          </Modal>
        )
      })()}
    </div>
  )
}
