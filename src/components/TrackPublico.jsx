// Fase D — Página pública de seguimiento de un viaje.
//
// Se abre en `#/track/<token>` SIN sesión (main.jsx la monta antes del AuthGate).
// No usa AuthContext ni useStore: sólo llama a la función pública
// `tracking_publico(token)` (ver utils/tracking.js). Muestra estado, ruta, fecha
// y la última posición GPS si el dispositivo del viaje reportó. Refresca sola.

import React, { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Navigation, Gauge, Clock, MapPin, AlertCircle } from 'lucide-react'
import { fetchTrackingPublico } from '../utils/tracking'
import { formatDate } from '../utils/format'
import { formatHora } from '../utils/hora'

const CENTER_ARG = [-34.7, -58.4]
const REFRESH_MS = 30_000

// Color del punto de estado. Mismos tonos semánticos del design system.
const ESTADO_COLOR = {
  Pendiente:  '#94a3b8',
  Confirmado: '#38bdf8',
  Realizado:  '#34d399',
  Cancelado:  '#f87171',
}

const ICONO = L.divIcon({
  html: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.5))">
      <div style="width:36px;height:36px;background:rgba(12,40,54,0.95);border:2px solid rgba(56,189,248,0.8);
        border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px rgba(56,189,248,0.22)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
          <path d="M15 18H9"/>
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
          <circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>
        </svg>
      </div>
      <div style="width:0;height:0;margin-top:-2px;border-left:7px solid transparent;
        border-right:7px solid transparent;border-top:9px solid rgba(56,189,248,0.8)"></div>
    </div>`,
  className: '', iconSize: [36, 47], iconAnchor: [18, 47],
})

function Recentrar({ lat, lon }) {
  const map = useMap()
  useEffect(() => {
    if (typeof lat === 'number' && typeof lon === 'number') map.setView([lat, lon], 13, { animate: true })
  }, [lat, lon, map])
  return null
}

function haceCuanto(iso) {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (isNaN(ms)) return null
  const min = Math.round(ms / 60000)
  if (min < 1) return 'hace instantes'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}

export default function TrackPublico({ token }) {
  const [estado, setEstado] = useState('cargando')  // cargando | ok | invalido
  const [d, setD] = useState(null)

  useEffect(() => {
    let vivo = true
    const cargar = async () => {
      const r = await fetchTrackingPublico(token)
      if (!vivo) return
      if (r && r.ok) { setD(r); setEstado('ok') }
      else setEstado('invalido')
    }
    cargar()
    const t = setInterval(cargar, REFRESH_MS)
    return () => { vivo = false; clearInterval(t) }
  }, [token])

  const pos = d?.pos
  const lat = pos ? Number(pos.lat) : null
  const lon = pos ? Number(pos.lon) : null
  const hayPos = typeof lat === 'number' && !isNaN(lat) && typeof lon === 'number' && !isNaN(lon)
  const color = ESTADO_COLOR[d?.estado] || '#94a3b8'
  const velocidad = pos && pos.velocidad != null ? Math.round(Number(pos.velocidad)) : null
  const senal = pos ? haceCuanto(pos.capturado_en) : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-1)',
      fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, padding: '24px 18px 48px' }}>

        {/* Marca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Navigation size={16} style={{ color: 'var(--accent)' }} />
          </div>
          <span style={{ fontSize: 13, letterSpacing: '0.04em', color: 'var(--text-2)',
            textTransform: 'uppercase', fontWeight: 600 }}>Seguimiento de viaje</span>
        </div>

        {estado === 'cargando' && (
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 40, textAlign: 'center' }}>Cargando…</p>
        )}

        {estado === 'invalido' && (
          <div style={{ marginTop: 40, textAlign: 'center' }}>
            <AlertCircle size={30} style={{ color: 'var(--text-3)', marginBottom: 12 }} />
            <p style={{ color: 'var(--text-1)', fontSize: 15, fontWeight: 600 }}>Link no disponible</p>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
              Este enlace de seguimiento no existe o fue desactivado por la empresa de transporte.
            </p>
          </div>
        )}

        {estado === 'ok' && d && (
          <>
            {/* Ficha */}
            <div className="surface" style={{ padding: 20, marginBottom: 16 }}>
              {d.referencia && (
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4,
                  fontFamily: 'var(--font-mono)' }}>Ref: {d.referencia}</p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: color,
                  boxShadow: `0 0 0 4px ${color}22` }} />
                <span style={{ fontSize: 20, fontWeight: 700 }}>{d.estado || '—'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                <MapPin size={15} style={{ color: 'var(--text-3)', marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 15, lineHeight: 1.4 }}>
                  {d.origen || '¿?'} <span style={{ color: 'var(--text-3)' }}>→</span> {d.destino || '¿?'}
                </span>
              </div>
              {d.fecha && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-2)', fontSize: 13 }}>
                  <Clock size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                  {formatDate(d.fecha)}{d.hora ? ` · ${formatHora(d.hora)} hs` : ''}
                </div>
              )}
            </div>

            {/* Mapa / posición */}
            {hayPos ? (
              <div className="surface" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ height: 320 }}>
                  <MapContainer center={[lat, lon]} zoom={13} style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={false} attributionControl={false}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[lat, lon]} icon={ICONO} />
                    <Recentrar lat={lat} lon={lon} />
                  </MapContainer>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text-2)' }}>
                    <Gauge size={14} style={{ color: 'var(--accent)' }} />
                    {velocidad != null ? <><span className="num">{velocidad}</span> km/h</> : 'detenido'}
                  </span>
                  {senal && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Última señal {senal}</span>}
                </div>
              </div>
            ) : (
              <div className="surface" style={{ padding: 24, textAlign: 'center' }}>
                <Navigation size={22} style={{ color: 'var(--text-3)', marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                  Sin ubicación en tiempo real por ahora.<br />La posición aparece cuando el vehículo está reportando.
                </p>
              </div>
            )}

            <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 18 }}>
              Se actualiza automáticamente.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
