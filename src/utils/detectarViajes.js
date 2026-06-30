// ─── Constantes configurables ──────────────────────────────────────────────────
// Un viaje termina cuando el vehículo permanece dentro de STOP_RADIO_M durante
// al menos STOP_MINUTOS. Un gap de datos mayor a GAP_MAX_MIN también lo corta.
// Los tramos demasiado cortos o lentos se descartan al final.

export const STOP_MINUTOS     = 5    // minutos quieto para cerrar un viaje
export const STOP_RADIO_M     = 40   // metros de radio para considerar "detenido"
export const MIN_DURACION_SEG = 120  // duración mínima de un viaje válido
export const MIN_DISTANCIA_KM = 0.2  // distancia mínima de un viaje válido
export const GAP_MAX_MIN      = 10   // gap de datos que corta el viaje

// ─── Haversine ─────────────────────────────────────────────────────────────────

function haversineM(lat1, lng1, lat2, lng2) {
  const R  = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a  =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── buildTrip ─────────────────────────────────────────────────────────────────
// Recibe un array de pings (ya validados) y calcula las métricas del viaje.
// Devuelve null si hay menos de 2 pings (no forma un viaje real).

function buildTrip(pings) {
  if (pings.length < 2) return null

  let distancia_km  = 0
  let velocidad_max = null

  for (let i = 1; i < pings.length; i++) {
    distancia_km += haversineM(
      pings[i - 1].lat, pings[i - 1].lng,
      pings[i].lat,     pings[i].lng
    ) / 1000

    // velocidad almacenada en km/h (el tracker ya convierte desde m/s)
    if (pings[i].velocidad != null) {
      velocidad_max =
        velocidad_max == null
          ? pings[i].velocidad
          : Math.max(velocidad_max, pings[i].velocidad)
    }
  }

  const inicio      = pings[0].created_at
  const fin         = pings[pings.length - 1].created_at
  const duracion_seg = Math.floor(
    (new Date(fin).getTime() - new Date(inicio).getTime()) / 1000
  )

  return {
    patente:      pings[0].patente,
    chofer:       pings[0].chofer ?? null,
    inicio,
    fin,
    duracion_seg,
    distancia_km,
    velocidad_max,
    recorrido: pings.map(p => ({ lat: p.lat, lng: p.lng, t: p.created_at })),
  }
}

// ─── detectarViajes ────────────────────────────────────────────────────────────
// Recibe los pings de UN vehículo (cualquier orden) y devuelve los viajes
// cerrados y válidos detectados.
//
// Reglas:
//   - Gap > GAP_MAX_MIN entre pings consecutivos → corta el viaje actual.
//   - Vehículo dentro de STOP_RADIO_M durante STOP_MINUTOS → cierra el viaje
//     en el punto donde comenzó la detención.
//   - El último segmento NO se guarda si el último ping tiene menos de
//     STOP_MINUTOS de antigüedad (viaje "abierto", chofer aún en ruta).
//   - Se descartan viajes con duracion_seg < MIN_DURACION_SEG
//     o distancia_km < MIN_DISTANCIA_KM.

export function detectarViajes(pings) {
  if (!pings || pings.length < 2) return []

  // Ordenar ASC por timestamp
  const sorted = [...pings].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  )

  const viajes     = []
  let tripActual   = []   // pings del viaje en curso
  // stopRef: primer ping y timestamp del inicio de la detención candidata
  let stopRef      = null  // { idx: number (en tripActual), fromT: number }

  const STOP_MS = STOP_MINUTOS * 60 * 1000
  const GAP_MS  = GAP_MAX_MIN  * 60 * 1000

  for (let i = 0; i < sorted.length; i++) {
    const ping = sorted[i]
    const t    = new Date(ping.created_at).getTime()

    // ── 1. Detectar gap con el ping anterior ─────────────────────────────────
    if (tripActual.length > 0) {
      const prevT = new Date(tripActual[tripActual.length - 1].created_at).getTime()
      if (t - prevT > GAP_MS) {
        const trip = buildTrip(tripActual)
        if (trip) viajes.push(trip)
        tripActual = []
        stopRef    = null
      }
    }

    tripActual.push(ping)
    const pingIdx = tripActual.length - 1

    // ── 2. Actualizar candidato de detención ──────────────────────────────────
    if (stopRef === null) {
      // Primer ping del segmento: inicia candidato
      stopRef = { idx: pingIdx, fromT: t }
    } else {
      const refPing = tripActual[stopRef.idx]
      const dist    = haversineM(refPing.lat, refPing.lng, ping.lat, ping.lng)

      if (dist > STOP_RADIO_M) {
        // Se movió: resetea candidato al ping actual
        stopRef = { idx: pingIdx, fromT: t }
      } else {
        // Sigue dentro del radio de detención
        if (t - stopRef.fromT >= STOP_MS) {
          // ── Detención confirmada: cerrar viaje en el punto stopRef.idx ──────
          const tripSegment = tripActual.slice(0, stopRef.idx + 1)
          const trip        = buildTrip(tripSegment)
          if (trip) viajes.push(trip)
          // Reiniciar: los pings de la detención (incluido el actual) se descartan
          tripActual = []
          stopRef    = null
        }
        // else: detención aún no confirmada, seguimos acumulando
      }
    }
  }

  // ── 3. Último segmento: solo cerrarlo si el viaje NO está "abierto" ─────────
  // Un viaje está abierto si el último ping es de hace menos de STOP_MINUTOS
  // (el chofer podría seguir en ruta — no lo guardamos).
  if (tripActual.length >= 2) {
    const lastT        = new Date(tripActual[tripActual.length - 1].created_at).getTime()
    const minsSinceLast = (Date.now() - lastT) / 60000

    if (minsSinceLast >= STOP_MINUTOS) {
      const trip = buildTrip(tripActual)
      if (trip) viajes.push(trip)
    }
    // else: viaje abierto → no se guarda
  }

  // ── 4. Filtrar ruido ──────────────────────────────────────────────────────────
  return viajes.filter(
    v => v.duracion_seg >= MIN_DURACION_SEG && v.distancia_km >= MIN_DISTANCIA_KM
  )
}
