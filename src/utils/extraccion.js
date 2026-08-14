// Extracción asistida de la ficha técnica desde el PDF del fabricante.
//
// El trabajo pesado lo hace la Edge Function `extraer-ficha-tecnica`: indexa el
// PDF, ubica las páginas de especificaciones, manda SOLO esas al modelo y valida
// los valores contra rangos plausibles por clase. Acá sólo se la invoca y se
// normaliza lo que devuelve.
//
// ── Lo que este módulo NO hace ──────────────────────────────────────────────
//
// No guarda nada. Ningún dato extraído entra al cálculo sin que una persona lo
// acepte: la UI muestra cada campo como PROPUESTA, con la página de origen y la
// cita a la vista, y el usuario acepta o corrige uno por uno. Un consumo
// inventado se ve idéntico a uno medido; el único filtro que sirve de verdad es
// que alguien lo mire.

import { supabase } from '../lib/supabase'

// Etiqueta legible de cada campo, para la pantalla de revisión.
export const ETIQUETA_CAMPO = {
  consumo_urbano_l100:  'Consumo urbano (L/100km)',
  consumo_ruta_l100:    'Consumo en ruta (L/100km)',
  consumo_mixto_l100:   'Consumo mixto (L/100km)',
  consumo_ralenti_lh:   'Consumo en ralentí (L/h)',
  tara_kg:              'Tara (kg)',
  carga_max_kg:         'Carga útil máxima (kg)',
  pbt_kg:               'PBT (kg)',
  tanque_l:             'Capacidad del tanque (L)',
  motor_cilindrada_l:   'Cilindrada (L)',
  motor_potencia_cv:    'Potencia (CV)',
  motor_torque_nm:      'Torque (Nm)',
  norma_emision:        'Norma de emisión',
  transmision:          'Transmisión',
  relacion_diferencial: 'Relación de diferencial',
}

export const CONFIANZA_COLOR = {
  alta:  'var(--positive)',
  media: 'var(--warning)',
  baja:  'var(--danger)',
}

// Invoca la función. Devuelve { propuestas, descartados, paginas, aviso, error }.
// `clase` viaja para que la validación por rango sea la de esa clase de unidad.
export async function extraerFicha({ docId, clase }) {
  const { data, error } = await supabase.functions.invoke('extraer-ficha-tecnica', {
    body: { doc_id: docId, clase: clase || null },
  })

  if (error) {
    // El cuerpo del error de una Edge Function viene en la respuesta, no en el
    // mensaje: sin esto el usuario ve siempre "Edge Function returned a non-2xx".
    let detalle = error.message
    try {
      const cuerpo = await error.context?.json?.()
      if (cuerpo?.error) detalle = cuerpo.error
    } catch { /* el cuerpo no era JSON: queda el mensaje genérico */ }
    return { error: detalle || 'No se pudo leer el documento.' }
  }
  if (data?.error) return { error: data.error }

  const campos = data?.campos || {}
  const propuestas = Object.entries(campos)
    .filter(([k]) => ETIQUETA_CAMPO[k])
    .map(([campo, v]) => ({
      campo,
      etiqueta: ETIQUETA_CAMPO[campo],
      valor: v.valor,
      unidad: v.unidad || '',
      pagina: v.pagina,
      confianza: v.confianza || 'baja',
      cita: v.cita || '',
    }))

  return {
    propuestas,
    descartados: data?.descartados || [],
    paginas: data?.paginas_leidas || [],
    totalPaginas: data?.total_paginas || null,
    aviso: data?.aviso || null,
  }
}

// Los valores aceptados, en el formato de la ficha (todo string: así viven las
// columnas). Se aplican al FORM, no a la base: el usuario todavía tiene que
// guardar el vehículo.
export function aplicarPropuestas(propuestas, aceptados) {
  const patch = {}
  for (const p of propuestas) {
    if (!aceptados.has(p.campo)) continue
    patch[p.campo] = String(p.valor)
  }
  return patch
}
