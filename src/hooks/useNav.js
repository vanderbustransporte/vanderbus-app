import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { pathDe, rutaDe } from '../routes'

// Navegación por id de módulo ('viajes', 'mantenimiento'…), que es el token que
// ya usaban `notificaciones.link` y los atajos del Dashboard. Los llamadores
// siguen sin conocer las URLs: si mañana cambia un path, se cambia en routes.jsx
// y nadie más se entera.
//
// Deep link a un registro, dos formas equivalentes:
//   nav('viajes', { registro: 'abc123' })  → /viajes/abc123
//   nav('vehiculo:uuid')                   → /vehiculo/uuid
// La segunda es el formato que persiste `notificaciones.link` (las filas viejas
// con 'vehiculo' a secas siguen llegando al módulo). El registro sólo se agrega
// si la ruta declara `detalle: true`; si no, se cae al módulo y listo.
//
// El resto de `state` (opcional) viaja en el history entry, no en la URL. Lo usa
// quien quiera llegar con una búsqueda ya aplicada ({ q: 'Pérez' }); el módulo
// destino lo lee de useLocation().state.
export function useNav() {
  const navigate = useNavigate()
  return useCallback((id, state) => {
    const [mod, registroDelLink] = String(id ?? '').split(':')
    const { registro = registroDelLink, ...resto } = state || {}
    const base = pathDe(mod)
    const to = registro && rutaDe(mod)?.detalle ? `${base}/${registro}` : base
    navigate(to, Object.keys(resto).length ? { state: resto } : undefined)
  }, [navigate])
}
