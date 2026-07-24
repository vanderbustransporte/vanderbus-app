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
// Por eso cada entrada precarga también `fuente_consumo`:
//   - Los livianos (autos, pickups, furgones) SÍ tienen homologación publicada,
//     así que se precargan como 'homologado' y el estimador les aplica la
//     corrección al alza correspondiente (el ciclo oficial es optimista).
//   - Los camiones y tractores NO tienen L/100km homologado publicado: acá van
//     como 'benchmark_flota', que es lo que realmente son.
// El usuario puede cambiarlo cuando carga el dato de su ficha real.
//
// El consumo de un camión real depende de cosas que este catálogo no sabe:
// relación de diferencial, tipo de caja, estado del tren rodante, presión de
// neumáticos, altimetría, viento, estilo de manejo, ralentí en carga/descarga.
// Por eso el estimador contrasta contra el consumo REAL del historial de cargas
// a tanque lleno y migra hacia él (utils/calibracion.js): ese número, cuando
// existe, vale más que cualquiera de estos.
//
// Convención de los valores:
//   urbano / ruta → L/100km con la unidad VACÍA (a tara). El peso de la carga
//                   lo suma el modelo; si acá pusiéramos el consumo cargado se
//                   contaría dos veces.
//   tara          → kg de la unidad vacía. En tractores es el conjunto
//                   (tractor + semi) típico, porque es lo que rueda.
//   cargaMax      → kg de carga útil.
//   clase         → id de data/clases.js (define sensibilidad y rangos).

