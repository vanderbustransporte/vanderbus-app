// Registro de features togglables por organización (Fase 2, punto 9).
//
// El valor efectivo sale de organizations.features (jsonb, solo lo edita un
// superadmin desde el panel Empresas) con estos defaults cuando la org no
// tiene el flag seteado.
//
// Criterio de los defaults: nace apagado todo lo que una empresa de transporte
// no usa el primer día. Un módulo visible y vacío para siempre se lee como
// "la app está rota", no como "esto no lo uso". El GPS ya nacía apagado
// (necesita un tracker en el vehículo); Marketing se sumó por lo mismo.
// Prenderlos es un click del superadmin en el panel Empresas.
export const FEATURES = [
  {
    id: 'seguimiento',
    label: 'Seguimiento GPS',
    descripcion: 'Mapa en vivo de la flota (requiere tracker en el vehículo)',
    porDefecto: false,
  },
  {
    id: 'marketing',
    label: 'Marketing',
    descripcion: 'Campañas y presupuesto de difusión',
    porDefecto: false,
  },
]

export const FEATURE_DEFAULTS = Object.fromEntries(FEATURES.map(f => [f.id, f.porDefecto]))

// El mapa página → feature vive ahora en el registro de rutas (src/routes.jsx,
// campo `feature`), junto al resto de la definición del módulo. Este archivo
// queda como la definición de los flags en sí (los edita el superadmin).

export function featureEfectiva(features, id) {
  const v = features?.[id]
  return typeof v === 'boolean' ? v : (FEATURE_DEFAULTS[id] ?? true)
}
