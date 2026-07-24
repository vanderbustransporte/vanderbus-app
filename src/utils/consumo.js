// Estimador de consumo de combustible de un viaje.
//
// Pregunta que responde: "este viaje, con esta unidad y esta carga, ¿cuántos
// litros me va a costar?". Se contesta ANTES de salir, con datos que ya están
// cargados en el sistema: las specs de la unidad (ficha de flota), el peso de la
// carga (datos de despacho del viaje) y el precio del litro de la última carga
// real de combustible.
//
// Las columnas viven en `vehiculos`, `viajes` y `combustible`, repartidas en dos
// migraciones:
//   20260724120000 — lo mínimo para estimar (consumo urbano/ruta, tara, carga
//                    útil, distancia, tipo de recorrido)  → consumoDisponible()
//   20260724130000 — ficha técnica extendida, factores y el flag de tanque lleno
//                                                         → fichaExtDisponible()
// Hasta que cada una se aplique, los módulos NO mandan esos campos al guardar:
// un INSERT/UPDATE con una columna inexistente falla ENTERO en Postgres (mismo
// patrón que despacho.js y vales.js). Las dos se chequean por separado a
// propósito: con la primera aplicada y la segunda no, la app tiene que seguir
// estimando igual que antes.
//
// ── El modelo ───────────────────────────────────────────────────────────────
//
// Es deliberadamente simple y explícito. Prefiere quedarse corto y DECIR qué no
// está modelando antes que inventar precisión:
//
//   L/100km = base(tipoRuta) × factorCarga × factorCarroceria × factorTopografia
//   factorCarga = (1 − s) + s × (tara + peso) / tara
//   litros = L/100km × km / 100 + ralentí(L/h) × horas de motor detenido
//
// `base` es el consumo con la unidad vacía, interpolado entre el valor urbano y
// el de ruta según el tipo de recorrido, CORREGIDO por la fuente del dato (un
// homologado es optimista; ver data/clases.js). `s` es la fracción del consumo
// que depende de la masa (rodadura + inercia); el resto (aerodinámica,
// auxiliares) no cambia por llevar carga. Con peso 0 el factor da 1 y el
// estimado es el consumo en vacío, como corresponde.
//
// `s` baja a medida que la unidad es más pesada: en un semi a 90 km/h manda la
// aerodinámica, así que sumar toneladas pesa relativamente menos que en un
// furgón. Por eso está partida por clase y no es una constante.
//
// La carrocería NO entra por masa sino como factor, y sólo sobre el tramo de
// ruta: por debajo de ~70 km/h la diferencia aerodinámica entre un playo y un
// furgón cerrado es ruido.
//
// ── Lo que este modelo NO hace ──────────────────────────────────────────────
//
// - **Volumen.** En un furgón cerrado el volumen de la carga no cambia el
//   consumo: la sección frontal es la misma vaya lleno o vacío. Se calcula y se
//   muestra como APROVECHAMIENTO (cuánto del espacio útil se usa), que es lo que
//   de verdad informa, y no entra en la fórmula.
// - Clima y viento, aire acondicionado, presión de neumáticos, estilo de
//   conducción, estado del tren rodante, retorno en vacío.
// Todo eso está listado como supuesto no modelado en `SUPUESTOS_NO_MODELADOS` y
// la UI lo muestra: un estimado sin sus límites a la vista es una mentira
// prolija.
//
// Y es exactamente el motivo por el que existe el motor de calibración
// (utils/calibracion.js): el historial de cargas a tanque lleno ya trae todo ese
// ruido incorporado. A medida que se acumulan cargas, el estimador migra del
// número teórico al medido.

import { supabase } from '../lib/supabase'
import { toISO } from './fecha'
import {
  CLASES, claseInfo, claseDesdeTara,
  fuenteInfo, FUENTE_DEFAULT,
  carroceriaInfo, topografiaInfo, TOPOGRAFIA_DEFAULT,
  ralentiEstimado,
} from '../data/clases'

export const RUTA_TIPOS = ['Urbano', 'Mixto', 'Ruta']

