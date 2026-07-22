// Fase D — Link público de seguimiento por viaje.
//
// El link es una capability URL: `#/track/<token>` donde token es un secreto
// aleatorio de 128 bits. Quien lo tiene ve el estado y la última posición de ESE
// viaje, sin loguearse, vía la función `tracking_publico(token)` (security definer,
// migración 20260722120000). La página pública NO lee tablas con la anon key.
//
// Hasta que la migración se aplique, `trackingDisponible()` devuelve false y
// Viajes oculta el botón de compartir: escribir `tracking_token`/`tracking_activo`
// contra columnas inexistentes haría fallar el guardado ENTERO del viaje (mismo
// patrón que despacho.js y el bug del uuid '').

import { supabase } from '../lib/supabase'

// ¿Está aplicada la migración de tracking? Promesa cacheada por sesión.
// 42703 = columna inexistente → false definitivo. Otros errores no son
// concluyentes: false sin cachear, para reintentar en el próximo montaje.
let _check = null
export function trackingDisponible() {
  if (!_check) {
    _check = supabase.from('viajes').select('tracking_token').limit(1).then(({ error }) => {
      if (!error) return true
      if (error.code === '42703') return false
      _check = null
      return false
    })
  }
  return _check
}

// Token aleatorio de 128 bits en hex (32 chars). crypto.getRandomValues, no
// Math.random: es un secreto de acceso, tiene que ser impredecible.
export function generarTokenTracking() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

// URL completa del link público. Respeta el origin y el path actuales (HashRouter),
// así funciona igual en localhost y en el host donde se sirva la app.
export function linkTracking(token) {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#/track/${token}`
}

// Consulta pública del estado de un viaje. Devuelve { ok, estado, referencia,
// origen, destino, fecha, hora, pos } o { ok:false } si el token no existe o el
// link está apagado (no se distingue, para no permitir enumerar tokens).
export async function fetchTrackingPublico(token) {
  const { data, error } = await supabase.rpc('tracking_publico', { p_token: token })
  if (error) return { ok: false, _error: error.message }
  return data || { ok: false }
}
