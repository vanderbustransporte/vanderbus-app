import { useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'

// Cuánto dura el resaltado. Un poco más que la animación .row-flash (2.4s) para
// que la clase no se saque a mitad del fade.
const DURACION_FLASH = 2600

// Consume el deep link a un registro (/#/viajes/:registroId) en los módulos con
// `detalle: true` en routes.jsx. Devuelve el id a resaltar (o null), que se pasa
// a <Table highlightId={...}> o se compara a mano en grillas de tarjetas.
//
//   const destacadoId = useRegistroDestacado(list, {
//     listo: !loading,                                   // esperar al store
//     onEncontrado: () => { setSearch(''); setFiltro('') } // que la fila sea visible
//   })
//
// Detalles que importan:
// - Se consume UNA vez por navegación (location.key), no por registroId: elegir
//   el mismo registro de nuevo en la palette re-resalta, pero el refresco de 30s
//   del store no re-dispara nada.
// - Si el registro todavía no está (store cargando) espera al próximo render;
//   si no existe (link viejo, fila borrada) no hace nada: quedás en el módulo,
//   que es el mismo fallback que ya tienen los links de módulo desconocido.
// - `onEncontrado` corre antes de resaltar, para limpiar filtros/búsqueda que
//   dejarían la fila fuera de la lista. No va en las dependencias a propósito:
//   los módulos lo pasan inline y el guard de location.key ya evita re-corridas.
export function useRegistroDestacado(lista, { listo = true, onEncontrado } = {}) {
  const { registroId } = useParams()
  const location = useLocation()
  const [destacadoId, setDestacadoId] = useState(null)
  const consumido = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!registroId || !listo) return
    if (consumido.current === location.key) return
    const registro = (lista || []).find(r => r.id === registroId)
    if (!registro) return
    consumido.current = location.key
    onEncontrado?.(registro)
    setDestacadoId(registroId)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDestacadoId(null), DURACION_FLASH)
  }, [registroId, location.key, listo, lista])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return destacadoId
}
