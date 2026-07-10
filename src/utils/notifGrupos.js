// src/utils/notifGrupos.js
//
// Agrupación de notificaciones por severidad, compartida entre el panel de la
// campana (NotifCenter) y la página dedicada (Notificaciones). Mantener acá la
// única fuente de verdad del orden y los colores por tier.

export const SEVERIDADES = [
  { key: 'accion',      label: 'Acción requerida', color: 'var(--danger)',  tipos: ['accion'] },
  { key: 'vencimiento', label: 'Vencimientos',     color: 'var(--warning)', tipos: ['vencimiento', 'mantenimiento'] },
  { key: 'otras',       label: 'Otras',            color: 'var(--text-2)',  tipos: null }, // null = cae todo lo demás
]

// Devuelve el tier de severidad de un tipo de notificación.
export function severidadDe(tipo) {
  return SEVERIDADES.find(s => s.tipos?.includes(tipo)) ?? SEVERIDADES[SEVERIDADES.length - 1]
}

// Agrupa una lista de notificaciones en los tiers de severidad, en orden.
// Devuelve solo los grupos con ítems. Dentro de cada grupo respeta el orden de
// entrada (se asume ya ordenado por created_at desc).
export function agruparPorSeveridad(notifs) {
  return SEVERIDADES
    .map(sev => ({
      ...sev,
      items: notifs.filter(n =>
        sev.tipos ? sev.tipos.includes(n.tipo) : !SEVERIDADES.some(s => s.tipos?.includes(n.tipo))
      ),
    }))
    .filter(g => g.items.length > 0)
}
