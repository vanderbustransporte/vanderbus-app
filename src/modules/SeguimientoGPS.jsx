import React, { useState, useEffect, useCallback, useReducer, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { detectarViajes } from '../utils/detectarViajes'
import {
  Navigation, Wifi, WifiOff, Clock, Gauge, Bus,
  History, Radio, MapPin, AlertCircle, Battery,
} from 'lucide-react'

const SIN_SENAL_MIN = 10  // minutos sin reporte → "sin señal"
const TZ_AR = 'America/Argentina/Buenos_Aires'

const C = {
  surface:     'var(--bg-elevated)',
  overlay:     'var(--bg-overlay)',
  border:      'var(--border)',
  borderHi:    'var(--border)',
  text1:       'var(--text-1)',
  text2:       'var(--text-2)',
  text3:       'var(--text-3)',
  accent:      'var(--accent)',
  accentDim:   'var(--accent-dim)',
  accentGlow:  'rgba(56,189,248,0.50)',   // glow decorativo (box-shadow)
  inactive:    'var(--text-3)',
  inactiveDim: 'var(--bg-overlay)',
  danger:      'var(--danger)',
  dangerDim:   'var(--danger-dim)',
}

// Colores fijos del mapa: van en atributos SVG/Leaflet (fill, pathOptions.color)
// donde var(--*) NO resuelve. El mapa vive sobre tiles, no depende del tema.
const MAP_ACTIVE   = '#38bdf8'
const MAP_DANGER   = '#f87171'
const MAP_INACTIVE = '#64748b'

const TRIP_COLORS = [
  '#38bdf8', '#34d399', '#fbbf24', '#a78bfa',
  '#fb923c', '#e879f9', '#4ade80', '#f87171',
  '#22d3ee', '#facc15',
]

// ─── Íconos de mapa ────────────────────────────────────────────────────────────

function crearIcono(estado) {
  const esActivo  = estado === 'activo'
  const sinSenal  = estado === 'sinsenal'
  const color  = esActivo ? MAP_ACTIVE : sinSenal ? MAP_DANGER : MAP_INACTIVE
  const bg     = esActivo ? 'rgba(56,189,248,0.16)' : sinSenal ? 'rgba(248,113,113,0.16)' : 'rgba(100,116,139,0.12)'
  const border = esActivo ? 'rgba(56,189,248,0.55)' : sinSenal ? 'rgba(248,113,113,0.55)' : 'rgba(100,116,139,0.35)'
  const glow   = esActivo ? 'rgba(56,189,248,0.22)' : sinSenal ? 'rgba(248,113,113,0.18)' : 'transparent'
  return L.divIcon({
    html: `<div style="width:36px;height:36px;background:${bg};border:1.5px solid ${border};
        border-radius:10px;display:flex;align-items:center;justify-content:center;
        backdrop-filter:blur(8px);box-shadow:0 0 0 5px ${glow},0 4px 16px rgba(0,0,0,0.45)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="${color}">
          <path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0
            0 001 1h1a1 1 0 001-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8
            4v10zm3.5 1a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm9 0a1.5 1.5 0 110-3 1.5 1.5 0
            010 3zM4 11V6h16v5H4z"/>
        </svg></div>`,
    className: '',
    iconSize:    [36, 36],
    iconAnchor:  [18, 18],
    popupAnchor: [0, -22],
  })
}

const ICONO_INICIO = L.divIcon({
  html: `<div style="width:12px;height:12px;background:#22c55e;border:2.5px solid #fff;
      border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>`,
  className: '', iconSize: [12, 12], iconAnchor: [6, 6],
})

const ICONO_FIN = L.divIcon({
  html: `<div style="width:12px;height:12px;background:#ef4444;border:2.5px solid #fff;
      border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>`,
  className: '', iconSize: [12, 12], iconAnchor: [6, 6],
})

// ─── Controladores de mapa ────────────────────────────────────────────────────

function MapFlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    map.flyTo([target.lat, target.lon], 15, { duration: 1.1, easeLinearity: 0.35 })
  }, [target, map])
  return null
}

