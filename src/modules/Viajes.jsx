import React, { useState, useMemo, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId } from '../utils/format'
import { toISO } from '../utils/fecha'
import { toHora, formatHora, horaOrden } from '../utils/hora'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea, BtnPrimary, BtnCancel } from '../components/shared/Field'
import { MapPin, Plus, Trash2, Edit2, Calculator } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { calcularTarifa, tarifasConfiguradas } from '../utils/tarifas'

const TIPOS   = ['Excursión', 'Traslado', 'Turismo', 'Charter', 'Escolar', 'Corporativo', 'Otro']
const ESTADOS = ['Pendiente', 'Confirmado', 'Realizado', 'Cancelado']

const ESTADO_STYLES = {
  Pendiente:  { bg: 'var(--warning-dim)',  color: 'var(--warning)'  },
  Confirmado: { bg: 'var(--accent-dim)',   color: 'var(--accent)'   },
  Realizado:  { bg: 'var(--positive-dim)', color: 'var(--positive)' },
  Cancelado:  { bg: 'var(--danger-dim)',   color: 'var(--danger)'   },
}

const ESTADO_FALLBACK = { bg: 'var(--bg-overlay)', color: 'var(--text-2)' }

// Mantiene el valor actual como opción aunque no esté en la lista canónica.
//
// Sin esto, editar una fila con un valor legacy la corrompe en silencio: hay
// viajes con tipo 'Mudanza' o 'Flete' (vocabulario viejo, ya no está en TIPOS).
// El <select> no encuentra ninguna <option> que matchee, el navegador cae en la
// PRIMERA, y al guardar el tipo pasaba de 'Mudanza' a 'Excursión' sin que nadie
// lo tocara. Mismo problema con un vehículo archivado (no está entre los activos).
const conValorActual = (opciones, actual) =>
  actual && !opciones.includes(actual) ? [actual, ...opciones] : opciones

const empty = () => ({
  id: genId(), fecha: todayISO(), hora: '', cliente: '', tipo: 'Excursión',
  origen: '', destino: '', monto_sena: '', monto_total: '', estado: 'Pendiente', notas: '',
  vehiculo_id: '',
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
  const [modal, setModal]             = useState(false)
  const [editId, setEditId]           = useState(null)
  const [form, setForm]               = useState(empty())
  const [errors, setErrors]           = useState({})
  const [calc, setCalc]               = useState({ horas: '', conPeon: false })

  const orgSettings  = data.orgSettings || {}
  const mostrarCalc  = tarifasConfiguradas(orgSettings)

  // Opciones del modal, preservando lo que la fila ya tiene guardado.
  const tiposOpciones   = useMemo(() => conValorActual(TIPOS, form.tipo), [form.tipo])
  const estadosOpciones = useMemo(() => conValorActual(ESTADOS, form.estado), [form.estado])

  // Un vehículo archivado (activo: false) no está entre los seleccionables, pero
  // si este viaje lo tiene asignado tiene que seguir apareciendo: si no, el Select
  // caía en "Sin asignar" y guardar lo desvinculaba solo.
  const vehiculosOpciones = useMemo(() => {
    const todos   = data.vehiculos || []
    const activos = todos.filter(v => v.activo !== false)
    const asignado = todos.find(v => v.id === form.vehiculo_id)
    return asignado && asignado.activo === false ? [asignado, ...activos] : activos
  }, [data.vehiculos, form.vehiculo_id])

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

  const openNew = () => {
    setEditId(null); setForm(empty()); setErrors({})
    setCalc({ horas: '', conPeon: false }); setModal(true)
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
  const handleDelete = id => {
    if (!confirm('¿Eliminar este viaje?')) return
    const ingresos = data.ingresos || []
    if (ingresos.some(i => i.viaje_id === id)) {
      update('ingresos', ingresos.filter(i => i.viaje_id !== id))
    }
    update('viajes', list.filter(r => r.id !== id))
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
      key: 'acciones', label: '', render: r => editable ? (
        <div className="flex gap-1">
          <button
            onClick={() => openEdit(r)}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-2)' }}
            aria-label={`Editar viaje de ${r.cliente || 'sin cliente'}`}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-tint-md)'; e.currentTarget.style.color = 'var(--text-1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-2)' }}
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleDelete(r.id)}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--danger)' }}
            aria-label={`Eliminar viaje de ${r.cliente || 'sin cliente'}`}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-dim)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '' }}
          >
            <Trash2 size={14} />
          </button>
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
