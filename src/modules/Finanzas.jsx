import React, { useState, useMemo } from 'react'
import { useStore, getData } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId, monthName } from '../utils/format'
import { toISO, fechaMes } from '../utils/fecha'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea, BtnCancel } from '../components/shared/Field'
import { TrendingUp, Trash2, Pencil, Download, ArrowUpCircle, ArrowDownCircle, ArrowRightLeft, Contact, Truck } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { useChartTheme } from '../utils/chartTheme'

const ACCENT = 'var(--accent)'
const C_ING  = 'var(--positive)'
const C_GAS  = 'var(--danger)'

const CATEGORIAS_INGRESO = ['Servicio de transporte', 'Alquiler de vehículo', 'Otro ingreso']
const CATEGORIAS_GASTO   = ['Combustible', 'Mantenimiento', 'Nómina', 'Seguro', 'Impuestos y tasas', 'Peajes', 'Administrativo', 'Otro gasto']

const emptyIngreso = () => ({ id: genId(), tipo: 'ingreso', fecha: todayISO(), descripcion: '', categoria: 'Servicio de transporte', importe: '', cliente: '',    comprobante: '', notas: '' })
const emptyGasto   = () => ({ id: genId(), tipo: 'gasto',   fecha: todayISO(), descripcion: '', categoria: 'Combustible',            importe: '', proveedor: '', comprobante: '', notas: '' })

const monto = r => parseFloat(r?.importe) || 0

// Primer día del período, en ISO local. '' = sin límite (todo el historial).
function desdeISO(periodo) {
  if (periodo === 'todo') return ''
  const d = new Date()
  if (periodo === 'mes') d.setDate(1)
  else d.setMonth(d.getMonth() - (periodo === '3m' ? 3 : 12))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Las fechas viejas vienen en formatos mezclados: comparar SIEMPRE vía toISO.
const enPeriodo = (fecha, desde) => !desde || toISO(fecha) >= desde

function Segmented({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map(([val, lbl]) => (
        <button key={val} onClick={() => onChange(val)} className={value === val ? 'seg-btn is-active' : 'seg-btn'}>
          {lbl}
        </button>
      ))}
    </div>
  )
}

const PERIODOS = [['mes', 'Este mes'], ['3m', '3 meses'], ['12m', '12 meses'], ['todo', 'Todo']]

