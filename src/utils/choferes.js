// Choferes como entidad (Fase C del plan de producto): legajo con datos de
// contacto y vencimientos (licencia, habilitación LNH/CNRT, psicofísico).
//
// La tabla `choferes` la crea la migración 20260718130000. Hasta que se
// aplique, `choferesDisponible()` devuelve false: el módulo muestra el aviso
// de migración pendiente y nadie intenta escribir en una tabla inexistente.

import { supabase } from '../lib/supabase'

// Campos de vencimiento del legajo. Los consume el módulo Choferes (badges)
// y chequeoVencimientos (notificaciones tipo 'vencimiento', ya permitido por
// el CHECK de notificaciones.tipo — no hace falta migrar el CHECK).
export const CAMPOS_VENC_CHOFER = [
  { campo: 'licencia_venc',     label: 'Licencia de conducir' },
  { campo: 'habilitacion_venc', label: 'Habilitación (LNH/CNRT)' },
  { campo: 'psicofisico_venc',  label: 'Psicofísico' },
]

export const nombreChofer = (c) => c?.nombre || c?.dni || 'Chofer'

// ¿Existe la tabla choferes? Promesa cacheada a nivel módulo. 42P01 = tabla
// inexistente → false definitivo. Otros errores (red, sesión) no son
// concluyentes: false SIN cachear, para reintentar en el próximo montaje.
let _check = null
export function choferesDisponible() {
  if (!_check) {
    _check = supabase.from('choferes').select('id').limit(1).then(({ error }) => {
      if (!error) return true
      if (error.code === '42P01') return false
      _check = null
      return false
    })
  }
  return _check
}