// ── Columnas por migración ──────────────────────────────────────────────────
// Se strippean del payload cuando la migración correspondiente no está aplicada.
export const CAMPOS_CONSUMO_VEHICULO = [
  'motor_desc', 'consumo_urbano_l100', 'consumo_ruta_l100', 'tara_kg', 'carga_max_kg',
]
export const CAMPOS_CONSUMO_VIAJE = ['distancia_km', 'ruta_tipo']

export const CAMPOS_FICHA_VEHICULO = [
  'clase',
  'motor_cilindrada_l', 'motor_potencia_cv', 'motor_torque_nm', 'motor_combustible',
  'norma_emision', 'transmision', 'relacion_diferencial',
  'consumo_mixto_l100', 'fuente_consumo',
  'pbt_kg', 'carroceria', 'tanque_l',
  'consumo_ralenti_lh', 'consumo_ralenti_est',
]
export const CAMPOS_FICHA_VIAJE = ['topografia', 'horas_ralenti']
export const CAMPOS_FICHA_COMBUSTIBLE = ['tanque_lleno']

export const emptyConsumoVehiculo = () => Object.fromEntries(CAMPOS_CONSUMO_VEHICULO.map(k => [k, '']))
export const emptyFichaVehiculo   = () => Object.fromEntries(CAMPOS_FICHA_VEHICULO.map(k => [k, '']))

export const SUPUESTOS_NO_MODELADOS = [
  'Clima, viento y temperatura',
  'Aire acondicionado y equipos auxiliares',
  'Presión de neumáticos y estado del tren rodante',
  'Estilo de conducción del chofer',
  'Retorno en vacío (se estima sólo el tramo cargado)',
]

// ── Detección de esquema ────────────────────────────────────────────────────
// Se consulta UNA vez por sesión (promesa cacheada a nivel módulo). Las columnas
// de una misma migración se chequean juntas porque vienen juntas: si una está y
// la otra no, no alcanza para prender la función. 42703 = columna inexistente →
// false definitivo. Cualquier otro error (red, sesión) no es concluyente:
// devuelve false SIN cachear, para reintentar en el próximo montaje.
function sonda(tabla, columna) {
  return supabase.from(tabla).select(columna).limit(1).then(({ error }) => {
    if (!error) return true
    if (error.code === '42703') return false
    return null   // no concluyente
  })
}

function chequeo(pares) {
  let cache = null
  return () => {
    if (!cache) {
      cache = Promise.all(pares.map(([t, c]) => sonda(t, c)))
        .then(res => {
          if (res.some(r => r === null)) { cache = null; return false }
          return res.every(Boolean)
        })
        .catch(() => { cache = null; return false })
    }
    return cache
  }
}

// Migración 20260724120000 (estimador base).
export const consumoDisponible = chequeo([
  ['vehiculos', 'consumo_ruta_l100'],
  ['viajes', 'distancia_km'],
])

// Migración 20260724130000 (ficha extendida + calibración).
export const fichaExtDisponible = chequeo([
  ['vehiculos', 'fuente_consumo'],
  ['combustible', 'tanque_lleno'],
])

// ── Helpers ─────────────────────────────────────────────────────────────────

// Los montos y medidas viven como string en la base (legado). Un '' o un null
// tienen que dar null y no 0: "sin dato" y "cero kilos" no son lo mismo, y un 0
// silencioso haría que el estimador conteste con una confianza que no tiene.
export function num(x) {
  if (x === null || x === undefined || x === '') return null
  const n = parseFloat(x)
  return Number.isFinite(n) ? n : null
}

// Clase de la unidad: gana la declarada en la ficha; si no hay, se deduce de la
// tara (grueso, ver data/clases.js).
export function claseDe(vehiculoOTara) {
  if (vehiculoOTara && typeof vehiculoOTara === 'object') {
    const declarada = vehiculoOTara.clase
    if (declarada && CLASES[declarada]) return declarada
    return claseDesdeTara(num(vehiculoOTara.tara_kg))
  }
  return claseDesdeTara(vehiculoOTara == null ? null : Number(vehiculoOTara))
}