export const MOTORES = [
  // ── Autos ─────────────────────────────────────────────────────────────────
  { id: 'gol-16',      grupo: 'Autos',     clase: 'auto',   marca: 'Volkswagen',    modelo: 'Gol / Voyage',   motor: '1.6 MSI',            cil: 1.6, comb: 'nafta',  urbano: 9.5,  ruta: 6.5,  tara: 1050, cargaMax: 450,  fuente: 'homologado', carroceria: 'n_a' },
  { id: 'corolla-20',  grupo: 'Autos',     clase: 'auto',   marca: 'Toyota',        modelo: 'Corolla',        motor: '2.0 Dynamic Force',  cil: 2.0, comb: 'nafta',  urbano: 9.0,  ruta: 6.0,  tara: 1330, cargaMax: 450,  fuente: 'homologado', carroceria: 'n_a' },
  { id: 'cronos-13',   grupo: 'Autos',     clase: 'auto',   marca: 'Fiat',          modelo: 'Cronos',         motor: '1.3 Firefly',        cil: 1.3, comb: 'nafta',  urbano: 8.5,  ruta: 5.8,  tara: 1100, cargaMax: 450,  fuente: 'homologado', carroceria: 'n_a' },
  { id: 'kangoo-15',   grupo: 'Autos',     clase: 'auto',   marca: 'Renault',       modelo: 'Kangoo',         motor: '1.5 dCi',            cil: 1.5, comb: 'diesel', urbano: 8.0,  ruta: 6.0,  tara: 1350, cargaMax: 650,  fuente: 'homologado', carroceria: 'furgon_cerrado' },
  { id: 'partner-16',  grupo: 'Autos',     clase: 'auto',   marca: 'Peugeot',       modelo: 'Partner',        motor: '1.6 HDi',            cil: 1.6, comb: 'diesel', urbano: 8.2,  ruta: 6.2,  tara: 1400, cargaMax: 800,  fuente: 'homologado', carroceria: 'furgon_cerrado' },

  // ── Pickups ───────────────────────────────────────────────────────────────
  { id: 'hilux-28',    grupo: 'Pickups',   clase: 'pickup', marca: 'Toyota',        modelo: 'Hilux',          motor: '2.8 GD-6',           cil: 2.8, comb: 'diesel', urbano: 10.0, ruta: 8.0,  tara: 2100, cargaMax: 1000, fuente: 'homologado', carroceria: 'playo' },
  { id: 'ranger-32',   grupo: 'Pickups',   clase: 'pickup', marca: 'Ford',          modelo: 'Ranger',         motor: '3.2 TDCi',           cil: 3.2, comb: 'diesel', urbano: 11.2, ruta: 9.0,  tara: 2200, cargaMax: 1000, fuente: 'homologado', carroceria: 'playo' },
  { id: 'amarok-20',   grupo: 'Pickups',   clase: 'pickup', marca: 'Volkswagen',    modelo: 'Amarok',         motor: '2.0 TDI',            cil: 2.0, comb: 'diesel', urbano: 10.6, ruta: 8.5,  tara: 2100, cargaMax: 1000, fuente: 'homologado', carroceria: 'playo' },
  { id: 's10-28',      grupo: 'Pickups',   clase: 'pickup', marca: 'Chevrolet',     modelo: 'S10',            motor: '2.8 Duramax',        cil: 2.8, comb: 'diesel', urbano: 11.0, ruta: 8.8,  tara: 2100, cargaMax: 1000, fuente: 'homologado', carroceria: 'playo' },

  // ── Furgones / utilitarios ────────────────────────────────────────────────
  { id: 'master-23',   grupo: 'Furgones',  clase: 'furgon', marca: 'Renault',       modelo: 'Master',         motor: '2.3 dCi (G9U/M9T)',  cil: 2.3, comb: 'diesel', urbano: 11.5, ruta: 9.5,  tara: 2150, cargaMax: 1550, fuente: 'homologado', carroceria: 'furgon_cerrado' },
  { id: 'sprinter-21', grupo: 'Furgones',  clase: 'furgon', marca: 'Mercedes-Benz', modelo: 'Sprinter 415/515', motor: '2.1 CDI',          cil: 2.1, comb: 'diesel', urbano: 11.0, ruta: 9.0,  tara: 2250, cargaMax: 1600, fuente: 'homologado', carroceria: 'furgon_cerrado' },
  { id: 'ducato-23',   grupo: 'Furgones',  clase: 'furgon', marca: 'Fiat',          modelo: 'Ducato',         motor: '2.3 MultiJet',       cil: 2.3, comb: 'diesel', urbano: 11.0, ruta: 9.0,  tara: 2100, cargaMax: 1500, fuente: 'homologado', carroceria: 'furgon_cerrado' },
  { id: 'boxer-22',    grupo: 'Furgones',  clase: 'furgon', marca: 'Peugeot',       modelo: 'Boxer',          motor: '2.2 HDi',            cil: 2.2, comb: 'diesel', urbano: 11.2, ruta: 9.2,  tara: 2050, cargaMax: 1400, fuente: 'homologado', carroceria: 'furgon_cerrado' },
  { id: 'jumper-22',   grupo: 'Furgones',  clase: 'furgon', marca: 'Citroën',       modelo: 'Jumper',         motor: '2.2 HDi',            cil: 2.2, comb: 'diesel', urbano: 11.2, ruta: 9.2,  tara: 2050, cargaMax: 1400, fuente: 'homologado', carroceria: 'furgon_cerrado' },
  { id: 'transit-22',  grupo: 'Furgones',  clase: 'furgon', marca: 'Ford',          modelo: 'Transit',        motor: '2.2 TDCi',           cil: 2.2, comb: 'diesel', urbano: 11.5, ruta: 9.5,  tara: 2200, cargaMax: 1400, fuente: 'homologado', carroceria: 'furgon_cerrado' },
  { id: 'crafter-20',  grupo: 'Furgones',  clase: 'furgon', marca: 'Volkswagen',    modelo: 'Crafter',        motor: '2.0 TDI',            cil: 2.0, comb: 'diesel', urbano: 11.0, ruta: 9.0,  tara: 2200, cargaMax: 1500, fuente: 'homologado', carroceria: 'furgon_cerrado' },
  { id: 'daily-30',    grupo: 'Furgones',  clase: 'furgon', marca: 'Iveco',         modelo: 'Daily 35S14',    motor: '3.0 F1C',            cil: 3.0, comb: 'diesel', urbano: 13.0, ruta: 10.5, tara: 2500, cargaMax: 1500, fuente: 'homologado', carroceria: 'furgon_cerrado' },

  // ── Camiones livianos y medianos ──────────────────────────────────────────
  { id: 'accelo-1016', grupo: 'Camiones',  clase: 'chasis_liviano', marca: 'Mercedes-Benz', modelo: 'Accelo 1016',    motor: '4.0 OM 924',       cil: 4.0, comb: 'diesel', urbano: 19.0, ruta: 16.0, tara: 3900, cargaMax: 6000,  fuente: 'benchmark_flota', carroceria: 'con_lona' },
  { id: 'delivery-917',grupo: 'Camiones',  clase: 'chasis_liviano', marca: 'Volkswagen',    modelo: 'Delivery 9.170', motor: '4.8 Cummins ISF',  cil: 4.8, comb: 'diesel', urbano: 19.0, ruta: 16.0, tara: 4200, cargaMax: 5000,  fuente: 'benchmark_flota', carroceria: 'con_lona' },
  { id: 'tector-170',  grupo: 'Camiones',  clase: 'chasis_mediano', marca: 'Iveco',         modelo: 'Tector 170E28',  motor: '5.9 NEF',          cil: 5.9, comb: 'diesel', urbano: 22.5, ruta: 19.0, tara: 6500, cargaMax: 10000, fuente: 'benchmark_flota', carroceria: 'con_lona' },
  { id: 'atego-1725',  grupo: 'Camiones',  clase: 'chasis_mediano', marca: 'Mercedes-Benz', modelo: 'Atego 1725',     motor: '6.4 OM 926',       cil: 6.4, comb: 'diesel', urbano: 23.5, ruta: 20.0, tara: 6800, cargaMax: 10000, fuente: 'benchmark_flota', carroceria: 'con_lona' },
  { id: 'cargo-1723',  grupo: 'Camiones',  clase: 'chasis_mediano', marca: 'Ford',          modelo: 'Cargo 1723',     motor: '5.0 Cummins ISF',  cil: 5.0, comb: 'diesel', urbano: 23.0, ruta: 19.5, tara: 6600, cargaMax: 10000, fuente: 'benchmark_flota', carroceria: 'con_lona' },
  { id: 'cargo-2429',  grupo: 'Camiones',  clase: 'camion_pesado',  marca: 'Ford',          modelo: 'Cargo 2429',     motor: '7.2 Cummins ISL',  cil: 7.2, comb: 'diesel', urbano: 28.0, ruta: 23.0, tara: 10500, cargaMax: 13000, fuente: 'benchmark_flota', carroceria: 'con_lona' },
  { id: 'atego-2430',  grupo: 'Camiones',  clase: 'camion_pesado',  marca: 'Mercedes-Benz', modelo: 'Atego 2430',     motor: '7.2 OM 926',       cil: 7.2, comb: 'diesel', urbano: 28.5, ruta: 23.5, tara: 10800, cargaMax: 13000, fuente: 'benchmark_flota', carroceria: 'con_lona' },

  // ── Tractores (tara = tractor + semi) ─────────────────────────────────────
  { id: 'scania-r450', grupo: 'Tractores', clase: 'tractor_semi', marca: 'Scania',        modelo: 'R450',         motor: '13.0 DC13',      cil: 13.0, comb: 'diesel', urbano: 34.0, ruta: 27.0, tara: 15000, cargaMax: 30000, fuente: 'benchmark_flota', carroceria: 'con_lona' },
  { id: 'actros-2045', grupo: 'Tractores', clase: 'tractor_semi', marca: 'Mercedes-Benz', modelo: 'Actros 2045',  motor: '12.8 OM 471',    cil: 12.8, comb: 'diesel', urbano: 35.0, ruta: 27.5, tara: 15000, cargaMax: 30000, fuente: 'benchmark_flota', carroceria: 'con_lona' },
  { id: 'volvo-fh460', grupo: 'Tractores', clase: 'tractor_semi', marca: 'Volvo',         modelo: 'FH 460',       motor: '12.8 D13',       cil: 12.8, comb: 'diesel', urbano: 34.0, ruta: 27.0, tara: 15000, cargaMax: 30000, fuente: 'benchmark_flota', carroceria: 'con_lona' },
  { id: 'stralis-460', grupo: 'Tractores', clase: 'tractor_semi', marca: 'Iveco',         modelo: 'Stralis 460',  motor: '11.1 Cursor 11', cil: 11.1, comb: 'diesel', urbano: 35.5, ruta: 28.0, tara: 15000, cargaMax: 30000, fuente: 'benchmark_flota', carroceria: 'con_lona' },
]

