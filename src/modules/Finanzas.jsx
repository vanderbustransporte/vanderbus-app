import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatDate, formatARS, todayISO, genId } from '../utils/format'
import { toISO, fechaMes } from '../utils/fecha'
import Table from '../components/shared/Table'
import SearchBar from '../components/shared/SearchBar'
import Modal from '../components/shared/Modal'
import { Field, Input, Select, Textarea, BtnCancel } from '../components/shared/Field'
import { TrendingUp, Plus, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useChartTheme } from '../utils/chartTheme'

const ACCENT   = '#34D399'
const C_ING    = '#34D399'
const C_GAS    = '#F87171'

const CATEGORIAS_INGRESO = ['Servicio de transporte', 'Flete', 'Alquiler de vehículo', 'Otro ingreso']
const CATEGORIAS_GASTO   = ['Combustible', 'Mantenimiento', 'Nómina', 'Seguro', 'Impuestos y tasas', 'Peajes', 'Administrativo', 'Otro gasto']

const emptyIngreso = () => ({ id: genId(), tipo: 'ingreso', fecha: todayISO(), descripcion: '', categoria: 'Servicio de transporte', importe: '', cliente: '',    comprobante: '', notas: '' })
const emptyGasto   = () => ({ id: genId(), tipo: 'gasto',   fecha: todayISO(), descripcion: '', categoria: 'Combustible',            importe: '', proveedor: '', comprobante: '', notas: '' })

function MovimientoModal({ onClose, onSave, tipo }) {
  const { data }    = useStore()
  const contactos   = data.contactos || []
  const clientes    = contactos.filter(c => c.tipo === 'Cliente').map(c => c.nombre)
  const proveedores = contactos.filter(c => c.tipo === 'Proveedor').map(c => c.nombre)

  const [form, setForm]     = useState(tipo === 'ingreso' ? emptyIngreso() : emptyGasto())
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
    <Modal title={isIngreso ? 'Nuevo ingreso' : 'Nuevo gasto'} onClose={onClose}>
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
              placeholder={isIngreso ? 'Ej: Flete Rosario-CABA' : 'Ej: Reparación frenos'}
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
          style={{ background: `${btnColor}18`, boxShadow: `0 4px 15px ${btnColor}28`, color: btnColor, borderColor: `${btnColor}28` }}
          onClick={() => { if (validate()) onSave(form) }}
        >
          Guardar {isIngreso ? 'ingreso' : 'gasto'}
        </button>
      </div>
    </Modal>
  )
}