function KpiCard({ label, value, color, delay, sub }) {
  return (
    <div className={`surface surface-hover db-in db-d${delay}`} style={{ padding: '18px 20px 18px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 12, bottom: 12, left: 0, width: 3, borderRadius: '0 3px 3px 0', background: color, opacity: 0.75 }} />
      <p className="db-slabel" style={{ marginBottom: 8 }}>{label}</p>
      <div className="num" style={{ fontSize: 19, fontWeight: 700, color }}>{value}</div>
      {sub && <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

// Lista con barras proporcionales (desglose por categoría / top clientes).
function BarList({ items, color, emptyText }) {
  if (!items.length) return <div className="db-empty">{emptyText}</div>
  const max = Math.max(...items.map(i => i.value))
  const total = items.reduce((s, i) => s + i.value, 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map(i => (
        <div key={i.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 12 }}>{i.label}</span>
            <span className="num" style={{ color: 'var(--text-2)', flexShrink: 0 }}>
              {formatARS(i.value)} <span style={{ color: 'var(--text-3)' }}>· {total > 0 ? Math.round(i.value / total * 100) : 0}%</span>
            </span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-overlay)' }}>
            <div style={{ height: 5, borderRadius: 3, width: `${max > 0 ? Math.max(i.value / max * 100, 2) : 0}%`, background: color, opacity: 0.8 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function MovimientoModal({ onClose, onSave, tipo, initial }) {
  const { data }    = useStore()
  const contactos   = data.contactos || []
  const clientes    = contactos.filter(c => c.tipo === 'Cliente').map(c => c.nombre)
  const proveedores = contactos.filter(c => c.tipo === 'Proveedor').map(c => c.nombre)

  const [form, setForm] = useState(() => {
    const base = tipo === 'ingreso' ? emptyIngreso() : emptyGasto()
    if (!initial) return base
    const f = { ...base, ...initial, fecha: toISO(initial.fecha) || todayISO() }
    for (const k of Object.keys(f)) if (f[k] == null) f[k] = ''
    return f
  })
  const [errors, setErrors] = useState({})
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.fecha)                          e.fecha       = 'Requerido'
    if (!form.descripcion)                    e.descripcion = 'Requerido'
    if (!form.importe || isNaN(form.importe)) e.importe     = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const categorias = tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO
  const isIngreso  = tipo === 'ingreso'
  const btnColor   = isIngreso ? C_ING : C_GAS

  return (
    <Modal title={`${initial ? 'Editar' : 'Nuevo'} ${isIngreso ? 'ingreso' : 'gasto'}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Fecha" required>
          <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
          {errors.fecha && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.fecha}</p>}
        </Field>
        <Field label="Categoría">
          <Select value={form.categoria} onChange={e => set('categoria', e.target.value)}>
            {categorias.map(c => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="Descripción" required>
            <Input
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              placeholder={isIngreso ? 'Ej: Traslado Rosario-CABA' : 'Ej: Reparación frenos'}
            />
            {errors.descripcion && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.descripcion}</p>}
          </Field>
        </div>
        <Field label="Importe ($)" required>
          <Input type="number" step="0.01" value={form.importe} onChange={e => set('importe', e.target.value)} placeholder="0.00" />
          {errors.importe && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.importe}</p>}
        </Field>
        <Field label={isIngreso ? 'Cliente' : 'Proveedor'}>
          {isIngreso ? (
            <>
              <Input value={form.cliente}    onChange={e => set('cliente', e.target.value)}    list="clientes-list" />
              <datalist id="clientes-list">{clientes.map(c => <option key={c} value={c} />)}</datalist>
            </>
          ) : (
            <>
              <Input value={form.proveedor}  onChange={e => set('proveedor', e.target.value)}  list="proveedores-list" />
              <datalist id="proveedores-list">{proveedores.map(c => <option key={c} value={c} />)}</datalist>
            </>
          )}
        </Field>
        <Field label="N° Comprobante / Factura">
          <Input value={form.comprobante} onChange={e => set('comprobante', e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Field label="Notas">
            <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <BtnCancel onClick={onClose} />
        <button
          className="glass-btn-primary"
          style={{ background: isIngreso ? 'var(--positive-dim)' : 'var(--danger-dim)', color: btnColor, borderColor: 'transparent' }}
          onClick={() => { if (validate()) onSave(form) }}
        >
          {initial ? 'Guardar cambios' : `Guardar ${isIngreso ? 'ingreso' : 'gasto'}`}
        </button>
      </div>
    </Modal>
  )
}

export default function Finanzas() {
  const { data, update } = useStore()
  const { puedeEditar } = useAuth()
  const editable = puedeEditar('finanzas')
  const { addToast } = useToast()
  const confirmar = useConfirm()
  const ct = useChartTheme()

  const ingresos      = (data.ingresos || []).filter(r => r.descripcion || r.importe)
  const gastosPropios = (data.gastos   || []).filter(r => r.descripcion || r.importe)
  const gastos        = [
    ...gastosPropios,
    ...(data.marketing || [])
      .filter(r => parseFloat(r.gastado) > 0 && r.titulo)
      .map(r => ({
        id: r.id, tipo: 'gasto', _marketing: true,
        fecha: r.fecha, descripcion: r.titulo,
        categoria: 'Marketing', importe: r.gastado,
        proveedor: r.tipo, comprobante: '', notas: r.notas || '',
      })),
  ]
  const viajes = data.viajes || []

  const [vista, setVista]     = useState('resumen')
  const [search, setSearch]   = useState('')
  const [tab, setTab]         = useState('todos')
  const [mesFiltro, setMesFiltro] = useState('')
  const [modal, setModal]     = useState(null)   // { tipo, initial? }
  const [periodoResumen, setPeriodoResumen] = useState('mes')
  const [periodoFlota, setPeriodoFlota]     = useState('12m')
  const [buscaCliente, setBuscaCliente]     = useState('')

  const all = useMemo(() =>
    [...ingresos.map(r => ({ ...r, tipo: 'ingreso' })), ...gastos.map(r => ({ ...r, tipo: 'gasto' }))]
      .sort((a, b) => toISO(b.fecha ?? '').localeCompare(toISO(a.fecha ?? ''))),
    [ingresos, gastos])

  const mesesDisponibles = useMemo(() => {
    const set = new Set(all.map(r => fechaMes(r.fecha)).filter(Boolean))
    return [...set].sort().reverse()
  }, [all])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return all
      .filter(r => tab === 'todos' || r.tipo === tab)
      .filter(r => !mesFiltro || fechaMes(r.fecha) === mesFiltro)
      .filter(r => !q || r.descripcion?.toLowerCase().includes(q) || r.categoria?.toLowerCase().includes(q) || (r.cliente || r.proveedor || '').toLowerCase().includes(q))
  }, [all, search, tab, mesFiltro])

  // ── Resumen ──
  const desdeResumen = desdeISO(periodoResumen)
  const ingPeriodo = useMemo(() => ingresos.filter(r => enPeriodo(r.fecha, desdeResumen)), [ingresos, desdeResumen])
  const gasPeriodo = useMemo(() => gastos.filter(r => enPeriodo(r.fecha, desdeResumen)),   [gastos, desdeResumen])
  const totIng = ingPeriodo.reduce((s, r) => s + monto(r), 0)
  const totGas = gasPeriodo.reduce((s, r) => s + monto(r), 0)

  // Por cobrar: viajes agendados (Pendiente/Confirmado) → total menos la seña.
  // No depende del período: es plata comprometida a futuro, no historial.
  const agendados = viajes.filter(v => (v.estado === 'Pendiente' || v.estado === 'Confirmado') && parseFloat(v.monto_total) > 0)
  const porCobrar = agendados.reduce((s, v) => s + Math.max((parseFloat(v.monto_total) || 0) - (parseFloat(v.monto_sena) || 0), 0), 0)

  const serie12 = useMemo(() => {
    const arr = []
    const hoy = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      arr.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, mes: monthName(d.getMonth()), Ingresos: 0, Gastos: 0 })
    }
    const idx = new Map(arr.map(a => [a.key, a]))
    for (const r of ingresos) { const a = idx.get(fechaMes(r.fecha)); if (a) a.Ingresos += monto(r) }
    for (const r of gastos)   { const a = idx.get(fechaMes(r.fecha)); if (a) a.Gastos   += monto(r) }
    return arr
  }, [ingresos, gastos])

  const gastosPorCategoria = useMemo(() => {
    const map = new Map()
    for (const r of gasPeriodo) map.set(r.categoria || 'Sin categoría', (map.get(r.categoria || 'Sin categoría') || 0) + monto(r))
    return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [gasPeriodo])

  const topClientes = useMemo(() => {
    const map = new Map()
    for (const r of ingPeriodo) {
      const k = (r.cliente || '').trim() || 'Sin cliente'
      map.set(k, (map.get(k) || 0) + monto(r))
    }
    return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [ingPeriodo])

  // ── Clientes (cuenta por cliente, historial completo) ──
  const cuentas = useMemo(() => {
    const map = new Map()
    const get = nombre => {
      const k = (nombre || '').trim() || 'Sin cliente'
      if (!map.has(k)) map.set(k, { id: k, cliente: k, facturado: 0, realizados: 0, agendados: 0, porCobrar: 0, ultima: '' })
      return map.get(k)
    }
    for (const r of ingresos) {
      const c = get(r.cliente)
      c.facturado += monto(r)
      const f = toISO(r.fecha); if (f > c.ultima) c.ultima = f
    }
    for (const v of viajes) {
      const c = get(v.cliente)
      const f = toISO(v.fecha); if (f > c.ultima) c.ultima = f
      if (v.estado === 'Realizado') c.realizados++
      else if (v.estado === 'Pendiente' || v.estado === 'Confirmado') {
        c.agendados++
        c.porCobrar += Math.max((parseFloat(v.monto_total) || 0) - (parseFloat(v.monto_sena) || 0), 0)
      }
    }
    return [...map.values()].sort((a, b) => b.facturado - a.facturado)
  }, [ingresos, viajes])

  const cuentasFiltradas = useMemo(() => {
    const q = buscaCliente.toLowerCase()
    return cuentas.filter(c => !q || c.cliente.toLowerCase().includes(q))
  }, [cuentas, buscaCliente])

  // ── Rentabilidad por vehículo ──
  const desdeFlota = desdeISO(periodoFlota)
  const rentabilidad = useMemo(() => {
    const vehiculos = data.vehiculos || []
    const nombreDe = v => v.alias || `${v.marca || ''} ${v.modelo || ''}`.trim() || v.patente || 'Vehículo'
    const map = new Map()
    const get = id => {
      const k = id || 'sin'
      if (!map.has(k)) {
        const v = vehiculos.find(x => x.id === id)
        map.set(k, { id: k, nombre: v ? nombreDe(v) : 'Sin vehículo asignado', patente: v?.patente || '', viajes: 0, ingresos: 0, combustible: 0, mantenimiento: 0 })
      }
      return map.get(k)
    }
    for (const v of viajes) {
      if (v.estado !== 'Realizado' || !enPeriodo(v.fecha, desdeFlota)) continue
      const r = get(v.vehiculo_id)
      r.viajes++
      r.ingresos += parseFloat(v.monto_total) || 0
    }
    for (const c of (data.combustible || [])) {
      if (!enPeriodo(c.fecha, desdeFlota)) continue
      get(c.vehiculo_id).combustible += parseFloat(c.total) || 0
    }
    for (const m of (data.mantenimiento || [])) {
      if (!enPeriodo(m.fecha, desdeFlota)) continue
      get(m.vehiculo_id).mantenimiento += parseFloat(m.costo) || 0
    }
    return [...map.values()]
      .map(r => ({ ...r, resultado: r.ingresos - r.combustible - r.mantenimiento }))
      .filter(r => r.viajes || r.ingresos || r.combustible || r.mantenimiento)
      .sort((a, b) => b.ingresos - a.ingresos)
  }, [data.vehiculos, data.combustible, data.mantenimiento, viajes, desdeFlota])

  const totFlota = rentabilidad.reduce((s, r) => ({
    ingresos: s.ingresos + r.ingresos,
    costos:   s.costos + r.combustible + r.mantenimiento,
  }), { ingresos: 0, costos: 0 })

  // ── Acciones ──
  const handleSave = form => {
    const normalized = { ...form, fecha: toISO(form.fecha) }
    const esIngreso  = normalized.tipo === 'ingreso'
    const tabla      = esIngreso ? 'ingresos' : 'gastos'
    const lista      = esIngreso ? ingresos : gastosPropios
    if (modal?.initial) update(tabla, lista.map(x => x.id === normalized.id ? normalized : x))
    else update(tabla, [normalized, ...lista])
    setModal(null)
  }

  // Los movimientos derivados no se tocan desde acá: los de marketing viven en su
  // módulo, y los ingresos con viaje_id los administra Viajes (ingreso espejo).
  const esPropio = r => !r._marketing && !r.viaje_id

  const openEdit = r => {
    if (!esPropio(r)) return
    setModal({ tipo: r.tipo, initial: r })
  }

  const handleDelete = async r => {
    if (!esPropio(r)) return
    const esIngreso = r.tipo === 'ingreso'
    const ok = await confirmar({
      titulo: esIngreso ? 'Eliminar ingreso' : 'Eliminar gasto',
      mensaje: `Se elimina "${r.descripcion || 'este movimiento'}" del ${formatDate(r.fecha)} (${formatARS(r.importe)}).`,
    })
    if (!ok) return
    const tabla = esIngreso ? 'ingresos' : 'gastos'
    update(tabla, (esIngreso ? ingresos : gastosPropios).filter(x => x.id !== r.id))
    // El registro guardado no lleva el `tipo` sintético que le agrega `all`
    // para pintar la tabla: se restaura la fila tal como vive en su tabla.
    const fila = (esIngreso ? ingresos : gastosPropios).find(x => x.id === r.id)
    addToast({
      message: esIngreso ? 'Ingreso eliminado.' : 'Gasto eliminado.',
      Icon: Trash2,
      color: 'var(--danger)',
      duration: 6000,
      action: { label: 'Deshacer', onClick: () => update(tabla, [fila, ...(getData()[tabla] || [])]) },
    })
  }

  // CSV con ; y BOM: es lo que Excel en es-AR abre bien de una (coma decimal).
  const exportCSV = () => {
    const filas = filtered.map(r => [
      formatDate(r.fecha), r.tipo === 'ingreso' ? 'Ingreso' : 'Gasto', r.categoria || '',
      r.descripcion || '', r.cliente || r.proveedor || '',
      String(monto(r)).replace('.', ','), r.comprobante || '', (r.notas || '').replace(/\r?\n/g, ' '),
    ])
    const esc = s => `"${String(s ?? '').replace(/"/g, '""')}"`
    const csv = '\\ufeff' + [['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Cliente/Proveedor', 'Importe', 'Comprobante', 'Notas'], ...filas]
      .map(f => f.map(esc).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `finanzas-${todayISO()}.csv` })
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Columnas ──
  const colsMovimientos = [
    { key: 'fecha', label: 'Fecha', render: r => formatDate(r.fecha) },
    {
      key: 'tipo', label: 'Tipo', render: r => (
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={r.tipo === 'ingreso'
            ? { background: 'var(--positive-dim)', color: C_ING }
            : { background: 'var(--danger-dim)', color: C_GAS }}
        >
          {r.tipo === 'ingreso' ? '▲ Ingreso' : '▼ Gasto'}
        </span>
      )
    },
    { key: 'categoria',   label: 'Categoría' },
    { key: 'descripcion', label: 'Descripción', render: r => <span className="max-w-xs truncate block">{r.descripcion}</span> },
    { key: 'tercero',     label: 'Cliente / Proveedor', render: r => (r.cliente || r.proveedor) || <span style={{ color: 'var(--text-3)' }}>—</span> },
    {
      key: 'importe', label: 'Importe', render: r => (
        <span className="num font-bold" style={{ color: r.tipo === 'ingreso' ? C_ING : C_GAS }}>
          {r.tipo === 'ingreso' ? '+' : '−'}{formatARS(r.importe)}
        </span>
      )
    },
    {
      key: 'acciones', label: '', render: r => (editable && esPropio(r)) ? (
        <div style={{ display: 'flex', gap: 2 }}>
          <button onClick={() => openEdit(r)} className="icon-btn" aria-label="Editar movimiento">
            <Pencil size={14} />
          </button>
          <button onClick={() => handleDelete(r)} className="icon-btn icon-btn-danger" aria-label="Eliminar movimiento">
            <Trash2 size={14} />
          </button>
        </div>
      ) : null
    }
  ]

  const colsClientes = [
    { key: 'cliente',    label: 'Cliente' },
    { key: 'facturado',  label: 'Facturado',   render: r => <span className="num font-bold" style={{ color: C_ING }}>{formatARS(r.facturado)}</span> },
    { key: 'realizados', label: 'Viajes realizados', render: r => <span className="num">{r.realizados}</span> },
    { key: 'agendados',  label: 'Agendados',   render: r => r.agendados ? <span className="num">{r.agendados}</span> : <span style={{ color: 'var(--text-3)' }}>—</span> },
    { key: 'porCobrar',  label: 'Por cobrar',  render: r => r.porCobrar > 0 ? <span className="num font-bold" style={{ color: 'var(--warning)' }}>{formatARS(r.porCobrar)}</span> : <span style={{ color: 'var(--text-3)' }}>—</span> },
    { key: 'ultima',     label: 'Última actividad', render: r => r.ultima ? formatDate(r.ultima) : <span style={{ color: 'var(--text-3)' }}>—</span> },
  ]

  const colsFlota = [
    { key: 'nombre',        label: 'Vehículo', render: r => (
        <span>{r.nombre}{r.patente && <span className="num" style={{ color: 'var(--text-3)', marginLeft: 8, fontSize: 12 }}>{r.patente}</span>}</span>
      ) },
    { key: 'viajes',        label: 'Viajes', render: r => <span className="num">{r.viajes}</span> },
    { key: 'ingresos',      label: 'Ingresos',      render: r => <span className="num" style={{ color: C_ING }}>{formatARS(r.ingresos)}</span> },
    { key: 'combustible',   label: 'Combustible',   render: r => <span className="num" style={{ color: C_GAS }}>{formatARS(r.combustible)}</span> },
    { key: 'mantenimiento', label: 'Mantenimiento', render: r => <span className="num" style={{ color: C_GAS }}>{formatARS(r.mantenimiento)}</span> },
    { key: 'resultado',     label: 'Resultado', render: r => (
        <span className="num font-bold" style={{ color: r.resultado >= 0 ? C_ING : C_GAS }}>{formatARS(r.resultado)}</span>
      ) },
    { key: 'margen', label: 'Margen', render: r => r.ingresos > 0
        ? <span className="num" style={{ color: r.resultado >= 0 ? C_ING : C_GAS }}>{Math.round(r.resultado / r.ingresos * 100)}%</span>
        : <span style={{ color: 'var(--text-3)' }}>—</span> },
  ]

  const VISTAS = [['resumen', 'Resumen'], ['movimientos', 'Movimientos'], ['clientes', 'Clientes'], ['flota', 'Rentabilidad']]

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={18} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="mod-h1">Finanzas</h1>
            <p className="mod-sub">Resumen, movimientos, clientes y rentabilidad por vehículo</p>
          </div>
        </div>
        {editable && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="glass-btn-primary"
              style={{ background: 'var(--positive-dim)', color: 'var(--positive)', borderColor: 'transparent' }}
              onClick={() => setModal({ tipo: 'ingreso' })}
            >
              <ArrowUpCircle size={15} /> Ingreso
            </button>
            <button
              className="glass-btn-primary"
              style={{ background: 'var(--danger-dim)', color: 'var(--danger)', borderColor: 'transparent' }}
              onClick={() => setModal({ tipo: 'gasto' })}
            >
              <ArrowDownCircle size={15} /> Gasto
            </button>
          </div>
        )}
      </div>

      {/* ── Vistas ── */}
      <div className="db-in db-d1" style={{ marginBottom: 20 }}>
        <Segmented options={VISTAS} value={vista} onChange={setVista} />
      </div>

      {/* ═══ RESUMEN ═══ */}
      {vista === 'resumen' && (
        <>
          <div className="db-in db-d1" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <Segmented options={PERIODOS} value={periodoResumen} onChange={setPeriodoResumen} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: 20 }}>
            <KpiCard label="Ingresos"  value={formatARS(totIng)} color={C_ING} delay={1} />
            <KpiCard label="Gastos"    value={formatARS(totGas)} color={C_GAS} delay={2} />
            <KpiCard label="Resultado" value={formatARS(totIng - totGas)} color={totIng - totGas >= 0 ? C_ING : C_GAS} delay={3} />
            <KpiCard label="Por cobrar" value={formatARS(porCobrar)} color="var(--warning)" delay={4}
              sub={agendados.length ? `${agendados.length} viaje${agendados.length === 1 ? '' : 's'} agendado${agendados.length === 1 ? '' : 's'}` : 'Sin viajes agendados'} />
          </div>

          <div className="surface db-in db-d5" style={{ padding: 26, marginBottom: 20 }}>
            <p className="db-slabel">Evolución · últimos 12 meses</p>
            {serie12.some(d => d.Ingresos > 0 || d.Gastos > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={serie12} barCategoryGap="28%" barGap={3}>
                  <XAxis dataKey="mes" tick={{ fill: ct.tickColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: ct.tickColor, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => formatARS(v)} {...ct.tooltip} cursor={{ fill: ct.cursorFill }} />
                  <Legend wrapperStyle={{ color: ct.tickColor, fontSize: 12, fontWeight: 600 }} />
                  <Bar dataKey="Ingresos" fill={ct.positive} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Gastos"   fill={ct.danger}   radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="db-empty">Sin movimientos para mostrar</div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="surface db-in db-d6" style={{ padding: 26 }}>
              <p className="db-slabel" style={{ marginBottom: 14 }}>Gastos por categoría</p>
              <BarList items={gastosPorCategoria} color={ct.danger} emptyText="Sin gastos en el período" />
            </div>
            <div className="surface db-in db-d7" style={{ padding: 26 }}>
              <p className="db-slabel" style={{ marginBottom: 14 }}>Top clientes por facturación</p>
              <BarList items={topClientes} color={ct.positive} emptyText="Sin ingresos en el período" />
            </div>
          </div>
        </>
      )}

      {/* ═══ MOVIMIENTOS ═══ */}
      {vista === 'movimientos' && (
        <div className="surface db-in db-d2" style={{ padding: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar descripción, categoría, cliente..." />
            <Segmented options={[['todos', 'Todos'], ['ingreso', 'Ingresos'], ['gasto', 'Gastos']]} value={tab} onChange={setTab} />
            <Select value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="">Todos los meses</option>
              {mesesDisponibles.map(m => (
                <option key={m} value={m}>{monthName(Number(m.slice(5, 7)) - 1)} {m.slice(0, 4)}</option>
              ))}
            </Select>
            <button
              className="glass-btn-primary"
              style={{ marginLeft: 'auto' }}
              onClick={exportCSV}
              disabled={!filtered.length}
            >
              <Download size={15} /> Exportar CSV
            </button>
          </div>
          <Table
            columns={colsMovimientos} data={filtered}
            emptyIcon={ArrowRightLeft}
            emptyText={search || tab !== 'todos' || mesFiltro ? 'Sin resultados' : 'Todavía no hay movimientos'}
            emptyHint={search || tab !== 'todos' || mesFiltro
              ? 'Probá con otros términos o quitá los filtros.'
              : 'Registrá ingresos y gastos con los botones de arriba; los viajes realizados generan su ingreso solos.'}
          />
        </div>
      )}

      {/* ═══ CLIENTES ═══ */}
      {vista === 'clientes' && (
        <div className="surface db-in db-d2" style={{ padding: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <SearchBar value={buscaCliente} onChange={setBuscaCliente} placeholder="Buscar cliente..." />
          </div>
          <Table
            columns={colsClientes} data={cuentasFiltradas}
            emptyIcon={Contact}
            emptyText={buscaCliente ? 'Sin resultados' : 'Todavía no hay clientes'}
            emptyHint={buscaCliente
              ? 'Probá con otro nombre.'
              : 'La cuenta de cada cliente aparece acá a medida que cargás viajes e ingresos.'}
          />
        </div>
      )}

      {/* ═══ RENTABILIDAD ═══ */}
      {vista === 'flota' && (
        <>
          <div className="db-in db-d1" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <Segmented options={PERIODOS} value={periodoFlota} onChange={setPeriodoFlota} />
          </div>
          <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 16 }}>
            <KpiCard label="Ingresos por viajes"  value={formatARS(totFlota.ingresos)} color={C_ING} delay={2} />
            <KpiCard label="Combustible + mantenimiento" value={formatARS(totFlota.costos)} color={C_GAS} delay={3} />
            <KpiCard label="Resultado operativo" value={formatARS(totFlota.ingresos - totFlota.costos)}
              color={totFlota.ingresos - totFlota.costos >= 0 ? C_ING : C_GAS} delay={4} />
          </div>
          <div className="surface db-in db-d5" style={{ padding: 20 }}>
            <Table
              columns={colsFlota} data={rentabilidad}
              emptyIcon={Truck}
              emptyText="Sin actividad en el período"
              emptyHint="Cargá viajes realizados, combustible y mantenimiento para ver la rentabilidad por vehículo."
            />
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
              Ingresos = viajes realizados asignados al vehículo. Costos = cargas de combustible y mantenimientos del período. La nómina y los gastos generales no se prorratean por vehículo.
            </p>
          </div>
        </>
      )}

      {modal && <MovimientoModal tipo={modal.tipo} initial={modal.initial} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  )
}
