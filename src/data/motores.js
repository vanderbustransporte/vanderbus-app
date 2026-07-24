// Catálogo de motores / unidades para precargar las specs de consumo.
//
// ⚠️ LEER ANTES DE TOCAR ESTO
//
// Los valores de acá son de REFERENCIA, no son la ficha del manual de tu unidad.
// Salen de rangos habituales del mercado argentino para cada configuración y
// están redondeados: sirven para que el usuario no arranque de una pantalla en
// blanco, no para vender una precisión que no tenemos. La ficha del vehículo
// SIEMPRE gana: en cuanto alguien carga sus propios números, el catálogo no se
// vuelve a mirar (ver `fuente` en utils/consumo.js).
//
// El consumo de un camión real depende de cosas que este catálogo no sabe:
// relación de diferencial, tipo de caja, estado del tren rodante, presión de
// neumáticos, altimetría, viento, estilo de manejo, ralentí en carga/descarga.
// Por eso el estimador contrasta contra el consumo REAL del historial de
// combustible: ese número, cuando existe, vale más que cualquiera de estos.
//
// Convención de los valores:
//   urbano / ruta → L/100km con la unidad VACÍA (a tara). El peso de la carga
//                   lo suma el modelo; si acá pusiéramos el consumo cargado se
//                   contaría dos veces.
//   tara          → kg de la unidad vacía. En tractores es el conjunto
//                   (tractor + semi) típico, porque es lo que rueda.
//   cargaMax      → kg de carga útil.