export default function Finanzas() {
  const { data, update } = useStore()
  const { puedeEditar } = useAuth()
  const editable = puedeEditar('finanzas')
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
  const [search, setSearch] = useState('')
  const [tab, setTab]       = useState('todos')
  const [modal, setModal]   = useState(null)

  const all = useMemo(() =>
    [...ingresos.map(r => ({ ...r, tipo: 'ingreso' })), ...gastos.map(r => ({ ...r, tipo: 'gasto' }))]
      .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')),
    [ingresos, gastos])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return all
      .filter(r => tab === 'todos' || r.tipo === tab)
      .filter(r => !q || r.descripcion?.toLowerCase().includes(q) || r.categoria?.toLowerCase().includes(q))
  }, [all, search, tab])

  const mesActual         = new Date().toISOString().slice(0, 7)
  const totalIngresosMes  = ingresos.filter(r => fechaMes(r.fecha) === mesActual).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
  const totalGastosMes    = gastos.filter(r => fechaMes(r.fecha) === mesActual).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
  const balance           = totalIngresosMes - totalGastosMes

  const handleSave = form => {
    const normalized = { ...form, fecha: toISO(form.fecha) }
    if (normalized.tipo === 'ingreso') update('ingresos', [normalized, ...ingresos])
    else update('gastos', [normalized, ...gastosPropios])
    setModal(null)
  }

  const handleDelete = r => {
    if (r._marketing || r.viaje_id) return
    if (!confirm('¿Eliminar este movimiento?')) return
    if (r.tipo === 'ingreso') update('ingresos', ingresos.filter(x => x.id !== r.id))
    else update('gastos', gastosPropios.filter(x => x.id !== r.id))
  }

  const cols = [
    { key: 'fecha', label: 'Fecha', render: r => formatDate(r.fecha) },
    {
      key: 'tipo', label: 'Tipo', render: r => (
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={r.tipo === 'ingreso'
            ? { background: 'rgba(52,211,153,0.12)', color: C_ING }
            : { background: 'rgba(248,113,113,0.12)', color: C_GAS }}
        >
          {r.tipo === 'ingreso' ? '▲ Ingreso' : '▼ Gasto'}
        </span>
      )
    },
    { key: 'categoria',   label: 'Categoría' },
    { key: 'descripcion', label: 'Descripción', render: r => <span className="max-w-xs truncate block">{r.descripcion}</span> },
    {
      key: 'importe', label: 'Importe', render: r => (
        <span className="num font-bold" style={{ color: r.tipo === 'ingreso' ? C_ING : C_GAS }}>
          {r.tipo === 'ingreso' ? '+' : '−'}{formatARS(r.importe)}
        </span>
      )
    },
    {
      key: 'acciones', label: '', render: r => (editable && !r._marketing && !r.viaje_id) ? (
        <button
          onClick={() => handleDelete(r)}
          className="p-1.5 rounded-lg"
          style={{ color: '#F87171' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-dim)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '' }}
        >
          <Trash2 size={14} />
        </button>
      ) : null
    }
  ]

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: `${ACCENT}18`, border: `1px solid ${ACCENT}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={18} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="mod-h1">Finanzas</h1>
            <p className="mod-sub">Ingresos y gastos del período</p>
          </div>
        </div>
        {editable && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="glass-btn-primary"
              style={{ background: `${C_ING}18`, boxShadow: `0 4px 15px ${C_ING}22`, borderColor: `${C_ING}28` }}
              onClick={() => setModal('ingreso')}
            >
              <ArrowUpCircle size={15} /> Ingreso
            </button>
            <button
              className="glass-btn-primary"
              style={{ background: `${C_GAS}18`, boxShadow: `0 4px 15px ${C_GAS}22`, borderColor: `${C_GAS}28` }}
              onClick={() => setModal('gasto')}
            >
              <ArrowDownCircle size={15} /> Gasto
            </button>
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 16 }}>
        <div className="surface surface-hover db-in db-d1" style={{ padding: '18px 20px 18px 24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 12, bottom: 12, left: 0, width: 3, borderRadius: '0 3px 3px 0', background: C_ING, opacity: 0.75 }} />
          <p className="db-slabel" style={{ marginBottom: 8 }}>Ingresos del mes</p>
          <div className="num" style={{ fontSize: 19, fontWeight: 700, color: C_ING }}>{formatARS(totalIngresosMes)}</div>
        </div>
        <div className="surface surface-hover db-in db-d2" style={{ padding: '18px 20px 18px 24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 12, bottom: 12, left: 0, width: 3, borderRadius: '0 3px 3px 0', background: C_GAS, opacity: 0.75 }} />
          <p className="db-slabel" style={{ marginBottom: 8 }}>Gastos del mes</p>
          <div className="num" style={{ fontSize: 19, fontWeight: 700, color: C_GAS }}>{formatARS(totalGastosMes)}</div>
        </div>
        <div
          className="surface surface-hover db-in db-d3"
          style={{
            padding: '18px 20px 18px 24px', position: 'relative', overflow: 'hidden',
            borderColor: balance >= 0 ? 'rgba(52,211,153,0.22)' : 'rgba(248,113,113,0.22)',
            background:  balance >= 0 ? 'rgba(52,211,153,0.04)'  : 'rgba(248,113,113,0.04)',
          }}
        >
          <div style={{ position: 'absolute', top: 12, bottom: 12, left: 0, width: 3, borderRadius: '0 3px 3px 0', background: balance >= 0 ? C_ING : C_GAS, opacity: 0.75 }} />
          <p className="db-slabel" style={{ marginBottom: 8 }}>Balance neto</p>
          <div className="num" style={{ fontSize: 19, fontWeight: 700, color: balance >= 0 ? C_ING : C_GAS }}>{formatARS(balance)}</div>
        </div>
      </div>

      {/* ── Tabla ── */}
      <div className="surface db-in db-d4" style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar descripción, categoría..." />
          <div style={{ display: 'flex', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            {[['todos', 'Todos'], ['ingreso', 'Ingresos'], ['gasto', 'Gastos']].map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setTab(val)}
                className="px-3 py-2 text-sm font-medium"
                style={tab === val
                  ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderRight: '1px solid var(--border)' }
                  : { background: 'var(--bg-overlay)', color: 'var(--text-2)', borderRight: '1px solid var(--border)' }}
                onMouseEnter={e => { if (tab !== val) { e.currentTarget.style.background = 'var(--hover-tint)'; e.currentTarget.style.color = 'var(--text-1)' } }}
                onMouseLeave={e => { if (tab !== val) { e.currentTarget.style.background = 'var(--bg-overlay)'; e.currentTarget.style.color = 'var(--text-2)' } }}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <Table columns={cols} data={filtered} emptyText="Sin movimientos registrados" />
      </div>

      {modal && <MovimientoModal tipo={modal} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  )
}
