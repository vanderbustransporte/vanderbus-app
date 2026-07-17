// Helpers de formularios de edición. Ambos existen por el mismo bug real:
// un <select> cuyo valor actual no está entre las <option> cae en la PRIMERA,
// y al guardar pisa el dato en silencio (editar un viaje con tipo legacy
// 'Mudanza' lo convertía en 'Excursión' sin que nadie lo tocara).

// Mantiene el valor actual como opción aunque no esté en la lista canónica
// (valores legacy: tipos viejos, conceptos renombrados, etc.).
export const conValorActual = (opciones, actual) =>
  actual && !opciones.includes(actual) ? [actual, ...opciones] : opciones

// Vehículos elegibles para un select: los activos, MÁS el asignado si está
// archivado (activo: false). Sin esto, editar un registro con un vehículo ya
// archivado lo desvinculaba solo (el select caía en "Sin asignar").
export function vehiculosSeleccionables(todos, asignadoId) {
  const activos = (todos || []).filter(v => v.activo !== false)
  const asignado = (todos || []).find(v => v.id === asignadoId)
  return asignado && asignado.activo === false ? [asignado, ...activos] : activos
}
