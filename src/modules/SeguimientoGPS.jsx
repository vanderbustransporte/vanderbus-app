import React, { useState, useEffect, useCallback, useReducer, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { detectarViajes, STOP_MINUTOS } from '../utils/detectarViajes'
import {
  Navigation, Wifi, WifiOff, Clock, Gauge, Bus,
  History, Radio, MapPin, AlertCircle,
} from 'lucide-react'

// ─── Tokens de color (sistema de diseño del proyecto) ─────────────────────────

const C = {
  surface:     '#18181b',
  overlay:     'var(--bg-overlay)',
  border:      'rgba(255,255,255,0.07)',
  borderHi:    'rgba(255,255,255,0.13)',
  text1:       'var(--text-1)',
  text2:       '#94a3b8',
  text3:       '#52525b',
  accent:      '#38bdf8',
  accentDim:   'rgba(56,189,248,0.10)',
  accentGlow:  'rgba(56,189,248,0.50)',
  inactive:    '#64748b',
  inactiveDim: 'rgba(100,116,139,0.12)',
  danger:      '#f87171',
  dangerDim:   'rgba(248,113,113,0.10)',
}

// Paleta de colores para los viajes del historial (10 colores distintos)
const TRIP_COLORS = [
  '#38bdf8', '#34d399', '#fbbf24', '#a78bfa',
  '#fb923c', '#e879f9', '#4ade80', '#f87171',
  '#22d3ee', '#facc15',
]

// ─── Íconos de mapa ────────────────────────────────────────────────────────────

function crearIcono(activo) {
  const color  = activo ? C.accent   : C.inactive
  const bg     = activo ? 'rgba(56,189,248,0.16)' : C.inactiveDim
  const border = activo ? 'rgba(56,189,248,0.55)' : 'rgba(100,116,139,0.35)'
  const glow   = activo ? 'rgba(56,189,248,0.22)' : 'transparent'
  return L.divIcon({
    html: `<div style="width:36px;height:36px;background:${bg};border:1.5px solid ${border};
        border-radius:10px;display:flex;align-items:center;justify-content:center;
        backdrop-filter:blur(8px);box-shadow:0 0 0 5px ${glow},0 4px 16px rgba(0,0,0,0.5)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="${color}">
          <path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0
            0 001 1h1a1 1 0 001-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8
            4v10zm3.5 1a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm9 0a1.5 1.5 0 110-3 1.5 1.5 0
            010 3zM4 11V6h16v5H4z"/>
        </svg></div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -22],
  })
}

// Marcadores de inicio (verde) y fin (rojo) de cada viaje en el historial
const ICONO_INICIO = L.divIcon({
  html: `<div style="width:12px;height:12px;background:#22c55e;border:2.5px solid #fff;
      border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>`,
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

const ICONO_FIN = L.divIcon({
  html: `<div style="width:12px;height:12px;background:#ef4444;border:2.5px solid #fff;
      border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>`,
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

// ─── Controladores de mapa ────────────────────────────────────────────────────

// Tiempo real: flyTo a un vehículo
function MapFlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    map.flyTo([target.lat, target.lng], 15, { duration: 1.1, easeLinearity: 0.35 })
  }, [target, map])
  return null
}

// Historial: ajusta el mapa a todos los viajes visibles al cargar
function MapFitBounds({ viajes }) {
  const map = useMap()
  useEffect(() => {
    if (!viajes || viajes.length === 0) return
    const coords = viajes.flatMap(v => v.recorrido.map(p => [p.lat, p.lng]))
    if (coords.length > 0) {
      map.fitBounds(L.latLngBounds(coords), { padding: [32, 32], maxZoom: 14 })
    }
  }, [viajes, map])
  return null
}

// Historial: flyToBounds del viaje seleccionado
function MapFlyToTrip({ target }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    const coords = target.recorrido.map(p => [p.lat, p.lng])
    if (coords.length > 0) {
      map.fitBounds(L.latLngBounds(coords), { padding: [50, 50], maxZoom: 15 })
    }
  }, [target, map])
  return null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tiempoDesde(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (s < 60)   return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

function esActivo(iso) {
  return Date.now() - new Date(iso) < STOP_MINUTOS * 60 * 1000
}

function fmtVel(v) {
  return v != null ? `${Math.round(v)} km/h` : '--'
}

function fmtHora(iso) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDuracion(seg) {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function calcularRango(periodo, fechaRef) {
  const d = new Date(fechaRef + 'T00:00:00')
  if (periodo === 'dia') {
    const desde = new Date(d); desde.setHours(0, 0, 0, 0)
    const hasta  = new Date(d); hasta.setHours(23, 59, 59, 999)
    return { desde, hasta }
  }
  if (periodo === 'semana') {
    // Semana que empieza el lunes
    const dow   = d.getDay() === 0 ? 6 : d.getDay() - 1
    const desde = new Date(d)
    desde.setDate(d.getDate() - dow); desde.setHours(0, 0, 0, 0)
    const hasta  = new Date(desde)
    hasta.setDate(desde.getDate() + 6); hasta.setHours(23, 59, 59, 999)
    return { desde, hasta }
  }
  // mes
  const desde = new Date(d.getFullYear(), d.getMonth(), 1)
  const hasta  = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
  return { desde, hasta }
}

// ─── Componente raíz ──────────────────────────────────────────────────────────

const CENTER_ARG   = [-34.6037, -58.3816]
const ZOOM_DEFAULT = 12

export default function SeguimientoGPS() {
  const [tab, setTab] = useState('realtime')

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 12,
      height: 'calc(100dvh - 7rem)', overflow: 'hidden',
    }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h1 className="mod-h1" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <Navigation size={18} style={{ color: C.accent }} />
          Seguimiento GPS
        </h1>
        <TabSwitch tab={tab} onTab={setTab} />
      </div>

      {/* ── Vistas ──────────────────────────────────────────────────────────── */}
      {tab === 'realtime'  && <VistaRealtime />}
      {tab === 'historial' && <VistaHistorial />}
    </div>
  )
}

// ─── Tab switcher ─────────────────────────────────────────────────────────────

function TabSwitch({ tab, onTab }) {
  const tabs = [
    { id: 'realtime',  label: 'Tiempo real', Icon: Radio   },
    { id: 'historial', label: 'Historial',   Icon: History },
  ]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2,
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: 3,
    }}>
      {tabs.map(({ id, label, Icon }) => {
        const active = tab === id
        return (
          <button
            key={id}
            onClick={() => onTab(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 7,
              border: active ? `1px solid rgba(56,189,248,0.20)` : '1px solid transparent',
              background: active ? C.accentDim : 'transparent',
              color: active ? C.accent : C.text2,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              outline: 'none',
              transition: 'background 120ms ease-out, color 120ms ease-out',
            }}
          >
            <Icon size={12} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// VISTA TIEMPO REAL
// ═══════════════════════════════════════════════════════════════════════════════

function VistaRealtime() {
  const [vehiculos, setVehiculos] = useState({})
  const [flyTarget, setFlyTarget] = useState(null)
  const [selected,  setSelected]  = useState(null)
  const [cargando,  setCargando]  = useState(true)
  const [errorMsg,  setErrorMsg]  = useState(null)
  const [, forceRender] = useReducer(n => n + 1, 0)

  // Carga inicial
  useEffect(() => {
    async function cargar() {
      setCargando(true); setErrorMsg(null)
      const desde = new Date(Date.now() - STOP_MINUTOS * 2 * 60 * 1000 * 15).toISOString() // 30 min
      const { data, error } = await supabase
        .from('ubicaciones').select('*')
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
      if (error) { setErrorMsg('Supabase: ' + error.message); setCargando(false); return }
      const mapa = {}
      ;(data || []).forEach(row => { if (!mapa[row.patente]) mapa[row.patente] = row })
      setVehiculos(mapa); setCargando(false)
    }
    cargar()
  }, [])

  // Realtime INSERT
  useEffect(() => {
    const ch = supabase.channel('ubicaciones-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ubicaciones' },
        ({ new: row }) => setVehiculos(prev => ({ ...prev, [row.patente]: row }))
      ).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Ticker 15s para actualizar "hace Xm"
  useEffect(() => {
    const id = setInterval(forceRender, 15000)
    return () => clearInterval(id)
  }, [])

  const seleccionar = useCallback((patente) => {
    const v = vehiculos[patente]
    if (!v) return
    setSelected(patente)
    setFlyTarget({ lat: v.lat, lng: v.lng, _ts: Date.now() })
  }, [vehiculos])

  const lista = Object.values(vehiculos).sort((a, b) => {
    const aA = esActivo(a.created_at), bA = esActivo(b.created_at)
    if (aA !== bA) return bA ? 1 : -1
    return new Date(b.created_at) - new Date(a.created_at)
  })
  const totalActivos = lista.filter(v => esActivo(v.created_at)).length

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Status bar */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <p className="mod-sub" style={{ margin: 0 }}>
          {cargando
            ? 'Cargando datos...'
            : `${totalActivos} vehículo${totalActivos !== 1 ? 's' : ''} activo${totalActivos !== 1 ? 's' : ''} · ${lista.length} en últimos 30 min`}
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
          borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: errorMsg ? C.dangerDim : C.accentDim,
          border: `1px solid ${errorMsg ? 'rgba(248,113,113,0.25)' : 'rgba(56,189,248,0.20)'}`,
          color: errorMsg ? C.danger : C.accent,
        }}>
          {errorMsg ? <><WifiOff size={12} /> Sin conexión</> : <><Wifi size={12} /> Tiempo real</>}
        </div>
      </div>

      {errorMsg && (
        <div style={{
          flexShrink: 0, padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: C.dangerDim, border: '1px solid rgba(248,113,113,0.20)', color: C.danger,
        }}>
          {errorMsg}
        </div>
      )}

      {/* Mapa (70%) + Panel (30%) */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>
        {/* Mapa */}
        <div style={{
          flex: 7, minWidth: 0, position: 'relative',
          borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.borderHi}`,
        }}>
          <MapContainer center={CENTER_ARG} zoom={ZOOM_DEFAULT}
            style={{ position: 'absolute', inset: 0 }} zoomControl>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
              maxZoom={19}
            />
            <MapFlyTo target={flyTarget} />
            {lista.map(v => (
              <Marker key={v.patente} position={[v.lat, v.lng]}
                icon={crearIcono(esActivo(v.created_at))}
                eventHandlers={{ click: () => setSelected(v.patente) }}>
                <Popup><PopupContent v={v} /></Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Panel lateral */}
        <aside style={{
          flex: 3, minWidth: 220, maxWidth: 320,
          display: 'flex', flexDirection: 'column',
          background: C.surface, border: `1px solid ${C.borderHi}`,
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.text2 }}>
              Vehículos
            </span>
            {!cargando && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: totalActivos > 0 ? C.accentDim : C.inactiveDim,
                color: totalActivos > 0 ? C.accent : C.inactive,
              }}>
                {totalActivos} activo{totalActivos !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {cargando && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: C.text2, fontSize: 13 }}>
                Cargando...
              </div>
            )}
            {!cargando && lista.length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <Bus size={28} style={{ color: C.text3, margin: '0 auto 10px', display: 'block' }} />
                <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>Sin ubicaciones</p>
                <p style={{ fontSize: 12, color: C.text3, margin: '4px 0 0' }}>
                  Ningún vehículo reportó posición en los últimos 30 min
                </p>
              </div>
            )}
            {lista.map(v => (
              <VehicleRow
                key={v.patente} v={v}
                activo={esActivo(v.created_at)}
                esSel={selected === v.patente}
                onClick={() => seleccionar(v.patente)}
              />
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// VISTA HISTORIAL
// ═══════════════════════════════════════════════════════════════════════════════

function VistaHistorial() {
  const hoy = new Date().toISOString().slice(0, 10)
  const [periodo,       setPeriodo]       = useState('dia')
  const [fechaRef,      setFechaRef]      = useState(hoy)
  const [patenteFilter, setPatenteFilter] = useState('')
  const [patentesList,  setPatentesList]  = useState([])
  const [todosViajes,   setTodosViajes]   = useState([])  // todos, sin filtrar
  const [viajeIdx,      setViajeIdx]      = useState(null) // índice seleccionado
  const [flyTrip,       setFlyTrip]       = useState(null) // viaje para flyToBounds
  const [cargando,      setCargando]      = useState(false)
  const [errorMsg,      setErrorMsg]      = useState(null)

  // ── Carga de datos cuando cambia período/fecha ────────────────────────────
  // patenteFilter NO está en deps: filtra localmente sin re-query
  useEffect(() => {
    async function cargar() {
      setCargando(true)
      setErrorMsg(null)
      setViajeIdx(null)
      setTodosViajes([])
      setPatentesList([])

      const { desde, hasta } = calcularRango(periodo, fechaRef)

      // 1. Query de pings (todas las patentes, sin filtro)
      const { data: pings, error: pingErr } = await supabase
        .from('ubicaciones')
        .select('patente, chofer, lat, lng, velocidad, created_at')
        .gte('created_at', desde.toISOString())
        .lte('created_at', hasta.toISOString())
        .order('created_at', { ascending: true })

      if (pingErr) {
        setErrorMsg('Error cargando datos: ' + pingErr.message)
        setCargando(false)
        return
      }

      const data = pings || []

      // 2. Patentes disponibles en el período
      const patentes = [...new Set(data.map(p => p.patente))].sort()
      setPatentesList(patentes)

      // 3. Agrupar por patente y detectar viajes
      const byPatente = {}
      data.forEach(p => {
        if (!byPatente[p.patente]) byPatente[p.patente] = []
        byPatente[p.patente].push(p)
      })

      let todosV = []
      Object.values(byPatente).forEach(ps => {
        todosV = [...todosV, ...detectarViajes(ps)]
      })
      todosV.sort((a, b) => new Date(a.inicio) - new Date(b.inicio))

      // 4. Dedup + guardar en viajes_gps solo los viajes nuevos
      if (todosV.length > 0) {
        const { data: existentes } = await supabase
          .from('viajes_gps')
          .select('patente, inicio')
          .gte('inicio', desde.toISOString())
          .lte('inicio', hasta.toISOString())

        // Comparar con timestamps en ms para evitar diferencias de formato ISO
        const existSet = new Set(
          (existentes || []).map(e => `${e.patente}|${new Date(e.inicio).getTime()}`)
        )
        const nuevos = todosV.filter(
          v => !existSet.has(`${v.patente}|${new Date(v.inicio).getTime()}`)
        )

        if (nuevos.length > 0) {
          // Ignorar error de inserción (puede fallar si la tabla no existe todavía)
          await supabase.from('viajes_gps').insert(
            nuevos.map(v => ({
              patente:      v.patente,
              chofer:       v.chofer,
              inicio:       v.inicio,
              fin:          v.fin,
              duracion_seg: v.duracion_seg,
              distancia_km: Math.round(v.distancia_km * 1000) / 1000,
              velocidad_max: v.velocidad_max != null
                ? Math.round(v.velocidad_max * 10) / 10
                : null,
              recorrido:    v.recorrido,
            }))
          )
        }
      }

      setTodosViajes(todosV)
      setCargando(false)
    }
    cargar()
  }, [periodo, fechaRef])

  // ── Filtro por patente (en memoria, sin re-query) ─────────────────────────
  const viajes = useMemo(() => {
    if (!patenteFilter) return todosViajes
    return todosViajes.filter(v => v.patente === patenteFilter)
  }, [todosViajes, patenteFilter])

  // ── Selección de viaje en el panel ───────────────────────────────────────
  function onSelectTrip(idx) {
    if (viajeIdx === idx) {
      setViajeIdx(null)
      setFlyTrip(null)
    } else {
      setViajeIdx(idx)
      setFlyTrip({ ...viajes[idx], _ts: Date.now() })
    }
  }

  const totalKm  = viajes.reduce((s, v) => s + v.distancia_km, 0)
  const totalSeg = viajes.reduce((s, v) => s + v.duracion_seg, 0)

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Barra de controles ─────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}>
        {/* Selector de período */}
        {[
          { id: 'dia',    label: 'Día'    },
          { id: 'semana', label: 'Semana' },
          { id: 'mes',    label: 'Mes'    },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => { setPeriodo(id); setViajeIdx(null) }}
            style={{
              padding: '5px 13px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: periodo === id ? C.accentDim : C.surface,
              border: `1px solid ${periodo === id ? 'rgba(56,189,248,0.25)' : C.border}`,
              color: periodo === id ? C.accent : C.text2,
              outline: 'none',
              transition: 'background 100ms, color 100ms',
            }}
          >
            {label}
          </button>
        ))}

        {/* Date picker */}
        <input
          type="date"
          value={fechaRef}
          max={hoy}
          onChange={e => { setFechaRef(e.target.value); setViajeIdx(null) }}
          style={{
            padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 500,
            background: C.surface, border: `1px solid ${C.border}`,
            color: C.text1, outline: 'none', cursor: 'pointer',
          }}
        />

        {/* Filtro por patente */}
        {patentesList.length > 1 && (
          <select
            value={patenteFilter}
            onChange={e => { setPatenteFilter(e.target.value); setViajeIdx(null) }}
            style={{
              padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 500,
              background: C.surface, border: `1px solid ${C.border}`,
              color: patenteFilter ? C.text1 : C.text2, outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">Todas las patentes</option>
            {patentesList.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}

        {/* Contador de resultados */}
        {!cargando && (
          <span style={{ fontSize: 12, color: C.text3, marginLeft: 'auto' }}>
            {viajes.length} viaje{viajes.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {errorMsg && (
        <div style={{
          flexShrink: 0, padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: C.dangerDim, border: '1px solid rgba(248,113,113,0.20)', color: C.danger,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={14} /> {errorMsg}
        </div>
      )}

      {/* ── Mapa (70%) + Panel (30%) ────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>

        {/* Mapa */}
        <div style={{
          flex: 7, minWidth: 0, position: 'relative',
          borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.borderHi}`,
        }}>
          <MapContainer center={CENTER_ARG} zoom={ZOOM_DEFAULT}
            style={{ position: 'absolute', inset: 0 }} zoomControl>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
              maxZoom={19}
            />
            {/* Fit bounds cuando carga */}
            {viajes.length > 0 && !cargando && <MapFitBounds viajes={viajes} />}
            {/* FlyTo al seleccionar un viaje en el panel */}
            {flyTrip && <MapFlyToTrip target={flyTrip} />}

            {viajes.map((viaje, idx) => {
              const color   = TRIP_COLORS[idx % TRIP_COLORS.length]
              const isSel   = viajeIdx === idx
              const opacity = viajeIdx === null ? 0.75 : isSel ? 1 : 0.22
              const weight  = viajeIdx === null ? 3    : isSel ? 5 : 2
              const coords  = viaje.recorrido.map(p => [p.lat, p.lng])

              return (
                <React.Fragment key={idx}>
                  <Polyline
                    positions={coords}
                    pathOptions={{ color, opacity, weight }}
                    eventHandlers={{ click: () => onSelectTrip(idx) }}
                  />
                  <Marker position={coords[0]}                    icon={ICONO_INICIO} />
                  <Marker position={coords[coords.length - 1]}    icon={ICONO_FIN}    />
                </React.Fragment>
              )
            })}
          </MapContainer>

          {/* Overlay de carga sobre el mapa */}
          {cargando && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 999, borderRadius: 11,
              background: 'rgba(9,9,11,0.65)', backdropFilter: 'blur(3px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>Cargando datos...</p>
            </div>
          )}

          {/* Leyenda de íconos en el mapa */}
          {!cargando && viajes.length > 0 && (
            <div style={{
              position: 'absolute', bottom: 24, left: 12, zIndex: 900,
              background: 'rgba(9,9,11,0.78)', backdropFilter: 'blur(6px)',
              border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px',
              display: 'flex', gap: 12,
            }}>
              {[
                { icon: ICONO_INICIO, color: '#22c55e', label: 'Inicio' },
                { icon: ICONO_FIN,   color: '#ef4444', label: 'Fin'    },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.text2 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, border: '1.5px solid #fff', flexShrink: 0 }} />
                  {label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel lateral */}
        <aside style={{
          flex: 3, minWidth: 220, maxWidth: 320,
          display: 'flex', flexDirection: 'column',
          background: C.surface, border: `1px solid ${C.borderHi}`,
          borderRadius: 12, overflow: 'hidden',
        }}>
          {/* Cabecera panel */}
          <div style={{
            padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.text2 }}>
              Viajes
            </span>
            {!cargando && viajes.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: C.accentDim, color: C.accent,
              }}>
                {viajes.length}
              </span>
            )}
          </div>

          {/* Resumen totales (solo Semana y Mes) */}
          {periodo !== 'dia' && !cargando && viajes.length > 0 && (
            <div style={{
              padding: '12px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6,
            }}>
              {[
                { label: 'VIAJES',   value: viajes.length             },
                { label: 'KM',       value: totalKm.toFixed(1)        },
                { label: 'EN RUTA',  value: fmtDuracion(totalSeg)     },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: 17, fontWeight: 700, color: C.text1,
                    fontFamily: "'Geist Mono', monospace", lineHeight: 1.2,
                  }}>
                    {value}
                  </div>
                  <div style={{ fontSize: 9, color: C.text3, letterSpacing: '0.08em', marginTop: 2 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lista de viajes */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {cargando && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: C.text2, fontSize: 13 }}>
                Cargando...
              </div>
            )}

            {!cargando && viajes.length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <MapPin size={28} style={{ color: C.text3, margin: '0 auto 10px', display: 'block' }} />
                <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>Sin viajes detectados</p>
                <p style={{ fontSize: 12, color: C.text3, margin: '4px 0 0' }}>
                  No hay recorridos en el período seleccionado
                </p>
              </div>
            )}

            {viajes.map((viaje, idx) => (
              <TripRow
                key={idx}
                viaje={viaje}
                color={TRIP_COLORS[idx % TRIP_COLORS.length]}
                selected={viajeIdx === idx}
                compact={periodo !== 'dia'}
                onClick={() => onSelectTrip(idx)}
              />
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES COMPARTIDOS
// ═══════════════════════════════════════════════════════════════════════════════

function VehicleRow({ v, activo, esSel, onClick }) {
  const [hover, setHover] = useState(false)
  const bg = esSel ? 'rgba(56,189,248,0.08)' : hover ? 'rgba(255,255,255,0.03)' : 'transparent'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', textAlign: 'left', padding: '11px 16px', display: 'block',
        borderBottom: `1px solid ${C.border}`,
        borderLeft: `3px solid ${esSel ? C.accent : 'transparent'}`,
        background: bg, cursor: 'pointer', border: 'none', outline: 'none',
        transition: 'background 100ms ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 700, fontSize: 13, color: C.text1, letterSpacing: '0.05em' }}>
          {v.patente}
        </span>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: activo ? C.accent : '#475569',
          boxShadow: activo ? `0 0 6px ${C.accentGlow}` : 'none',
        }} />
      </div>
      <div style={{ fontSize: 12, color: C.text2, marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {v.chofer}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: activo ? C.accent : C.inactive }}>
          <Gauge size={10} />{fmtVel(v.velocidad)}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: C.text3 }}>
          <Clock size={10} />{tiempoDesde(v.created_at)}
        </span>
      </div>
    </button>
  )
}

function PopupContent({ v }) {
  const activo = esActivo(v.created_at)
  return (
    <div style={{ minWidth: 186 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <Bus size={13} style={{ color: activo ? C.accent : C.inactive, flexShrink: 0 }} />
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: activo ? C.accent : C.inactive }}>
          {v.patente}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
          background: activo ? 'rgba(56,189,248,0.15)' : 'rgba(100,116,139,0.15)',
          color: activo ? C.accent : C.inactive,
        }}>
          {activo ? 'ACTIVO' : 'INACTIVO'}
        </span>
      </div>
      <div style={{ fontSize: 12, color: C.text2, marginBottom: 9 }}>{v.chofer}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 8 }}>
        {[
          { label: 'VELOCIDAD', value: fmtVel(v.velocidad) },
          { label: 'PRECISION',  value: v.precision_m != null ? `${v.precision_m}m` : '--' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '6px 8px' }}>
            <div style={{ fontSize: 10, color: C.text3, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.text3 }}>
        <Clock size={10} /> Última señal hace {tiempoDesde(v.created_at)}
      </div>
    </div>
  )
}

function TripRow({ viaje, color, selected, compact, onClick }) {
  const [hover, setHover] = useState(false)
  const bg = selected
    ? `${color}18`
    : hover ? 'rgba(255,255,255,0.03)' : 'transparent'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', textAlign: 'left', display: 'block',
        padding: compact ? '9px 14px' : '11px 16px',
        borderBottom: `1px solid ${C.border}`,
        borderLeft: `3px solid ${selected ? color : 'transparent'}`,
        background: bg, cursor: 'pointer', border: 'none', outline: 'none',
        transition: 'background 100ms ease-out',
      }}
    >
      {/* Patente + horario */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: compact ? 2 : 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, fontWeight: 700, color: C.text1 }}>
          {viaje.patente}
        </span>
        <span style={{ fontSize: 11, color: C.text2, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          {fmtHora(viaje.inicio)} → {fmtHora(viaje.fin)}
        </span>
      </div>

      {/* Stats */}
      {!compact ? (
        <div style={{ display: 'flex', gap: 10, paddingLeft: 15 }}>
          <span style={{ fontSize: 11, color: C.text3 }}>{fmtDuracion(viaje.duracion_seg)}</span>
          <span style={{ fontSize: 11, color: C.text3 }}>{viaje.distancia_km.toFixed(2)} km</span>
          {viaje.velocidad_max != null && (
            <span style={{ fontSize: 11, color: C.text3 }}>máx {fmtVel(viaje.velocidad_max)}</span>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: C.text3, paddingLeft: 15 }}>
          {fmtDuracion(viaje.duracion_seg)} · {viaje.distancia_km.toFixed(2)} km
          {viaje.velocidad_max != null ? ` · máx ${fmtVel(viaje.velocidad_max)}` : ''}
        </div>
      )}
    </button>
  )
}