// Peso del componente urbano en la mezcla: 1 = todo ciudad, 0 = todo ruta.
const MEZCLA = { Urbano: 1, Mixto: 0.5, Ruta: 0 }
const mezclaDe = t => MEZCLA[t] ?? MEZCLA.Mixto

// Si sólo se cargó uno de los consumos, el otro se deriva con esta relación (el
// ciclo urbano gasta ~25% más que el de ruta). Es un supuesto y se declara.
const RATIO_URBANO_RUTA = 1.25

// Factor de carga por masa. Extraído para que la calibración pueda usar el mismo
// número al normalizar el consumo medido (utils/calibracion.js).
export function factorCarga(taraKg, pesoKg, s) {
  if (!(taraKg > 0) || !(pesoKg > 0)) return 1
  return (1 - s) + s * ((taraKg + pesoKg) / taraKg)
}

// Sensibilidad a la masa para una mezcla urbano/ruta dada.
export function sensibilidadDe(claseId, mezclaUrbana) {
  const s = (claseInfo(claseId) || CLASES.furgon).s
  return s.ruta + mezclaUrbana * (s.urbano - s.ruta)
}

// ── Specs de la unidad ──────────────────────────────────────────────────────
//
// `l100Real` (opcional) es el consumo medido del historial: se usa como base
// SÓLO si la ficha no tiene specs cargadas. Es peor dato para separar vacío de
// cargado (el promedio ya trae carga adentro) pero es infinitamente mejor que no
// poder estimar nada, y `fuente` deja claro de dónde salió el número.
export function specsVehiculo(vehiculo, { l100Real = null } = {}) {
  const v = vehiculo || {}
  const supuestos = []

  const tara = num(v.tara_kg)
  const clase = claseDe(v)
  if (!v.clase) supuestos.push(`No se declaró la clase de la unidad: se dedujo "${claseInfo(clase).label}" por la tara.`)

  let urbano = num(v.consumo_urbano_l100)
  let ruta   = num(v.consumo_ruta_l100)
  const mixto = num(v.consumo_mixto_l100)
  let fuente = 'ficha'
  let fuenteDato = v.fuente_consumo || FUENTE_DEFAULT
  const info = fuenteInfo(fuenteDato)

  if (urbano == null && ruta == null && mixto != null) {
    // Sólo el mixto: se abre hacia los extremos con la relación de arriba.
    ruta   = mixto / ((1 + RATIO_URBANO_RUTA) / 2)
    urbano = ruta * RATIO_URBANO_RUTA
    supuestos.push('La ficha sólo tiene el consumo mixto: se derivaron el urbano y el de ruta a partir de él.')
  }

  if (urbano == null && ruta == null) {
    if (l100Real == null) return { ok: false, fuente: 'ninguna', clase, tara, supuestos }
    // El histórico es un promedio de todo tipo de recorrido: se toma como el
    // punto medio y se abre hacia los extremos con la misma relación.
    ruta   = l100Real / ((1 + RATIO_URBANO_RUTA) / 2)
    urbano = ruta * RATIO_URBANO_RUTA
    fuente = 'historico'
    fuenteDato = null
    supuestos.push('Sin specs en la ficha: se usa el consumo real promedio del historial de cargas.')
  } else if (urbano == null) {
    urbano = ruta * RATIO_URBANO_RUTA
    supuestos.push('Falta el consumo urbano en la ficha: se estimó un 25% sobre el de ruta.')
  } else if (ruta == null) {
    ruta = urbano / RATIO_URBANO_RUTA
    supuestos.push('Falta el consumo en ruta en la ficha: se estimó un 25% por debajo del urbano.')
  }

  // Corrección por fuente del dato. Sólo aplica a valores de ficha: el histórico
  // ya es consumo real medido y corregirlo sería contarlo dos veces.
  let factorFuente = 1
  if (fuente === 'ficha') {
    factorFuente = info.factor
    if (factorFuente !== 1) {
      urbano *= factorFuente
      ruta   *= factorFuente
      supuestos.push(`Consumo declarado como "${info.label}". ${info.nota}`)
    } else if (!info.confiable) {
      supuestos.push(`Consumo declarado como "${info.label}". ${info.nota}`)
    }
  }

  // `capacidad` es texto libre viejo de la ficha ("2000 kg"): sirve de fallback,
  // parseFloat se queda con el número del principio.
  const cargaMaxDirecta = num(v.carga_max_kg) ?? num(v.capacidad)
  const pbt = num(v.pbt_kg)
  // Si hay PBT y tara pero no carga útil, la carga útil es la resta.
  const cargaMax = cargaMaxDirecta ?? ((pbt != null && tara != null && pbt > tara) ? pbt - tara : null)
  if (cargaMaxDirecta == null && cargaMax != null) {
    supuestos.push('La carga útil se calculó como PBT menos tara.')
  }

  const carroceria = v.carroceria || 'n_a'

  const ralentiFicha = num(v.consumo_ralenti_lh)
  const ralenti = ralentiFicha ?? ralentiEstimado(clase, num(v.motor_cilindrada_l))
  const ralentiEsEstimado = ralentiFicha == null || v.consumo_ralenti_est === 'si'

  return {
    ok: true,
    urbano, ruta, tara, cargaMax, pbt,
    clase, claseLabel: claseInfo(clase).label,
    fuente, fuenteDato, fuenteLabel: fuente === 'historico' ? 'Historial de cargas' : info.label,
    factorFuente,
    carroceria, carroceriaLabel: carroceriaInfo(carroceria).label,
    ralenti, ralentiEsEstimado,
    tanqueL: num(v.tanque_l),
    supuestos,
  }
}