export const MOTORES = [
  // ── Furgones / utilitarios ────────────────────────────────────────────────
  { id: 'master-23',   grupo: 'Furgones',  marca: 'Renault',       modelo: 'Master',        motor: '2.3 dCi (G9U/M9T)',   urbano: 11.5, ruta: 9.5,  tara: 2150, cargaMax: 1550 },
  { id: 'sprinter-21', grupo: 'Furgones',  marca: 'Mercedes-Benz', modelo: 'Sprinter 415/515', motor: '2.1 CDI',          urbano: 11.0, ruta: 9.0,  tara: 2250, cargaMax: 1600 },
  { id: 'ducato-23',   grupo: 'Furgones',  marca: 'Fiat',          modelo: 'Ducato',        motor: '2.3 MultiJet',        urbano: 11.0, ruta: 9.0,  tara: 2100, cargaMax: 1500 },
  { id: 'boxer-22',    grupo: 'Furgones',  marca: 'Peugeot',       modelo: 'Boxer',         motor: '2.2 HDi',             urbano: 11.2, ruta: 9.2,  tara: 2050, cargaMax: 1400 },
  { id: 'jumper-22',   grupo: 'Furgones',  marca: 'Citroën',       modelo: 'Jumper',        motor: '2.2 HDi',             urbano: 11.2, ruta: 9.2,  tara: 2050, cargaMax: 1400 },
  { id: 'transit-22',  grupo: 'Furgones',  marca: 'Ford',          modelo: 'Transit',       motor: '2.2 TDCi',            urbano: 11.5, ruta: 9.5,  tara: 2200, cargaMax: 1400 },
  { id: 'crafter-20',  grupo: 'Furgones',  marca: 'Volkswagen',    modelo: 'Crafter',       motor: '2.0 TDI',             urbano: 11.0, ruta: 9.0,  tara: 2200, cargaMax: 1500 },
  { id: 'daily-30',    grupo: 'Furgones',  marca: 'Iveco',         modelo: 'Daily 35S14',   motor: '3.0 F1C',             urbano: 13.0, ruta: 10.5, tara: 2500, cargaMax: 1500 },

  // ── Pickups ───────────────────────────────────────────────────────────────
  { id: 'hilux-28',    grupo: 'Pickups',   marca: 'Toyota',        modelo: 'Hilux',         motor: '2.8 GD-6',            urbano: 10.0, ruta: 8.0,  tara: 2100, cargaMax: 1000 },
  { id: 'ranger-32',   grupo: 'Pickups',   marca: 'Ford',          modelo: 'Ranger',        motor: '3.2 TDCi',            urbano: 11.2, ruta: 9.0,  tara: 2200, cargaMax: 1000 },
  { id: 'amarok-20',   grupo: 'Pickups',   marca: 'Volkswagen',    modelo: 'Amarok',        motor: '2.0 TDI',             urbano: 10.6, ruta: 8.5,  tara: 2100, cargaMax: 1000 },
  { id: 's10-28',      grupo: 'Pickups',   marca: 'Chevrolet',     modelo: 'S10',           motor: '2.8 Duramax',         urbano: 11.0, ruta: 8.8,  tara: 2100, cargaMax: 1000 },

  // ── Camiones livianos y medianos ──────────────────────────────────────────
  { id: 'accelo-1016', grupo: 'Camiones',  marca: 'Mercedes-Benz', modelo: 'Accelo 1016',   motor: '4.0 OM 924',          urbano: 19.0, ruta: 16.0, tara: 3900, cargaMax: 6000 },
  { id: 'delivery-917',grupo: 'Camiones',  marca: 'Volkswagen',    modelo: 'Delivery 9.170', motor: '4.8 Cummins ISF',    urbano: 19.0, ruta: 16.0, tara: 4200, cargaMax: 5000 },
  { id: 'tector-170',  grupo: 'Camiones',  marca: 'Iveco',         modelo: 'Tector 170E28',  motor: '5.9 NEF',            urbano: 22.5, ruta: 19.0, tara: 6500, cargaMax: 10000 },
  { id: 'atego-1725',  grupo: 'Camiones',  marca: 'Mercedes-Benz', modelo: 'Atego 1725',     motor: '6.4 OM 926',         urbano: 23.5, ruta: 20.0, tara: 6800, cargaMax: 10000 },
  { id: 'cargo-1723',  grupo: 'Camiones',  marca: 'Ford',          modelo: 'Cargo 1723',     motor: '5.0 Cummins ISF',    urbano: 23.0, ruta: 19.5, tara: 6600, cargaMax: 10000 },

  // ── Tractores (tara = tractor + semi) ─────────────────────────────────────
  { id: 'scania-r450', grupo: 'Tractores', marca: 'Scania',        modelo: 'R450',          motor: '13.0 DC13',           urbano: 34.0, ruta: 27.0, tara: 15000, cargaMax: 30000 },
  { id: 'actros-2045', grupo: 'Tractores', marca: 'Mercedes-Benz', modelo: 'Actros 2045',   motor: '12.8 OM 471',         urbano: 35.0, ruta: 27.5, tara: 15000, cargaMax: 30000 },
  { id: 'volvo-fh460', grupo: 'Tractores', marca: 'Volvo',         modelo: 'FH 460',        motor: '12.8 D13',            urbano: 34.0, ruta: 27.0, tara: 15000, cargaMax: 30000 },
  { id: 'stralis-460', grupo: 'Tractores', marca: 'Iveco',         modelo: 'Stralis 460',   motor: '11.1 Cursor 11',      urbano: 35.5, ruta: 28.0, tara: 15000, cargaMax: 30000 },
]

export const GRUPOS_MOTOR = ['Furgones', 'Pickups', 'Camiones', 'Tractores']

export const motorPorId = id => MOTORES.find(m => m.id === id) || null

// Etiqueta para el select: "Renault Master — 2.3 dCi (G9U/M9T)"
export const etiquetaMotor = m => `${m.marca} ${m.modelo} — ${m.motor}`

// Los campos de la ficha del vehículo que precarga una entrada del catálogo.
// Devuelve strings porque así viven las columnas (legado: todo text).
export function specsDesdeMotor(m) {
  return {
    motor_desc:          etiquetaMotor(m),
    consumo_urbano_l100: String(m.urbano),
    consumo_ruta_l100:   String(m.ruta),
    tara_kg:             String(m.tara),
    carga_max_kg:        String(m.cargaMax),
  }
}
