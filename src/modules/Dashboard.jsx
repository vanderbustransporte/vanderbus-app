import React, { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatARS, formatDate, monthName } from '../utils/format'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, TrendingDown, Fuel, Wrench, DollarSign, Truck, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

// ─── Paleta de gráficos ────────────────────────────────────────────────────
const CHART_COLORS = ['#22D3EE', '#34D399', '#A78BFA', '#F87171', '#FBBF24', '#60A5FA']

// ─── Estilos del dashboard ─────────────────────────────────────────────────
// Emil: transiciones solo en transform/opacity, ease-out personalizado,
//       hover gateado detrás de @media (hover: hover), duraciones <300ms.
// Frontend-design: glassmorphism oscuro dramático, tipografía distintiva,
//                  paleta eléctrica, gradient text, accent bars.
const S = `
  .db { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
  .db-mono { font-family: 'Space Mono', 'Courier New', monospace; }

  /* ── Panel de vidrio oscuro ── */
  .db-panel {
    background: rgba(8, 16, 36, 0.55);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.07);
    box-shadow:
      0 8px 32px rgba(0,0,0,0.45),
      inset 0 1px 0 rgba(255,255,255,0.05);
    border-radius: 20px;
    transition:
      border-color 220ms cubic-bezier(0.23,1,0.32,1),
      box-shadow   220ms cubic-bezier(0.23,1,0.32,1),
      transform    220ms cubic-bezier(0.23,1,0.32,1);
  }
  /* Hover lift — solo dispositivos con puntero fino */
  @media (hover: hover) and (pointer: fine) {
    .db-panel-h:hover {
      border-color: rgba(255,255,255,0.13);
      box-shadow:
        0 20px 56px rgba(0,0,0,0.55),
        inset 0 1px 0 rgba(255,255,255,0.09);
      transform: translateY(-3px);
    }
  }

  /* ── Botones de acceso rápido ── */
  .db-btn {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 11px 20px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    color: rgba(255,255,255,0.9);
    border: 1px solid rgba(255,255,255,0.1);
    cursor: pointer;
    letter-spacing: 0.01em;
    transition:
      transform    150ms cubic-bezier(0.23,1,0.32,1),
      box-shadow   150ms cubic-bezier(0.23,1,0.32,1),
      border-color 150ms ease-out;
  }
  /* Emil: press feedback scale(0.97) */
  .db-btn:active { transform: scale(0.97) !important; }
  @media (hover: hover) and (pointer: fine) {
    .db-btn:hover {
      transform: translateY(-2px);
      border-color: rgba(255,255,255,0.22);
    }
  }

  /* ── Entrada con stagger (Emil: desde translateY+opacity, nunca scale(0)) ── */
  .db-in {
    opacity: 0;
    transform: translateY(10px);
    animation: dbUp 380ms cubic-bezier(0.23,1,0.32,1) forwards;
  }
  @keyframes dbUp { to { opacity: 1; transform: translateY(0); } }
  /* Delays: 55ms entre items — dentro del rango Emil de 30-80ms */
  .db-d0 { animation-delay: 0ms;   }
  .db-d1 { animation-delay: 55ms;  }
  .db-d2 { animation-delay: 110ms; }
  .db-d3 { animation-delay: 165ms; }
  .db-d4 { animation-delay: 220ms; }
  .db-d5 { animation-delay: 275ms; }
  .db-d6 { animation-delay: 330ms; }
  .db-d7 { animation-delay: 385ms; }
  .db-d8 { animation-delay: 440ms; }

  /* ── Badge de tendencia ── */
  .db-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    margin-top: 10px;
    font-family: 'Space Mono', monospace;
    letter-spacing: -0.01em;
  }

  /* ── Gradient text ── */
  .db-g-green {
    background: linear-gradient(130deg, #34D399 10%, #22D3EE 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    display: inline-block;
  }
  .db-g-red {
    background: linear-gradient(130deg, #F87171 10%, #FB923C 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    display: inline-block;
  }
  .db-g-white {
    background: linear-gradient(130deg, #FFFFFF 40%, rgba(255,255,255,0.55) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    display: inline-block;
  }

  /* ── Etiqueta de sección ── */
  .db-slabel {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(255,255,255,0.52);
    margin-bottom: 16px;
  }

  /* ── Estado vacío ── */
  .db-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    font-size: 13px;
    color: rgba(255,255,255,0.45);
    font-style: italic;
    letter-spacing: 0.02em;
  }
`

