// Normalización de `viajes.hora`.
//
// La columna es TEXT y tiene formatos mezclados por historia:
//   - '11:59:00 AM', '9:00:00 AM'  → las escribe n8n (Google Forms → Viajes)
//   - '14:30'                      → las escribe el formulario de la app
//                                    (<input type="time"> siempre da 24h)
//   - null / ''                    → viajes cargados sin hora
//
// Ordenar esos strings tal cual sale mal: '11:59:00 AM' < '9:00:00 AM' como
// texto, y peor todavía al mezclar 12h con 24h. Por eso todo lo que lee `hora`
// pasa por acá primero.
//
// Convención: adentro de la app la hora canónica es 'HH:MM' 24h (igual criterio
// que las fechas en ISO). Las filas viejas NO se migran: se normalizan al leer,
// mismo patrón que los montos guardados como string.

// 'HH:MM' 24h, o '' si no se puede interpretar.
export function toHora(v) {
  if (!v) return ''
  const s = String(v).trim()
  if (!s) return ''

  // 12h con AM/PM: '9:00:00 AM', '11:59 PM', '1:05:00 p. m.'
  const m12 = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp])\.?\s*[Mm]\.?$/)
  if (m12) {
    let h = Number(m12[1])
    const min = Number(m12[2])
    if (h > 12 || min > 59) return ''
    const esPM = m12[4].toLowerCase() === 'p'
    if (h === 12) h = 0            // 12:xx AM → 00:xx ; 12:xx PM → 12:xx
    if (esPM) h += 12
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  }

  // 24h: '14:30', '14:30:00', '9:05'
  const m24 = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (m24) {
    const h = Number(m24[1])
    const min = Number(m24[2])
    if (h > 23 || min > 59) return ''
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  }

  return ''
}

// Para mostrar en tablas/listas.
export function formatHora(v, vacio = '—') {
  return toHora(v) || vacio
}

// Minutos desde medianoche, para ordenar. Los viajes sin hora van al final del
// día (no al principio): si no se sabe cuándo sale, no encabeza la agenda.
export function horaOrden(v) {
  const h = toHora(v)
  if (!h) return 24 * 60 + 1
  return Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))
}