export const GRUPOS_MOTOR = ['Autos', 'Pickups', 'Furgones', 'Camiones', 'Tractores']

export const motorPorId = id => MOTORES.find(m => m.id === id) || null

// Etiqueta para el select: "Renault Master — 2.3 dCi (G9U/M9T)"
export const etiquetaMotor = m => `${m.marca} ${m.modelo} — ${m.motor}`

// Los campos de la ficha del vehículo que precarga una entrada del catálogo.
// Devuelve strings porque así viven las columnas (legado: todo text).
// `fichaExt` = ¿está aplicada la migración 20260724130000? Sin ella los campos
// extendidos no existen y no hay que meterlos en el form.
export function specsDesdeMotor(m, { fichaExt = false } = {}) {
  const base = {
    motor_desc:          etiquetaMotor(m),
    consumo_urbano_l100: String(m.urbano),
    consumo_ruta_l100:   String(m.ruta),
    tara_kg:             String(m.tara),
    carga_max_kg:        String(m.cargaMax),
  }
  if (!fichaExt) return base
  return {
    ...base,
    clase:              m.clase,
    motor_cilindrada_l: String(m.cil),
    motor_combustible:  m.comb,
    fuente_consumo:     m.fuente,
    carroceria:         m.carroceria,
    pbt_kg:             String(m.tara + m.cargaMax),
  }
}