// Consumo teórico VACÍO para una mezcla de recorrido dada. Se expone aparte
// porque el motor de calibración (utils/calibracion.js) necesita el mismo número
// para mezclarlo con el medido, y no puede depender del resto del cálculo.
export function baseTeorica(specs, rutaTipo) {
  if (!specs?.ok) return null
  const w = mezclaDe(rutaTipo)
  return specs.ruta + w * (specs.urbano - specs.ruta)
}

// ¿La ficha de la unidad tiene lo necesario para no depender de valores de
// clase? Define el piso de la banda de confianza.
export const fichaCompleta = v => !!(
  v && (v.consumo_ruta_l100 || v.consumo_urbano_l100 || v.consumo_mixto_l100) && v.tara_kg
)

// ── Banda de confianza ──────────────────────────────────────────────────────
//
// El estimado se muestra como RANGO, no como número puntual. No es cosmética:
// si un transportista cotiza un flete con este número y le erra, es plata suya.
// La banda se angosta con lo que el sistema realmente sabe de la unidad.
export function bandaConfianza({ ficha = false, n = 0 } = {}) {
  if (n >= 15) return { pct: 0.08, nivel: `${n} cargas reales medidas` }
  if (n >= 5)  return { pct: 0.12, nivel: `${n} cargas reales medidas` }
  if (ficha)   return { pct: 0.20, nivel: n > 0 ? `ficha completa y ${n} ${n === 1 ? 'carga medida' : 'cargas medidas'}` : 'ficha completa, sin cargas reales' }
  return { pct: 0.30, nivel: 'estimado por clase, sin ficha de la unidad' }
}