function MapFitBounds({ viajes }) {
  const map = useMap()
  useEffect(() => {
    if (!viajes?.length) return
    const coords = viajes.flatMap(v => v.recorrido.map(p => [p.lat, p.lng]))
    if (coords.length > 0) map.fitBounds(L.latLngBounds(coords), { padding: [32, 32], maxZoom: 14 })
  }, [viajes, map])
  return null
}

function MapFlyToTrip({ target }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    const coords = target.recorrido.map(p => [p.lat, p.lng])
    if (coords.length > 0) map.fitBounds(L.latLngBounds(coords), { padding: [50, 50], maxZoom: 15 })
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

function estadoDisp(capturadoEn) {
  const min = (Date.now() - new Date(capturadoEn)) / 60000
  if (min < SIN_SENAL_MIN) return 'activo'
  if (min < 60)            return 'sinsenal'
  return 'inactivo'
}

function fmtVel(v) { return v != null ? `${Math.round(v)} km/h` : '--' }
function fmtBat(b) { return b != null ? `${Math.round(b)}%` : null }

function fmtHora(iso) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: TZ_AR })
}

function dateToStr(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function getHoyArgentina() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_AR }).format(new Date())
}

function fmtDuracion(seg) {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function calcularRango(periodo, fechaRef) {
  // Boundaries con offset explícito -03:00 para no depender del timezone del browser
  const [y, m, d] = fechaRef.split('-').map(Number)
  if (periodo === 'dia') {
    return {
      desde: new Date(fechaRef + 'T00:00:00-03:00'),
      hasta:  new Date(fechaRef + 'T23:59:59.999-03:00'),
    }
  }
  if (periodo === 'semana') {
    const dow     = (new Date(y, m - 1, d).getDay() + 6) % 7  // lun=0 … dom=6
    const inicioD = new Date(y, m - 1, d - dow)
    const finD    = new Date(y, m - 1, d - dow + 6)
    return {
      desde: new Date(dateToStr(inicioD) + 'T00:00:00-03:00'),
      hasta:  new Date(dateToStr(finD)   + 'T23:59:59.999-03:00'),
    }
  }
  const iniStr  = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const finStr  = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return {
    desde: new Date(iniStr + 'T00:00:00-03:00'),
    hasta:  new Date(finStr + 'T23:59:59.999-03:00'),
  }
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
          <button key={id} onClick={() => onTab(id)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 7,
            border: active ? '1px solid var(--accent-dim)' : '1px solid transparent',
            background: active ? C.accentDim : 'transparent',
            color: active ? C.accent : C.text2,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none',
            transition: 'background 120ms ease-out, color 120ms ease-out',
          }}>
            <Icon size={12} />{label}
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
  const [vehiculos, setVehiculos] = useState({})  // { dispositivo: last_row }
  const [rutas,     setRutas]     = useState({})  // { dispositivo: [{ lat, lon }] }
  const [flyTarget, setFlyTarget] = useState(null)
  const [selected,  setSelected]  = useState(null)
  const [cargando,  setCargando]  = useState(true)
  const [errorMsg,  setErrorMsg]  = useState(null)
  const [, forceRender] = useReducer(n => n + 1, 0)

  // Carga inicial: posiciones de las últimas 24 horas (evita el corte de medianoche UTC)
  useEffect(() => {
    async function cargar() {
      setCargando(true); setErrorMsg(null)
      const desde24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('ubicaciones_gps')
        .select('*')
        .gte('capturado_en', desde24h)
        .order('capturado_en', { ascending: true })

      if (error) { setErrorMsg('Supabase: ' + error.message); setCargando(false); return }

      const vMap = {}
      const rMap = {}
      ;(data || []).forEach(row => {
        vMap[row.dispositivo] = row  // orden asc: la última iteración = la más reciente
        if (!rMap[row.dispositivo]) rMap[row.dispositivo] = []
        rMap[row.dispositivo].push({ lat: row.lat, lon: row.lon })
      })
      setVehiculos(vMap)
      setRutas(rMap)
      setCargando(false)
    }
    cargar()
  }, [])

  // Realtime: actualiza posición + extiende ruta del día
  useEffect(() => {
    const ch = supabase.channel('ubicaciones-gps-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ubicaciones_gps' },
        ({ new: row }) => {
          setVehiculos(prev => ({ ...prev, [row.dispositivo]: row }))
          setRutas(prev => ({
            ...prev,
            [row.dispositivo]: [...(prev[row.dispositivo] || []), { lat: row.lat, lon: row.lon }],
          }))
        }
      ).subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  // Ticker 15s para refrescar el "hace Xm"
  useEffect(() => {
    const id = setInterval(forceRender, 15000)
    return () => clearInterval(id)
  }, [])

  const seleccionar = useCallback((disp) => {
    const v = vehiculos[disp]
    if (!v) return
    setSelected(disp)
    setFlyTarget({ lat: v.lat, lon: v.lon, _ts: Date.now() })
  }, [vehiculos])

  const lista = Object.values(vehiculos).sort((a, b) => {
    const ea = estadoDisp(a.capturado_en), eb = estadoDisp(b.capturado_en)
    const rank = { activo: 0, sinsenal: 1, inactivo: 2 }
    if (rank[ea] !== rank[eb]) return rank[ea] - rank[eb]
    return new Date(b.capturado_en) - new Date(a.capturado_en)
  })

  const totalActivos  = lista.filter(v => estadoDisp(v.capturado_en) === 'activo').length
  const totalSinSenal = lista.filter(v => estadoDisp(v.capturado_en) === 'sinsenal').length

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Status bar */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p className="mod-sub" style={{ margin: 0 }}>
          {cargando
            ? 'Cargando datos...'
            : `${totalActivos} activo${totalActivos !== 1 ? 's' : ''} · ${lista.length} dispositivo${lista.length !== 1 ? 's' : ''} (24 h)`}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {totalSinSenal > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
              borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: C.dangerDim, border: '1px solid var(--danger-dim)', color: C.danger,
            }}>
              <WifiOff size={12} />{totalSinSenal} sin señal
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
            borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: errorMsg ? C.dangerDim : C.accentDim,
            border: `1px solid ${errorMsg ? 'var(--danger-dim)' : 'var(--accent-dim)'}`,
            color: errorMsg ? C.danger : C.accent,
          }}>
            {errorMsg ? <><WifiOff size={12} />Error</> : <><Wifi size={12} />Tiempo real</>}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div style={{
          flexShrink: 0, padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: C.dangerDim, border: '1px solid var(--danger-dim)', color: C.danger,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={14} />{errorMsg}
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

            {/* Recorrido del día por dispositivo */}
            {Object.entries(rutas).map(([disp, puntos]) => {
              if (puntos.length < 2) return null
              const isSel = selected === disp
              return (
                <Polyline
                  key={`ruta-${disp}`}
                  positions={puntos.map(p => [p.lat, p.lon])}
                  pathOptions={{
                    color:     MAP_ACTIVE,
                    opacity:   isSel ? 0.85 : 0.28,
                    weight:    isSel ? 4 : 2,
                    dashArray: isSel ? null : '6 5',
                  }}
                />
              )
            })}

            {/* Marcadores: última posición por dispositivo */}
            {lista.map(v => (
              <Marker
                key={v.dispositivo}
                position={[v.lat, v.lon]}
                icon={crearIcono(estadoDisp(v.capturado_en))}
                eventHandlers={{ click: () => setSelected(v.dispositivo) }}
              >
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
              Dispositivos
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
                  Ningún dispositivo reportó en las últimas 24 h
                </p>
              </div>
            )}
            {lista.map(v => (
              <VehicleRow
                key={v.dispositivo} v={v}
                estado={estadoDisp(v.capturado_en)}
                esSel={selected === v.dispositivo}
                onClick={() => seleccionar(v.dispositivo)}
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
  const hoy = getHoyArgentina()
  const [periodo,     setPeriodo]     = useState('dia')
  const [fechaRef,    setFechaRef]    = useState(hoy)
  const [dispFilter,  setDispFilter]  = useState('')
  const [dispList,    setDispList]    = useState([])
  const [todosViajes, setTodosViajes] = useState([])
  const [viajeIdx,    setViajeIdx]    = useState(null)
  const [flyTrip,     setFlyTrip]     = useState(null)
  const [cargando,    setCargando]    = useState(false)
  const [errorMsg,    setErrorMsg]    = useState(null)

  useEffect(() => {
    async function cargar() {
      setCargando(true); setErrorMsg(null)
      setViajeIdx(null); setTodosViajes([]); setDispList([])

      const { desde, hasta } = calcularRango(periodo, fechaRef)

      const { data: pings, error } = await supabase
        .from('ubicaciones_gps')
        .select('dispositivo, lat, lon, velocidad, capturado_en')
        .gte('capturado_en', desde.toISOString())
        .lte('capturado_en', hasta.toISOString())
        .order('capturado_en', { ascending: true })

      if (error) { setErrorMsg('Error cargando datos: ' + error.message); setCargando(false); return }

      // Adaptar al formato que espera detectarViajes ({ patente, lat, lng, velocidad, created_at })
      const data = (pings || []).map(p => ({
        ...p,
        patente:    p.dispositivo,
        lng:        p.lon,
        created_at: p.capturado_en,
      }))

      const dispositivos = [...new Set(data.map(p => p.dispositivo))].sort()
      setDispList(dispositivos)

      const byDisp = {}
      data.forEach(p => {
        if (!byDisp[p.dispositivo]) byDisp[p.dispositivo] = []
        byDisp[p.dispositivo].push(p)
      })

      let todosV = []
      Object.values(byDisp).forEach(ps => {
        todosV = [...todosV, ...detectarViajes(ps)]
      })
      todosV.sort((a, b) => new Date(a.inicio) - new Date(b.inicio))

      // Persistir viajes nuevos en viajes_gps (dedup por patente+inicio)
      if (todosV.length > 0) {
        const { data: existentes } = await supabase
          .from('viajes_gps')
          .select('patente, inicio')
          .gte('inicio', desde.toISOString())
          .lte('inicio', hasta.toISOString())

        const existSet = new Set(
          (existentes || []).map(e => `${e.patente}|${new Date(e.inicio).getTime()}`)
        )
        const nuevos = todosV.filter(
          v => !existSet.has(`${v.patente}|${new Date(v.inicio).getTime()}`)
        )
        if (nuevos.length > 0) {
          await supabase.from('viajes_gps').insert(
            nuevos.map(v => ({
              patente:       v.patente,
              chofer:        v.chofer || null,
              inicio:        v.inicio,
              fin:           v.fin,
              duracion_seg:  v.duracion_seg,
              distancia_km:  Math.round(v.distancia_km * 1000) / 1000,
              velocidad_max: v.velocidad_max != null ? Math.round(v.velocidad_max * 10) / 10 : null,
              recorrido:     v.recorrido,
            }))
          )
        }
      }

      setTodosViajes(todosV)
      setCargando(false)
    }
    cargar()
  }, [periodo, fechaRef])

  const viajes = useMemo(() => {
    if (!dispFilter) return todosViajes
    return todosViajes.filter(v => v.patente === dispFilter)
  }, [todosViajes, dispFilter])

  function onSelectTrip(idx) {
    if (viajeIdx === idx) { setViajeIdx(null); setFlyTrip(null) }
    else { setViajeIdx(idx); setFlyTrip({ ...viajes[idx], _ts: Date.now() }) }
  }

  const totalKm  = viajes.reduce((s, v) => s + v.distancia_km, 0)
  const totalSeg = viajes.reduce((s, v) => s + v.duracion_seg, 0)

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Barra de controles */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {[{ id: 'dia', label: 'Día' }, { id: 'semana', label: 'Semana' }, { id: 'mes', label: 'Mes' }]
          .map(({ id, label }) => (
            <button key={id} onClick={() => { setPeriodo(id); setViajeIdx(null) }} style={{
              padding: '5px 13px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: periodo === id ? C.accentDim : C.surface,
              border: `1px solid ${periodo === id ? 'var(--accent-dim)' : C.border}`,
              color: periodo === id ? C.accent : C.text2,
              outline: 'none', transition: 'background 100ms, color 100ms',
            }}>{label}</button>
          ))}

        <input
          type="date" value={fechaRef} max={hoy}
          onChange={e => { setFechaRef(e.target.value); setViajeIdx(null) }}
          style={{
            padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 500,
            background: C.surface, border: `1px solid ${C.border}`,
            color: C.text1, outline: 'none', cursor: 'pointer',
          }}
        />

        {dispList.length > 1 && (
          <select
            value={dispFilter}
            onChange={e => { setDispFilter(e.target.value); setViajeIdx(null) }}
            style={{
              padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 500,
              background: C.surface, border: `1px solid ${C.border}`,
              color: dispFilter ? C.text1 : C.text2, outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">Todos los dispositivos</option>
            {dispList.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}

        {!cargando && (
          <span style={{ fontSize: 12, color: C.text3, marginLeft: 'auto' }}>
            {viajes.length} viaje{viajes.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {errorMsg && (
        <div style={{
          flexShrink: 0, padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: C.dangerDim, border: '1px solid var(--danger-dim)', color: C.danger,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={14} />{errorMsg}
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
            {viajes.length > 0 && !cargando && <MapFitBounds viajes={viajes} />}
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
                  <Marker position={coords[0]}                 icon={ICONO_INICIO} />
                  <Marker position={coords[coords.length - 1]} icon={ICONO_FIN}    />
                </React.Fragment>
              )
            })}
          </MapContainer>

          {cargando && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 999, borderRadius: 11,
              background: 'rgba(9,9,11,0.65)', backdropFilter: 'blur(3px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>Cargando datos...</p>
            </div>
          )}

          {!cargando && viajes.length > 0 && (
            <div style={{
              position: 'absolute', bottom: 24, left: 12, zIndex: 900,
              background: 'rgba(9,9,11,0.78)', backdropFilter: 'blur(6px)',
              border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px',
              display: 'flex', gap: 12,
            }}>
              {[{ color: '#22c55e', label: 'Inicio' }, { color: '#ef4444', label: 'Fin' }]
                .map(({ color, label }) => (
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
          <div style={{
            padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.text2 }}>
              Viajes
            </span>
            {!cargando && viajes.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: C.accentDim, color: C.accent }}>
                {viajes.length}
              </span>
            )}
          </div>

          {periodo !== 'dia' && !cargando && viajes.length > 0 && (
            <div style={{
              padding: '12px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6,
            }}>
              {[
                { label: 'VIAJES',  value: viajes.length         },
                { label: 'KM',      value: totalKm.toFixed(1)    },
                { label: 'EN RUTA', value: fmtDuracion(totalSeg) },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.text1, fontFamily: "'Geist Mono', monospace", lineHeight: 1.2 }}>
                    {value}
                  </div>
                  <div style={{ fontSize: 9, color: C.text3, letterSpacing: '0.08em', marginTop: 2 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          )}

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
                key={idx} viaje={viaje}
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

function VehicleRow({ v, estado, esSel, onClick }) {
  const [hover, setHover] = useState(false)
  const activo   = estado === 'activo'
  const sinSenal = estado === 'sinsenal'

  const dotColor = activo ? C.accent : sinSenal ? C.danger : C.inactive
  const dotGlow  = activo ? `0 0 6px ${C.accentGlow}` : sinSenal ? '0 0 6px rgba(248,113,113,0.45)' : 'none'
  const velColor = activo ? C.accent : sinSenal ? C.danger : C.inactive
  const accentL  = esSel ? C.accent : sinSenal ? C.danger : 'transparent'
  const bat      = fmtBat(v.bateria)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', textAlign: 'left', display: 'block',
        padding: '11px 16px 11px 13px',
        borderTop: 'none', borderRight: 'none', borderBottom: `1px solid ${C.border}`,
        borderLeft: `3px solid ${accentL}`,
        background: esSel ? 'var(--accent-dim)' : hover ? 'var(--hover-tint)' : 'transparent',
        cursor: 'pointer', outline: 'none',
        transition: 'background 100ms ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 700, fontSize: 13, color: C.text1, letterSpacing: '0.05em' }}>
          {v.dispositivo}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {sinSenal && (
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.05em',
              color: C.danger, background: C.dangerDim, borderRadius: 4, padding: '2px 5px',
            }}>
              SIN SEÑAL
            </span>
          )}
          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: dotColor, boxShadow: dotGlow }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: velColor }}>
          <Gauge size={10} />{fmtVel(v.velocidad)}
        </span>
        {bat && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: v.bateria < 20 ? C.danger : C.text3 }}>
            <Battery size={10} />{bat}
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: C.text3, marginLeft: 'auto' }}>
          <Clock size={10} />{tiempoDesde(v.capturado_en)}
        </span>
      </div>
    </button>
  )
}

function PopupContent({ v }) {
  const estado   = estadoDisp(v.capturado_en)
  const activo   = estado === 'activo'
  const sinSenal = estado === 'sinsenal'
  const mainColor = activo ? C.accent : sinSenal ? C.danger : C.inactive
  const label     = activo ? 'ACTIVO' : sinSenal ? 'SIN SEÑAL' : 'INACTIVO'
  const bat       = fmtBat(v.bateria)

  const statCells = [
    { label: 'VELOCIDAD', value: fmtVel(v.velocidad) },
    { label: 'PRECISION', value: v.precision_m != null ? `${v.precision_m}m` : '--' },
    bat ? { label: 'BATERIA', value: bat } : null,
  ].filter(Boolean)

  return (
    <div style={{ minWidth: 190 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
        <Bus size={13} style={{ color: mainColor, flexShrink: 0 }} />
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: mainColor }}>
          {v.dispositivo}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
          background: activo
            ? 'var(--accent-dim)'
            : sinSenal ? 'var(--danger-dim)' : 'var(--bg-overlay)',
          color: mainColor,
        }}>
          {label}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 8 }}>
        {statCells.map(({ label: l, value }) => (
          <div key={l} style={{ background: 'var(--bg-overlay)', borderRadius: 6, padding: '6px 8px' }}>
            <div style={{ fontSize: 10, color: C.text3, marginBottom: 2 }}>{l}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.text3 }}>
        <Clock size={10} />Ultima señal hace {tiempoDesde(v.capturado_en)}
      </div>
    </div>
  )
}

function TripRow({ viaje, color, selected, compact, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', textAlign: 'left', display: 'block',
        padding: compact ? '9px 14px 9px 11px' : '11px 16px 11px 13px',
        borderTop: 'none', borderRight: 'none', borderBottom: `1px solid ${C.border}`,
        borderLeft: `3px solid ${selected ? color : 'transparent'}`,
        background: selected ? `${color}12` : hover ? 'var(--hover-tint)' : 'transparent',
        cursor: 'pointer', outline: 'none',
        transition: 'background 100ms ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: compact ? 2 : 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, fontWeight: 700, color: C.text1 }}>
          {viaje.patente}
        </span>
        <span style={{ fontSize: 11, color: C.text2, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          {fmtHora(viaje.inicio)} → {fmtHora(viaje.fin)}
        </span>
      </div>

      {!compact ? (
        <div style={{ display: 'flex', gap: 10, paddingLeft: 15 }}>
          <span style={{ fontSize: 11, color: C.text3 }}>{fmtDuracion(viaje.duracion_seg)}</span>
          <span style={{ fontSize: 11, color: C.text3 }}>{viaje.distancia_km.toFixed(2)} km</span>
          {viaje.velocidad_max != null && (
            <span style={{ fontSize: 11, color: C.text3 }}>max {fmtVel(viaje.velocidad_max)}</span>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: C.text3, paddingLeft: 15 }}>
          {fmtDuracion(viaje.duracion_seg)} · {viaje.distancia_km.toFixed(2)} km
          {viaje.velocidad_max != null ? ` · max ${fmtVel(viaje.velocidad_max)}` : ''}
        </div>
      )}
    </button>
  )
}