// ─── TrendBadge ───────────────────────────────────────────────────────────
function TrendBadge({ actual, anterior }) {
  if (!anterior) return null
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100
  const up = pct >= 0
  return (
    <span
      className="db-badge"
      style={{
        background: up ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
        color: up ? '#34D399' : '#F87171',
        border: `1px solid ${up ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)'}`,
      }}
    >
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, delay = 0 }) {
  return (
    <div
      className={`db-panel db-panel-h db-in db-d${delay}`}
      style={{ position: 'relative', overflow: 'hidden', padding: '20px 20px 20px 24px' }}
    >
      {/* Barra de acento lateral (color distintivo por card) */}
      <div style={{
        position: 'absolute', top: 14, bottom: 14, left: 0,
        width: 3, borderRadius: '0 3px 3px 0',
        background: color, opacity: 0.75,
      }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: `${color}18`,
          border: `1px solid ${color}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 18px ${color}20`,
        }}>
          <Icon size={17} style={{ color }} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)', marginBottom: 4,
          }}>
            {label}
          </div>
          <div
            className="db-mono"
            style={{
              fontSize: 13, fontWeight: 700,
              color: 'rgba(255,255,255,0.92)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.52)', marginTop: 3 }}>
              {sub}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── QuickBtn ─────────────────────────────────────────────────────────────
function QuickBtn({ icon: Icon, label, color, onClick }) {
  return (
    <button
      className="db-btn"
      onClick={onClick}
      style={{
        background: `${color}1A`,
        boxShadow: `0 4px 20px ${color}1F`,
      }}
    >
      <Icon size={14} style={{ color }} />
      <span>{label}</span>
    </button>
  )
}

// ─── Tooltip oscuro para gráficos ─────────────────────────────────────────
const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(6,12,28,0.97)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: '10px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      <p style={{
        fontSize: 10, color: 'rgba(255,255,255,0.55)',
        fontWeight: 800, letterSpacing: '0.1em',
        textTransform: 'uppercase', marginBottom: 7, marginTop: 0,
      }}>
        {label}
      </p>
      {payload.map(p => (
        <p key={p.name} style={{
          color: p.color, fontSize: 12, fontWeight: 700,
          fontFamily: 'Space Mono, monospace',
          letterSpacing: '-0.02em', margin: '3px 0 0',
        }}>
          {p.name}: {formatARS(p.value)}
        </p>
      ))}
    </div>
  )
}

