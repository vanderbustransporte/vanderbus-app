import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { pathDe } from '../routes'

// Navegación por id de módulo ('viajes', 'mantenimiento'…), que es el token que
// ya usaban `notificaciones.link` y los atajos del Dashboard. Los llamadores
// siguen sin conocer las URLs: si mañana cambia un path, se cambia en routes.jsx
// y nadie más se entera.
//
// `state` (opcional) viaja en el history entry, no en la URL. Lo usa la command
// palette para llegar a un módulo con la búsqueda ya aplicada ({ q: 'Pérez' });
// el módulo destino lo lee de useLocation().state.
export function useNav() {
  const navigate = useNavigate()
  return useCallback((id, state) => navigate(pathDe(id), state !== undefined ? { state } : undefined), [navigate])
}
