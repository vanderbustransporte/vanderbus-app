// Cálculo de precio de un viaje a partir de las tarifas de la empresa (org_settings).
// Los valores en org_settings pueden venir como strings (legado) → parsear con parseFloat.

export function calcularTarifa(orgSettings, { horas, conPeon }) {
  const s = orgSettings || {}
  const tarifa = conPeon
    ? (parseFloat(s.tarifa_con_peon) || 0)
    : (parseFloat(s.tarifa_sin_peon) || 0)
  const minimo = parseFloat(s.minimo_horas) || 0
  const pct    = parseFloat(s.porcentaje_sena) || 0

  const horasCobrables = Math.max(parseFloat(horas) || 0, minimo)
  const total = horasCobrables * tarifa
  const sena  = total * (pct / 100)
  return { total, sena }
}

// ¿Hay al menos una tarifa cargada? (para decidir si mostrar la calculadora en Viajes)
export function tarifasConfiguradas(orgSettings) {
  const s = orgSettings || {}
  return (parseFloat(s.tarifa_sin_peon) || 0) > 0 || (parseFloat(s.tarifa_con_peon) || 0) > 0
}
