// Port 1:1 de src/utils/detectarViajes.js (el algoritmo probado del frontend)
// a Deno/TS para la Edge Function detectar-viajes-gps. Si se ajusta una
// constante o una regla acá, NO hay que olvidar que este archivo es ahora la
// única copia viva: el frontend ya no detecta, solo lee viajes_gps.

export const STOP_MINUTOS     = 5    // minutos quieto para cerrar un viaje
export const STOP_RADIO_M     = 40   // metros de radio para considerar "detenido"
export const MIN_DURACION_SEG = 120  // duración mínima de un viaje válido
export const MIN_DISTANCIA_KM = 0.2  // distancia mínima de un viaje válido
export const GAP_MAX_MIN      = 10   // gap de datos que corta el viaje

export interface Ping {
  patente: string
  chofer?: string | null
  lat: number
  lng: number
  velocidad: number | null
  created_at: string
}

export interface Viaje {
  patente: string
  chofer: string | null
  inicio: string
  fin: string
  duracion_seg: number
  distancia_km: number
  velocidad_max: number | null
  recorrido: { lat: number; lng: number; t: string }[]
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

function buildTrip(pings: Ping[]): Viaje | null {
  if (pings.length < 2) return null

  let distancia_km = 0
  let velocidad_max: number | null = null

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
          : Math.max(velocidad_max, pings[i].velocidad!)
    }
  }

  const inicio       = pings[0].created_at
  const fin          = pings[pings.length - 1].created_at
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
    recorrido: pings.map((p) => ({ lat: p.lat, lng: p.lng, t: p.created_at })),
  }
}

// Recibe los pings de UN dispositivo (cualquier orden) y devuelve los viajes
// cerrados y válidos. Mismas reglas que el frontend histórico:
//   - Gap > GAP_MAX_MIN entre pings consecutivos → corta el viaje actual.
//   - Dentro de STOP_RADIO_M durante STOP_MINUTOS → cierra el viaje donde
//     comenzó la detención.
//   - El último segmento NO se cierra si el último ping tiene menos de
//     STOP_MINUTOS de antigüedad (viaje "abierto", chofer aún en ruta).
//   - Se descartan viajes cortos o lentos (MIN_DURACION_SEG / MIN_DISTANCIA_KM).
export function detectarViajes(pings: Ping[]): Viaje[] {
  if (!pings || pings.length < 2) return []

  const sorted = [...pings].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const viajes: Viaje[] = []
  let tripActual: Ping[] = []
  let stopRef: { idx: number; fromT: number } | null = null

  const STOP_MS = STOP_MINUTOS * 60 * 1000
  const GAP_MS  = GAP_MAX_MIN  * 60 * 1000

  for (let i = 0; i < sorted.length; i++) {
    const ping = sorted[i]
    const t    = new Date(ping.created_at).getTime()

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

    if (stopRef === null) {
      stopRef = { idx: pingIdx, fromT: t }
    } else {
      const refPing = tripActual[stopRef.idx]
      const dist    = haversineM(refPing.lat, refPing.lng, ping.lat, ping.lng)

      if (dist > STOP_RADIO_M) {
        stopRef = { idx: pingIdx, fromT: t }
      } else if (t - stopRef.fromT >= STOP_MS) {
        const trip = buildTrip(tripActual.slice(0, stopRef.idx + 1))
        if (trip) viajes.push(trip)
        tripActual = []
        stopRef    = null
      }
    }
  }

  if (tripActual.length >= 2) {
    const lastT         = new Date(tripActual[tripActual.length - 1].created_at).getTime()
    const minsSinceLast = (Date.now() - lastT) / 60000
    if (minsSinceLast >= STOP_MINUTOS) {
      const trip = buildTrip(tripActual)
      if (trip) viajes.push(trip)
    }
  }

  return viajes.filter(
    (v) => v.duracion_seg >= MIN_DURACION_SEG && v.distancia_km >= MIN_DISTANCIA_KM
  )
}
