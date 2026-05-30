// src/utils/crearNotificacion.js
import { supabase } from '../lib/supabase'

/**
 * Inserta una notificación en la tabla `notificaciones`.
 * Fire-and-forget — no lanza excepciones.
 */
export async function crearNotificacion({ tipo, titulo, mensaje, link = null, prioridad = 'normal' }) {
  const { error } = await supabase
    .from('notificaciones')
    .insert({ tipo, titulo, mensaje, link, prioridad })
  if (error) console.error('[notif]', error)
}
