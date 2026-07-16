import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { pathDe } from '../routes'

// Navegación por id de módulo ('viajes', 'mantenimiento'…), que es el token que
// ya usaban `notificaciones.link` y los atajos del Dashboard. Los llamadores
// siguen sin conocer las URLs: si mañana cambia un path, se cambia en routes.jsx
// y nadie más se entera.
export function useNav() {
  const navigate = useNavigate()
  return useCallback((id) => navigate(pathDe(id)), [navigate])
}