// ── El cálculo ──────────────────────────────────────────────────────────────
//
// Devuelve SIEMPRE un objeto: `faltan` dice qué datos hacen falta para que haya
// un número, y `supuestos` qué se dio por sentado para el número que hay. La UI
// muestra las dos listas.
export function estimarConsumo({
  vehiculo, distanciaKm, pesoKg, volumenM3, rutaTipo,
  topografia, horasRalenti,
  precioLitro = null, l100Real = null,
  // Consumo ya calibrado contra el historial (utils/calibracion.js). Si viene,
  // reemplaza al de la ficha como base del cálculo.
  calibracion = null,
} = {}) {
  const dist    = num(distanciaKm)
  // Un peso 0 o negativo (dato mal cargado) es "sin carga", no una carga que
  // resta: si no, el aprovechamiento sale en negativo y el factor baja de 1.
  const pesoCrudo = num(pesoKg)
  const peso    = (pesoCrudo != null && pesoCrudo > 0) ? pesoCrudo : null
  const volumen = num(volumenM3)
  const horasR  = num(horasRalenti)
  const specs   = specsVehiculo(vehiculo, { l100Real })
  const supuestos = [...(specs.supuestos || [])]
  const faltan = []

  if (!specs.ok) faltan.push('el consumo de la unidad (ficha de flota)')
  if (dist == null || dist <= 0) faltan.push('la distancia del viaje')

  if (faltan.length) return { ok: false, faltan, supuestos, specs }

  const w    = mezclaDe(rutaTipo)
  const s    = sensibilidadDe(specs.clase, w)
  const baseFicha = baseTeorica(specs, rutaTipo)

  // Base efectiva: la calibrada si la hay, la de la ficha si no.
  let base = baseFicha
  if (calibracion && calibracion.ok && calibracion.usadoBase != null) {
    base = calibracion.usadoBase
    supuestos.push(calibracion.explicacion)
  }

  const fCarga = factorCarga(specs.tara, peso, s)
  if (peso != null && !(specs.tara > 0)) {
    supuestos.push('Falta la tara de la unidad: el peso de la carga no se pudo aplicar al cálculo.')
  }
  if (peso == null) {
    supuestos.push('Sin peso de carga cargado: el estimado es el de la unidad vacía.')
  }

  // Carrocería: sólo sobre el tramo de ruta (por debajo de ~70 km/h no pesa).
  const carr = carroceriaInfo(specs.carroceria)
  const fCarroceria = 1 + (carr.factor - 1) * (1 - w)
  if (carr.factor !== 1 && fCarroceria !== 1) {
    supuestos.push(`Carrocería "${carr.label}": ${carr.factor > 1 ? '+' : ''}${Math.round((fCarroceria - 1) * 100)}% sobre el tramo de ruta (coeficiente de referencia, no medido).`)
  }

  const topo = topografiaInfo(topografia || TOPOGRAFIA_DEFAULT)
  const fTopografia = topo.factor
  if (fTopografia !== 1) {
    supuestos.push(`Topografía "${topo.label}": +${Math.round((fTopografia - 1) * 100)}% (coeficiente de referencia).`)
  }

  const l100        = base * fCarga * fCarroceria * fTopografia
  const litrosRodar = l100 * dist / 100
  const l100Vacio   = base * fCarroceria * fTopografia
  const litrosVacio = l100Vacio * dist / 100

  // Ralentí: motor en marcha con el vehículo detenido (esperas de carga y
  // descarga, frío, aduana). No escala con los km: son litros por hora.
  const litrosRalenti = (horasR > 0) ? specs.ralenti * horasR : 0
  if (litrosRalenti > 0) {
    supuestos.push(`Ralentí: ${horasR} h × ${specs.ralenti.toFixed(1)} L/h${specs.ralentiEsEstimado ? ' (consumo en ralentí estimado por clase y cilindrada, no está en la ficha)' : ''}.`)
  }

  const litros = litrosRodar + litrosRalenti
  const precio = num(precioLitro)
  const costo  = precio != null ? litros * precio : null

  // Banda de error. Se muestra SIEMPRE y a la vista, no en un tooltip.
  const banda = bandaConfianza({
    ficha: fichaCompleta(vehiculo),
    n: (calibracion && calibracion.ok) ? calibracion.n : 0,
  })
  const rango = (x) => x == null ? null : { min: x * (1 - banda.pct), max: x * (1 + banda.pct) }

  // El volumen no entra en la fórmula (ver cabecera): sólo informa cuánto del
  // espacio útil se está usando frente a cuánto del peso útil.
  const aprovPeso = (peso != null && specs.cargaMax) ? peso / specs.cargaMax : null

  return {
    ok: true,
    faltan: [],
    supuestos,
    specs,
    l100, litros, costo, precioLitro: precio,
    banda,
    rangoLitros: rango(litros),
    rangoCosto: rango(costo),
    rangoL100: rango(l100),
    base, baseFicha, factorCarga: fCarga, fCarroceria, fTopografia,
    calibracion,
    masaTotal: (specs.tara || 0) + (peso || 0),
    pesoKg: peso,
    mezclaUrbana: w,
    litrosRodar, litrosRalenti, horasRalenti: horasR,
    sobrepeso: aprovPeso != null && aprovPeso > 1,
    aprovechamiento: { peso: aprovPeso, volumen },
    // El extra que le cuesta la carga a este viaje, que es lo que se cotiza.
    litrosVacio,
    litrosPorCarga: litrosRodar - litrosVacio,
  }
}