// ─── Dashboard principal ──────────────────────────────────────────────────
export default function Dashboard({ onNav }) {
  const { data } = useStore()
  const ingresos     = data.ingresos     || []
  const gastos       = data.gastos       || []
  const combustible  = data.combustible  || []
  const mantenimiento = data.mantenimiento || []
  const nomina       = data.nomina       || []
  const vehiculo     = data.vehiculo     || {}

  const now       = new Date()
  const mesActual = now.toISOString().slice(0, 7)
  const prevDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const mesPasado = prevDate.toISOString().slice(0, 7)

  /* ── Totales financieros ── */
  const totalIngresosMes = useMemo(() =>
    ingresos.filter(r => r.fecha?.startsWith(mesActual))
      .reduce((s, r) => s + (parseFloat(r.importe) || 0), 0),
    [ingresos, mesActual])

  const totalIngresosMesPasado = useMemo(() =>
    ingresos.filter(r => r.fecha?.startsWith(mesPasado))
      .reduce((s, r) => s + (parseFloat(r.importe) || 0), 0),
    [ingresos, mesPasado])

  const totalGastosMes = useMemo(() => {
    const gBase = gastos.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    const gComb = combustible.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.total)   || 0), 0)
    const gMant = mantenimiento.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.costo)  || 0), 0)
    const gNom  = nomina.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    return gBase + gComb + gMant + gNom
  }, [gastos, combustible, mantenimiento, nomina, mesActual])

  const totalGastosMesPasado = useMemo(() => {
    const gBase = gastos.filter(r => r.fecha?.startsWith(mesPasado)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    const gComb = combustible.filter(r => r.fecha?.startsWith(mesPasado)).reduce((s, r) => s + (parseFloat(r.total)   || 0), 0)
    const gMant = mantenimiento.filter(r => r.fecha?.startsWith(mesPasado)).reduce((s, r) => s + (parseFloat(r.costo)  || 0), 0)
    const gNom  = nomina.filter(r => r.fecha?.startsWith(mesPasado)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    return gBase + gComb + gMant + gNom
  }, [gastos, combustible, mantenimiento, nomina, mesPasado])

  const balance      = totalIngresosMes - totalGastosMes
  const balancePasado = totalIngresosMesPasado - totalGastosMesPasado

  /* ── Datos del bar chart (6 meses) ── */
  const barData = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => {
      const d   = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const key = d.toISOString().slice(0, 7)
      const ing = ingresos.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
      const gas = gastos.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
        + combustible.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.total)   || 0), 0)
        + mantenimiento.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.costo)  || 0), 0)
        + nomina.filter(r => r.fecha?.startsWith(key)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
      return { mes: monthName(d.getMonth()), Ingresos: ing, Gastos: gas }
    }),
    [ingresos, gastos, combustible, mantenimiento, nomina])

  /* ── Datos del pie chart ── */
  const pieData = useMemo(() => {
    const combTotal  = combustible.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.total)   || 0), 0)
    const mantTotal  = mantenimiento.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.costo)  || 0), 0)
    const nomTotal   = nomina.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    const otrosTotal = gastos.filter(r => r.fecha?.startsWith(mesActual)).reduce((s, r) => s + (parseFloat(r.importe) || 0), 0)
    return [
      { name: 'Combustible',    value: combTotal  },
      { name: 'Mantenimiento',  value: mantTotal  },
      { name: 'Nómina',         value: nomTotal   },
      { name: 'Otros',          value: otrosTotal },
    ].filter(d => d.value > 0)
  }, [combustible, mantenimiento, nomina, gastos, mesActual])

  /* ── Últimos registros ── */
  const ultimoServicio = useMemo(() =>
    [...ingresos].sort((a, b) => b.fecha?.localeCompare(a.fecha))[0], [ingresos])
  const ultimoMant = useMemo(() =>
    [...mantenimiento].sort((a, b) => b.fecha?.localeCompare(a.fecha))[0], [mantenimiento])
  const ultimoNomina = useMemo(() =>
    [...nomina].sort((a, b) => b.fecha?.localeCompare(a.fecha))[0], [nomina])

  const fechaLarga = now.toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="db max-w-6xl mx-auto">
      <style>{S}</style>

      {/* ── Encabezado ── */}
      <div className="db-in db-d0" style={{ marginBottom: 28 }}>
        <h1
          className="db-g-white"
          style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.1, margin: 0 }}
        >
          Panel de control
        </h1>
        <p
          className="db-mono"
          style={{ fontSize: 11, color: 'rgba(255,255,255,0.52)', textTransform: 'capitalize', marginTop: 6, letterSpacing: '0.03em' }}
        >
          {fechaLarga}
        </p>
      </div>

      {/* ── Resumen financiero ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ marginBottom: 16 }}>

        {/* Ingresos */}
        <div className="db-panel db-panel-h db-in db-d1" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(52,211,153,0.14)',
              border: '1px solid rgba(52,211,153,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ArrowUpCircle size={13} style={{ color: '#34D399' }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)' }}>
              Ingresos del mes
            </span>
          </div>
          <div className="db-mono db-g-green" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>
            {formatARS(totalIngresosMes)}
          </div>
          <TrendBadge actual={totalIngresosMes} anterior={totalIngresosMesPasado} />
        </div>

        {/* Gastos */}
        <div className="db-panel db-panel-h db-in db-d2" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(248,113,113,0.14)',
              border: '1px solid rgba(248,113,113,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ArrowDownCircle size={13} style={{ color: '#F87171' }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)' }}>
              Gastos del mes
            </span>
          </div>
          <div className="db-mono db-g-red" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>
            {formatARS(totalGastosMes)}
          </div>
          <TrendBadge actual={totalGastosMes} anterior={totalGastosMesPasado} />
        </div>

        {/* Balance neto */}
        <div
          className="db-panel db-panel-h db-in db-d3"
          style={{
            padding: 24,
            borderColor: balance >= 0 ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)',
            background:  balance >= 0 ? 'rgba(52,211,153,0.05)' : 'rgba(248,113,113,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: balance >= 0 ? 'rgba(52,211,153,0.14)' : 'rgba(248,113,113,0.14)',
              border: `1px solid ${balance >= 0 ? 'rgba(52,211,153,0.22)' : 'rgba(248,113,113,0.22)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {balance >= 0
                ? <TrendingUp   size={13} style={{ color: '#34D399' }} />
                : <TrendingDown size={13} style={{ color: '#F87171' }} />}
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)' }}>
              Balance neto
            </span>
          </div>
          <div
            className={`db-mono ${balance >= 0 ? 'db-g-green' : 'db-g-red'}`}
            style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}
          >
            {formatARS(balance)}
          </div>
          <TrendBadge actual={balance} anterior={balancePasado} />
        </div>
      </div>

      {/* ── Gráficos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 16 }}>

        {/* Bar chart */}
        <div className="lg:col-span-2 db-panel db-in db-d4" style={{ padding: 24 }}>
          <p className="db-slabel">Ingresos vs Gastos · últimos 6 meses</p>
          {barData.some(d => d.Ingresos > 0 || d.Gastos > 0) ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={barData} barCategoryGap="32%" barGap={3}>
                <XAxis
                  dataKey="mes"
                  tick={{ fill: 'rgba(255,255,255,0.50)', fontSize: 11, fontFamily: 'Space Mono, monospace' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.42)', fontSize: 10, fontFamily: 'Space Mono, monospace' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600 }} />
                <Bar dataKey="Ingresos" fill="#34D399" radius={[5, 5, 0, 0]} />
                <Bar dataKey="Gastos"   fill="#F87171" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="db-empty">Sin datos para mostrar</div>
          )}
        </div>

        {/* Pie chart */}
        <div className="db-panel db-in db-d5" style={{ padding: 24 }}>
          <p className="db-slabel">Distribución de gastos</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={v => formatARS(v)}
                  contentStyle={{
                    background: 'rgba(6,12,28,0.97)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: 12,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  }}
                  labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                />
                <Legend
                  iconType="circle" iconSize={7}
                  wrapperStyle={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="db-empty">Sin datos del mes</div>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
        <StatCard
          icon={TrendingUp} label="Último servicio" color="#34D399" delay={5}
          value={ultimoServicio ? formatARS(ultimoServicio.importe) : 'Sin registros'}
          sub={ultimoServicio ? formatDate(ultimoServicio.fecha) : ''}
        />
        <StatCard
          icon={Wrench} label="Último mantenimiento" color="#FBBF24" delay={6}
          value={ultimoMant
            ? (ultimoMant.descripcion?.length > 20
                ? ultimoMant.descripcion.slice(0, 20) + '…'
                : ultimoMant.descripcion)
            : 'Sin registros'}
          sub={ultimoMant ? formatDate(ultimoMant.fecha) : ''}
        />
        <StatCard
          icon={DollarSign} label="Último pago nómina" color="#A78BFA" delay={7}
          value={ultimoNomina ? formatARS(ultimoNomina.importe) : 'Sin registros'}
          sub={ultimoNomina ? ultimoNomina.empleado : ''}
        />
        <StatCard
          icon={Truck} label="KM del vehículo" color="#22D3EE" delay={8}
          value={vehiculo.kilometraje
            ? `${Number(vehiculo.kilometraje).toLocaleString('es-AR')} km`
            : 'Sin datos'}
          sub={vehiculo.patente || ''}
        />
      </div>

      {/* ── Acceso rápido ── */}
      <div className="db-panel db-in db-d8" style={{ padding: '22px 24px' }}>
        <p className="db-slabel">Acceso rápido</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <QuickBtn icon={ArrowUpCircle}   label="Nuevo ingreso"   color="#34D399" onClick={() => onNav('finanzas')}      />
          <QuickBtn icon={ArrowDownCircle} label="Nuevo gasto"     color="#F87171" onClick={() => onNav('finanzas')}      />
          <QuickBtn icon={Fuel}            label="Nueva carga"     color="#22D3EE" onClick={() => onNav('combustible')}   />
          <QuickBtn icon={Wrench}          label="Mantenimiento"   color="#FBBF24" onClick={() => onNav('mantenimiento')} />
        </div>
      </div>
    </div>
  )
}
