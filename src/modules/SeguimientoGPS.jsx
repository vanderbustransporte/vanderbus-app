import React, { useState, useEffect, useCallback, useReducer, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useStore } from '../store/useStore'
import { formatARS } from '../utils/format'
import {
  Navigation, Wifi, WifiOff, Clock, Gauge, Bus,
  History, Radio, MapPin, AlertCircle, Battery,
  Smartphone, Plus, Copy, Power, Truck,
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

// Pin de camión: caja redondeada con el camión recortado + cola de pin,
// anclado en la punta (la punta señala la posición real del vehículo).
function crearIcono(estado) {
  const esActivo  = estado === 'activo'
  const sinSenal  = estado === 'sinsenal'
  const color  = esActivo ? MAP_ACTIVE : sinSenal ? MAP_DANGER : MAP_INACTIVE
  const bg     = esActivo ? 'rgba(12,40,54,0.92)' : sinSenal ? 'rgba(54,18,18,0.92)' : 'rgba(24,28,36,0.92)'
  const border = esActivo ? 'rgba(56,189,248,0.75)' : sinSenal ? 'rgba(248,113,113,0.75)' : 'rgba(100,116,139,0.45)'
  const glow   = esActivo ? 'rgba(56,189,248,0.25)' : sinSenal ? 'rgba(248,113,113,0.20)' : 'transparent'
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.5))">
        <div style="width:38px;height:38px;background:${bg};border:2px solid ${border};
          border-radius:12px;display:flex;align-items:center;justify-content:center;
          box-shadow:0 0 0 4px ${glow}">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="${color}"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
            <path d="M15 18H9"/>
            <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
            <circle cx="17" cy="18" r="2"/>
            <circle cx="7" cy="18" r="2"/>
          </svg>
        </div>
        <div style="width:0;height:0;margin-top:-2px;
          border-left:7px solid transparent;border-right:7px solid transparent;
          border-top:9px solid ${border}"></div>
      </div>`,
    className: '',
    iconSize:    [38, 49],
    iconAnchor:  [19, 49],
    popupAnchor: [0, -52],
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

// ─── Capas de mapa ─────────────────────────────────────────────────────────────
// Comparadas empíricamente sobre Lomas de Zamora (z14 y z16, 2026-07-12):
// Esri World Street Map es la capa con más rutas nombradas y numeración vial
// (datos comerciales Esri/HERE/Garmin) → default. OSM queda como alternativa
// (más POIs) y el satélite de Esri como verdad de campo. CARTO Voyager se
// descartó: casi sin detalle en AMBA a esos zooms.

const CAPAS_MAPA = {
  rutas: {
    label: 'Rutas',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri — Esri, HERE, Garmin',
    maxZoom: 19,
  },
  osm: {
    label: 'OSM',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  },
  satelite: {
    label: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri — Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
}

const CAPA_STORAGE_KEY = 'gps_capa_mapa'

function useCapaMapa() {
  const [capa, setCapa] = useState(() => {
    const guardada = localStorage.getItem(CAPA_STORAGE_KEY)
    return guardada in CAPAS_MAPA ? guardada : 'rutas'
  })
  const elegir = useCallback((id) => {
    setCapa(id)
    localStorage.setItem(CAPA_STORAGE_KEY, id)
  }, [])
  return [capa, elegir]
}

// key={capa} fuerza el remount del TileLayer al cambiar de proveedor.
function CapaBase({ capa }) {
  const { url, attribution, maxZoom } = CAPAS_MAPA[capa]
  return <TileLayer key={capa} url={url} attribution={attribution} maxZoom={maxZoom} />
}

function SelectorCapa({ capa, onCapa }) {
  return (
    <div style={{
      position: 'absolute', bottom: 24, right: 12, zIndex: 900,
      display: 'flex', gap: 2, padding: 3,
      background: 'rgba(9,9,11,0.78)', backdropFilter: 'blur(6px)',
      border: `1px solid ${C.border}`, borderRadius: 8,
    }}>
      {Object.entries(CAPAS_MAPA).map(([id, { label }]) => {
        const active = capa === id
        return (
          <button key={id} onClick={() => onCapa(id)} style={{
            padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
            fontSize: 11, fontWeight: 600, outline: 'none',
            border: active ? '1px solid var(--accent-dim)' : '1px solid transparent',
            background: active ? C.accentDim : 'transparent',
            color: active ? C.accent : C.text2,
            transition: 'background 100ms, color 100ms',
          }}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Vínculo dispositivo → vehículo y ficha del viaje ─────────────────────────
// El tracker se asocia a un vehículo desde la pestaña Dispositivos
// (dispositivos_gps.vehiculo_id). Con ese vínculo, el click en cualquier punto
// de una ruta muestra la ficha del camión + métricas del viaje + consumo
// estimado. El consumo se calcula del histórico REAL de cargas de combustible
// (litros / km entre la primera y la última carga con odómetro). Los datos de
// carga (peso, volumen, contenedor, vuelta en vacío) se cargarán desde el
// futuro módulo de cargas y acá quedan señalizados como pendientes.

function useDispositivosGps() {
  const [dispositivos, setDispositivos] = useState([])
  useEffect(() => {
    let vivo = true
    supabase
      .from('dispositivos_gps')
      .select('id, alias, vehiculo_id, activo, ultimo_ping')
      .then(({ data }) => { if (vivo) setDispositivos(data || []) })
    return () => { vivo = false }
  }, [])
  return dispositivos
}

function vehiculoDeAlias(alias, dispositivos, vehiculos) {
  const disp = (dispositivos || []).find(d => d.alias === alias)
  if (!disp?.vehiculo_id) return null
  return (vehiculos || []).find(v => v.id === disp.vehiculo_id) || null
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R  = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Rendimiento histórico en L/km: litros cargados entre la primera y la última
// carga con odómetro, dividido por los km recorridos entre ambas. Null si no
// hay al menos 2 cargas con km (o menos de 50 km entre ellas).
function rendimientoLxKm(cargas) {
  const filas = (cargas || [])
    .map(c => ({ km: parseFloat(c.km) || 0, litros: parseFloat(c.litros) || 0 }))
    .filter(c => c.km > 0 && c.litros > 0)
    .sort((a, b) => a.km - b.km)
  if (filas.length < 2) return null
  const deltaKm = filas[filas.length - 1].km - filas[0].km
  if (deltaKm < 50) return null
  const litros = filas.slice(1).reduce((s, c) => s + c.litros, 0)
  return litros / deltaKm
}

function precioLitroReciente(cargas) {
  const conPrecio = (cargas || [])
    .filter(c => (parseFloat(c.precio_litro) || 0) > 0)
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
  return conPrecio.length ? parseFloat(conPrecio[conPrecio.length - 1].precio_litro) : null
}

// Ficha que se abre al hacer click sobre la ruta (o el pin).
function FichaViaje({ alias, vehiculo, cargas, distanciaKm, stats }) {
  const rend   = vehiculo ? rendimientoLxKm(cargas) : null
  const precio = vehiculo ? precioLitroReciente(cargas) : null
  const litros = rend != null && distanciaKm > 0 ? rend * distanciaKm : null

  const filaInfo = (label, value) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11, padding: '3px 0' }}>
      <span style={{ color: C.text3 }}>{label}</span>
      <span style={{ color: C.text1, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )

  return (
    <div style={{ minWidth: 230, maxWidth: 260 }}>
      {/* Encabezado: vehículo o tracker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <Truck size={14} style={{ color: C.accent, flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 13, color: C.text1 }}>
          {vehiculo ? `${vehiculo.marca || ''} ${vehiculo.modelo || ''}`.trim() || vehiculo.alias : alias}
        </span>
        {vehiculo?.patente && (
          <span style={{
            marginLeft: 'auto', fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 700,
            padding: '2px 7px', borderRadius: 4, background: 'var(--accent-dim)', color: C.accent,
          }}>
            {vehiculo.patente}
          </span>
        )}
      </div>

      {/* Métricas del viaje */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 8 }}>
        {stats.map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg-overlay)', borderRadius: 6, padding: '6px 8px' }}>
            <div style={{ fontSize: 10, color: C.text3, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{value}</div>
          </div>
        ))}
      </div>

      {vehiculo ? (
        <>
          {/* Datos del camión */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6, marginBottom: 6 }}>
            {vehiculo.capacidad   && filaInfo('Capacidad', vehiculo.capacidad)}
            {vehiculo.combustible && filaInfo('Combustible', vehiculo.combustible)}
            {vehiculo.anio        && filaInfo('Año', vehiculo.anio)}
            {vehiculo.kilometraje && filaInfo('Odómetro', `${Number(vehiculo.kilometraje).toLocaleString('es-AR')} km`)}
          </div>

          {/* Consumo estimado */}
          <div style={{ background: 'var(--accent-dim)', borderRadius: 6, padding: '7px 9px', marginBottom: 6 }}>
            <div style={{ fontSize: 10, color: C.text3, marginBottom: 2 }}>CONSUMO ESTIMADO DEL VIAJE</div>
            {litros != null ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>
                  ≈ {litros.toFixed(1)} L{precio != null ? ` · ${formatARS(litros * precio)}` : ''}
                </div>
                <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>
                  {(rend * 100).toFixed(1)} L/100km según cargas reales de combustible
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: C.text2 }}>
                Sin cargas de combustible suficientes para estimar
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 11, color: C.warning ?? 'var(--warning)', background: 'var(--bg-overlay)', borderRadius: 6, padding: '7px 9px', marginBottom: 6 }}>
          Tracker sin vehículo asignado — asignalo en la pestaña Dispositivos
        </div>
      )}

      <div style={{ fontSize: 10, color: C.text3 }}>
        Carga, peso, volumen y retorno en vacío: pendientes del módulo de cargas.
      </div>
    </div>
  )
}

// ─── Componente raíz ──────────────────────────────────────────────────────────

const CENTER_ARG   = [-34.6037, -58.3816]
const ZOOM_DEFAULT = 12

export default function SeguimientoGPS() {
  const [tab, setTab] = useState('realtime')
  const { esOwner } = useAuth()

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
        <TabSwitch tab={tab} onTab={setTab} conDispositivos={esOwner} />
      </div>

      {tab === 'realtime'     && <VistaRealtime />}
      {tab === 'historial'    && <VistaHistorial />}
      {tab === 'dispositivos' && esOwner && <VistaDispositivos />}
    </div>
  )
}

// ─── Tab switcher ─────────────────────────────────────────────────────────────

function TabSwitch({ tab, onTab, conDispositivos }) {
  const tabs = [
    { id: 'realtime',  label: 'Tiempo real', Icon: Radio   },
    { id: 'historial', label: 'Historial',   Icon: History },
    ...(conDispositivos ? [{ id: 'dispositivos', label: 'Dispositivos', Icon: Smartphone }] : []),
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
  const [capa, elegirCapa] = useCapaMapa()
  const { data } = useStore()
  const dispositivos = useDispositivosGps()
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
      <div className="gps-split">

        {/* Mapa */}
        <div className="gps-split-map" style={{
          borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.borderHi}`,
        }}>
          <MapContainer center={CENTER_ARG} zoom={ZOOM_DEFAULT}
            style={{ position: 'absolute', inset: 0 }} zoomControl>
            <CapaBase capa={capa} />
            <MapFlyTo target={flyTarget} />

            {/* Recorrido del día por dispositivo — click en la línea = ficha */}
            {Object.entries(rutas).map(([disp, puntos]) => {
              if (puntos.length < 2) return null
              const isSel = selected === disp
              const vehiculo = vehiculoDeAlias(disp, dispositivos, data.vehiculos)
              const cargas   = vehiculo ? (data.combustible || []).filter(c => c.vehiculo_id === vehiculo.id) : []
              let km = 0
              for (let i = 1; i < puntos.length; i++) {
                km += haversineKm(puntos[i - 1].lat, puntos[i - 1].lon, puntos[i].lat, puntos[i].lon)
              }
              return (
                <Polyline
                  key={`ruta-${disp}`}
                  positions={puntos.map(p => [p.lat, p.lon])}
                  clickTolerance={14}
                  pathOptions={{
                    color:     MAP_ACTIVE,
                    opacity:   isSel ? 0.85 : 0.35,
                    weight:    isSel ? 5 : 4,
                    dashArray: isSel ? null : '6 5',
                  }}
                  eventHandlers={{ click: () => setSelected(disp) }}
                >
                  <Popup>
                    <FichaViaje
                      alias={disp} vehiculo={vehiculo} cargas={cargas} distanciaKm={km}
                      stats={[
                        { label: 'RECORRIDO HOY', value: `${km.toFixed(1)} km` },
                        { label: 'REPORTES',      value: puntos.length },
                      ]}
                    />
                  </Popup>
                </Polyline>
              )
            })}

            {/* Marcadores: última posición por dispositivo */}
            {lista.map(v => {
              const vehiculo = vehiculoDeAlias(v.dispositivo, dispositivos, data.vehiculos)
              return (
                <Marker
                  key={v.dispositivo}
                  position={[v.lat, v.lon]}
                  icon={crearIcono(estadoDisp(v.capturado_en))}
                  eventHandlers={{ click: () => setSelected(v.dispositivo) }}
                >
                  <Popup><PopupContent v={v} vehiculo={vehiculo} /></Popup>
                </Marker>
              )
            })}
          </MapContainer>

          <SelectorCapa capa={capa} onCapa={elegirCapa} />
        </div>

        {/* Panel lateral */}
        <aside className="gps-split-panel" style={{
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
  const [capa, elegirCapa] = useCapaMapa()
  const { data } = useStore()
  const dispositivos = useDispositivosGps()
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

  // Los viajes ya vienen detectados por la Edge Function detectar-viajes-gps
  // (cron cada 10 min). Acá solo se leen; RLS filtra por organización.
  useEffect(() => {
    async function cargar() {
      setCargando(true); setErrorMsg(null)
      setViajeIdx(null); setTodosViajes([]); setDispList([])

      const { desde, hasta } = calcularRango(periodo, fechaRef)

      const { data, error } = await supabase
        .from('viajes_gps')
        .select('patente, chofer, inicio, fin, duracion_seg, distancia_km, velocidad_max, recorrido')
        .gte('inicio', desde.toISOString())
        .lte('inicio', hasta.toISOString())
        .order('inicio', { ascending: true })

      if (error) { setErrorMsg('Error cargando datos: ' + error.message); setCargando(false); return }

      const viajes = (data || []).map(v => ({
        ...v,
        duracion_seg:  parseInt(v.duracion_seg, 10) || 0,
        distancia_km:  parseFloat(v.distancia_km) || 0,
        velocidad_max: v.velocidad_max != null ? parseFloat(v.velocidad_max) : null,
        recorrido:     Array.isArray(v.recorrido) ? v.recorrido : [],
      }))

      setDispList([...new Set(viajes.map(v => v.patente))].sort())
      setTodosViajes(viajes)
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
      <div className="gps-split">

        {/* Mapa */}
        <div className="gps-split-map" style={{
          borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.borderHi}`,
        }}>
          <MapContainer center={CENTER_ARG} zoom={ZOOM_DEFAULT}
            style={{ position: 'absolute', inset: 0 }} zoomControl>
            <CapaBase capa={capa} />
            {viajes.length > 0 && !cargando && <MapFitBounds viajes={viajes} />}
            {flyTrip && <MapFlyToTrip target={flyTrip} />}

            {viajes.map((viaje, idx) => {
              const color   = TRIP_COLORS[idx % TRIP_COLORS.length]
              const isSel   = viajeIdx === idx
              const opacity = viajeIdx === null ? 0.75 : isSel ? 1 : 0.22
              const weight  = viajeIdx === null ? 4    : isSel ? 6 : 3
              const coords  = viaje.recorrido.map(p => [p.lat, p.lng])
              const vehiculo = vehiculoDeAlias(viaje.patente, dispositivos, data.vehiculos)
              const cargas   = vehiculo ? (data.combustible || []).filter(c => c.vehiculo_id === vehiculo.id) : []
              return (
                <React.Fragment key={idx}>
                  <Polyline
                    positions={coords}
                    clickTolerance={14}
                    pathOptions={{ color, opacity, weight }}
                    eventHandlers={{ click: () => onSelectTrip(idx) }}
                  >
                    {/* Click en cualquier punto de la ruta → ficha del viaje */}
                    <Popup>
                      <FichaViaje
                        alias={viaje.patente} vehiculo={vehiculo} cargas={cargas}
                        distanciaKm={viaje.distancia_km}
                        stats={[
                          { label: 'HORARIO',   value: `${fmtHora(viaje.inicio)} → ${fmtHora(viaje.fin)}` },
                          { label: 'DURACIÓN',  value: fmtDuracion(viaje.duracion_seg) },
                          { label: 'DISTANCIA', value: `${viaje.distancia_km.toFixed(2)} km` },
                          { label: 'VEL. MÁX',  value: fmtVel(viaje.velocidad_max) },
                        ]}
                      />
                    </Popup>
                  </Polyline>
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

          <SelectorCapa capa={capa} onCapa={elegirCapa} />
        </div>

        {/* Panel lateral */}
        <aside className="gps-split-panel" style={{
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
                  No hay recorridos en el período seleccionado.
                  La detección corre en el servidor cada 10 minutos.
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
// VISTA DISPOSITIVOS (solo owner)
// ═══════════════════════════════════════════════════════════════════════════════
// Alta y gestión de trackers. El token se genera acá (CSPRNG), en la base solo
// se guarda su sha256, y se muestra en claro UNA sola vez para configurarlo en
// el GPSLogger. La ingesta valida el token en la Edge Function gps-ingesta.

const INGESTA_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gps-ingesta`

function genToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(texto) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function VistaDispositivos() {
  const { profile } = useAuth()
  const { addToast } = useToast()
  const { data } = useStore()
  const orgId = profile?.organization_id ?? null
  const flota = (data.vehiculos || []).filter(v => v.activo !== false)

  const [dispositivos, setDispositivos] = useState([])
  const [cargando,     setCargando]     = useState(true)
  const [errorMsg,     setErrorMsg]     = useState(null)
  const [alias,        setAlias]        = useState('')
  const [creando,      setCreando]      = useState(false)
  const [tokenNuevo,   setTokenNuevo]   = useState(null)  // { alias, token } — visible una sola vez

  const cargar = useCallback(async () => {
    setCargando(true); setErrorMsg(null)
    const { data, error } = await supabase
      .from('dispositivos_gps')
      .select('id, alias, activo, ultimo_ping, vehiculo_id, created_at')
      .order('created_at', { ascending: true })
    if (error) setErrorMsg('Error cargando dispositivos: ' + error.message)
    else setDispositivos(data || [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function crear(e) {
    e.preventDefault()
    const nombre = alias.trim()
    if (!nombre || !orgId || creando) return
    setCreando(true); setErrorMsg(null)

    const token = genToken()
    const { error } = await supabase.from('dispositivos_gps').insert({
      organization_id: orgId,
      alias: nombre,
      token_hash: await sha256Hex(token),
    })
    if (error) {
      setErrorMsg('No se pudo crear el dispositivo: ' + error.message)
    } else {
      setTokenNuevo({ alias: nombre, token })
      setAlias('')
      await cargar()
    }
    setCreando(false)
  }

  async function toggleActivo(d) {
    const { error } = await supabase
      .from('dispositivos_gps')
      .update({ activo: !d.activo })
      .eq('id', d.id)
    if (error) { setErrorMsg('No se pudo actualizar: ' + error.message); return }
    setDispositivos(prev => prev.map(x => x.id === d.id ? { ...x, activo: !d.activo } : x))
  }

  // Vincula el tracker con un vehículo de la flota: es lo que permite que el
  // mapa muestre la ficha del camión (y el consumo estimado) al tocar la ruta.
  async function asignarVehiculo(d, vehiculoId) {
    const valor = vehiculoId || null
    const { error } = await supabase
      .from('dispositivos_gps')
      .update({ vehiculo_id: valor })
      .eq('id', d.id)
    if (error) { setErrorMsg('No se pudo asignar el vehículo: ' + error.message); return }
    setDispositivos(prev => prev.map(x => x.id === d.id ? { ...x, vehiculo_id: valor } : x))
    addToast({ message: valor ? 'Vehículo asignado' : 'Vehículo desvinculado', Icon: Truck, color: 'var(--accent)' })
  }

  function copiar(texto, etiqueta) {
    navigator.clipboard.writeText(texto)
      .then(() => addToast({ message: `${etiqueta} copiado`, Icon: Copy, color: 'var(--accent)' }))
      .catch(() => setErrorMsg('No se pudo copiar al portapapeles'))
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 12 }}>

        <p className="mod-sub" style={{ margin: 0 }}>
          Cada tracker (celular con GPSLogger) usa un token propio para reportar posición.
          El token se muestra una sola vez al crearlo y se puede revocar desactivando el dispositivo.
        </p>

        {errorMsg && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, fontSize: 13,
            background: C.dangerDim, border: '1px solid var(--danger-dim)', color: C.danger,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertCircle size={14} />{errorMsg}
          </div>
        )}

        {/* Token recién generado: única vez que se ve en claro */}
        {tokenNuevo && (
          <div className="surface" style={{ padding: 16, border: '1px solid var(--accent-dim)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 8 }}>
              Token de «{tokenNuevo.alias}» — guardalo ahora, no se vuelve a mostrar
            </div>
            {[
              { etiqueta: 'Token',          valor: tokenNuevo.token },
              { etiqueta: 'URL de ingesta', valor: INGESTA_URL },
            ].map(({ etiqueta, valor }) => (
              <div key={etiqueta} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <code style={{
                  flex: 1, fontFamily: "'Geist Mono', monospace", fontSize: 12,
                  padding: '7px 10px', borderRadius: 6, background: 'var(--bg-overlay)',
                  color: C.text1, overflowX: 'auto', whiteSpace: 'nowrap',
                }}>
                  {valor}
                </code>
                <button onClick={() => copiar(valor, etiqueta)} title={`Copiar ${etiqueta.toLowerCase()}`} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px',
                  borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: C.accentDim, border: '1px solid var(--accent-dim)', color: C.accent,
                }}>
                  <Copy size={12} />Copiar
                </button>
              </div>
            ))}
            <p style={{ fontSize: 12, color: C.text3, margin: '8px 0 0' }}>
              En GPSLogger: Custom URL → método POST, header <code>x-device-token</code> con el token,
              y la URL de arriba como destino.
            </p>
          </div>
        )}

        {/* Alta */}
        <form onSubmit={crear} style={{ display: 'flex', gap: 8 }}>
          <input
            value={alias}
            onChange={e => setAlias(e.target.value)}
            placeholder="Alias del dispositivo (ej: zebra-chofer1)"
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13,
              background: C.surface, border: `1px solid ${C.border}`,
              color: C.text1, outline: 'none',
            }}
          />
          <button type="submit" className="glass-btn-primary" disabled={creando || !alias.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: creando || !alias.trim() ? 0.6 : 1 }}>
            <Plus size={14} />{creando ? 'Creando...' : 'Agregar'}
          </button>
        </form>

        {/* Listado */}
        <div className="surface" style={{ overflow: 'hidden', padding: 0 }}>
          {cargando && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: C.text2, fontSize: 13 }}>
              Cargando...
            </div>
          )}
          {!cargando && dispositivos.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <Smartphone size={28} style={{ color: C.text3, margin: '0 auto 10px', display: 'block' }} />
              <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>Sin dispositivos</p>
              <p style={{ fontSize: 12, color: C.text3, margin: '4px 0 0' }}>
                Agregá el primero para obtener su token de ingesta
              </p>
            </div>
          )}
          {dispositivos.map((d, i) => (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              borderBottom: i < dispositivos.length - 1 ? `1px solid ${C.border}` : 'none',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: d.activo ? 'var(--positive)' : C.inactive,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 700, color: C.text1 }}>
                  {d.alias}
                </div>
                <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                  {d.ultimo_ping
                    ? `Última señal hace ${tiempoDesde(d.ultimo_ping)}`
                    : 'Nunca reportó'}
                  {!d.activo && ' · desactivado (token revocado)'}
                </div>
              </div>
              <select
                value={d.vehiculo_id || ''}
                onChange={e => asignarVehiculo(d, e.target.value)}
                title="Vehículo que lleva este tracker"
                style={{
                  padding: '5px 8px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                  maxWidth: 190, background: C.overlay, border: `1px solid ${C.border}`,
                  color: d.vehiculo_id ? C.text1 : C.text3, outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="">Sin vehículo</option>
                {flota.map(v => (
                  <option key={v.id} value={v.id}>
                    {`${v.marca || ''} ${v.modelo || ''}`.trim() || v.alias || v.patente}{v.patente ? ` (${v.patente})` : ''}
                  </option>
                ))}
              </select>
              <button onClick={() => toggleActivo(d)} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px',
                borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: d.activo ? 'transparent' : C.accentDim,
                border: `1px solid ${d.activo ? C.border : 'var(--accent-dim)'}`,
                color: d.activo ? C.text2 : C.accent,
              }}>
                <Power size={12} />{d.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES COMPARTIDOS
// ═══════════════════════════════════════════════════════════════════════════════

function VehicleRow({ v, estado, esSel, onClick }) {
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
      className={esSel ? undefined : 'quiet-btn'}
      style={{
        width: '100%', textAlign: 'left', display: 'block',
        padding: '11px 16px 11px 13px',
        borderTop: 'none', borderRight: 'none', borderBottom: `1px solid ${C.border}`,
        borderLeft: `3px solid ${accentL}`,
        background: esSel ? 'var(--accent-dim)' : undefined,
        cursor: 'pointer', outline: 'none',
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

function PopupContent({ v, vehiculo }) {
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
        <Truck size={13} style={{ color: mainColor, flexShrink: 0 }} />
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

      {vehiculo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, color: C.text2 }}>
          <span style={{ fontWeight: 600, color: C.text1 }}>
            {`${vehiculo.marca || ''} ${vehiculo.modelo || ''}`.trim() || vehiculo.alias}
          </span>
          {vehiculo.patente && (
            <span style={{
              marginLeft: 'auto', fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 700,
              padding: '1px 6px', borderRadius: 4, background: 'var(--accent-dim)', color: C.accent,
            }}>
              {vehiculo.patente}
            </span>
          )}
        </div>
      )}

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
  return (
    <button
      onClick={onClick}
      className={selected ? undefined : 'quiet-btn'}
      style={{
        width: '100%', textAlign: 'left', display: 'block',
        padding: compact ? '9px 14px 9px 11px' : '11px 16px 11px 13px',
        borderTop: 'none', borderRight: 'none', borderBottom: `1px solid ${C.border}`,
        borderLeft: `3px solid ${selected ? color : 'transparent'}`,
        background: selected ? `${color}12` : undefined,
        cursor: 'pointer', outline: 'none',
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