// ── Contraste con la realidad (versión simple, sin flag de tanque lleno) ────
//
// Consumo de una unidad a partir del historial de cargas: entre dos cargas
// consecutivas, litros / km recorridos. Se ordena por ODÓMETRO y no por fecha —
// las fechas de esta base vienen en formatos mezclados y hay filas cargadas
// fuera de orden; el km es monótono y no miente.
//
// OJO: esta función NO mira `tanque_lleno` y por eso mezcla cargas parciales.
// Sigue existiendo para las bases donde la migración 20260724130000 todavía no
// está aplicada (y como respaldo cuando no hay ninguna carga declarada a tanque
// lleno). El cálculo bueno es `consumoCalibrado()` en utils/calibracion.js.
const L100_MIN = 2
const L100_MAX = 120

export function consumoRealVehiculo(combustible, vehiculoId) {
  if (!vehiculoId) return { l100: null, muestras: 0, kmCubiertos: 0 }
  const filas = (combustible || [])
    .filter(r => r.vehiculo_id === vehiculoId && num(r.km) != null && num(r.litros) != null)
    .sort((a, b) => num(a.km) - num(b.km))

  const validos = []
  let kmCubiertos = 0
  for (let i = 1; i < filas.length; i++) {
    const kmDiff = num(filas[i].km) - num(filas[i - 1].km)
    if (kmDiff <= 0) continue
    const l100 = (num(filas[i].litros) / kmDiff) * 100
    if (l100 < L100_MIN || l100 > L100_MAX) continue
    validos.push(l100)
    kmCubiertos += kmDiff
  }

  if (!validos.length) return { l100: null, muestras: 0, kmCubiertos: 0 }
  return {
    l100: validos.reduce((s, x) => s + x, 0) / validos.length,
    muestras: validos.length,
    kmCubiertos,
  }
}

// Precio del litro más reciente. Se prefiere el de la misma unidad (puede cargar
// otro combustible o en otra estación) y se cae al de la flota entera si esa
// unidad todavía no tiene cargas. `importe` y `litros` son strings en la base.
export function precioLitroReciente(combustible, vehiculoId) {
  const conPrecio = (combustible || [])
    .map(r => ({ r, precio: (num(r.importe) > 0 && num(r.litros) > 0) ? num(r.importe) / num(r.litros) : null }))
    .filter(x => x.precio != null)
    .sort((a, b) => toISO(b.r.fecha || '').localeCompare(toISO(a.r.fecha || '')))

  if (!conPrecio.length) return { precio: null, fecha: null, propio: false }
  const propio = vehiculoId ? conPrecio.find(x => x.r.vehiculo_id === vehiculoId) : null
  const elegido = propio || conPrecio[0]
  return { precio: elegido.precio, fecha: elegido.r.fecha, propio: !!propio }
}

// Formato corto para la UI: 9.5 L/100km, 42 L, 350 km.
export const fmtL100 = n => n == null ? '—' : `${n.toFixed(1)} L/100km`
export const fmtLitros = n => n == null ? '—' : `${n.toFixed(1)} L`
export const fmtKm = n => n == null ? '—' : `${Math.round(n).toLocaleString('es-AR')} km`
export const fmtPct = n => n == null ? '—' : `${Math.round(n * 100)}%`
// Rango: "38 – 46 L". Se usa para la banda de error del estimado.
export const fmtRangoL = (a, b) => (a == null || b == null) ? '—' : `${a.toFixed(1)} – ${b.toFixed(1)} L`
