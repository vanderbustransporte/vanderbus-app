// src/utils/notifDestino.js
//
// Traduce `notificaciones.link` en un destino MOSTRABLE: a dónde lleva el click
// y con qué palabras se anuncia. Antes esto vivía a medias en Notificaciones.jsx
// (una función accionLabel con dos ifs por módulo) y no existía en el panel de la
// campana: la fila era clickeable pero no decía a dónde iba, y si el usuario no
// tenía permiso sobre el módulo el click terminaba en "Sin acceso".
//
// Formato del link (lo escribe crearNotificacion / chequeoVencimientos):
//   'vehiculo'            → módulo a secas (filas viejas)
//   'vehiculo:<uuid>'     → deep link a la fila/tarjeta exacta (routes con detalle)
//
// Devuelve null cuando no hay a dónde ir: sin link, módulo inexistente (link
// viejo de un módulo que ya no está) o el usuario no tiene acceso a ese módulo.
// Quien renderiza usa ese null para no ofrecer una acción que no va a funcionar.

import { rutaDe, puedeAcceder } from '../routes'

// Verbo del botón según el tipo de notificación. Lo importante es que el usuario
// sepa qué va a pasar ANTES de hacer click: "Completar" (falta cargar un dato)
// no es lo mismo que "Ver".
function verboDe(tipo, hayRegistro) {
  if (tipo === 'accion') return 'Completar'
  if (tipo === 'vencimiento' || tipo === 'mantenimiento') return hayRegistro ? 'Revisar' : 'Ver'
  return hayRegistro ? 'Abrir' : 'Ver'
}

export function destinoDe(notif, auth) {
  const link = notif?.link
  if (!link) return null

  const [mod, registro] = String(link).split(':')
  const ruta = rutaDe(mod)
  if (!ruta) return null
  if (!puedeAcceder(ruta, auth)) return null

  // El deep link a un registro sólo existe si la ruta lo declara (detalle: true);
  // si no, el click cae en el módulo y listo (useNav aplica la misma regla).
  const hayRegistro = Boolean(registro) && Boolean(ruta.detalle)

  return {
    link,                       // lo que se le pasa a nav()
    modulo: ruta.label,         // 'Flota', 'Mantenimiento', 'Choferes'…
    Icon: ruta.icon,
    verbo: verboDe(notif.tipo, hayRegistro),
    // Texto completo del botón: "Revisar en Flota".
    etiqueta: `${verboDe(notif.tipo, hayRegistro)} en ${ruta.label}`,
  }
}
