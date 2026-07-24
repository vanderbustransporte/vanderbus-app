// Estimador de consumo de combustible de un viaje.
//
// Pregunta que responde: "este viaje, con esta unidad y esta carga, ¿cuántos
// litros me va a costar?". Se contesta ANTES de salir, con datos que ya están
// cargados en el sistema: las specs de la unidad (ficha de flota), el peso de la
// carga (datos de despacho del viaje) y el precio del litro de la última carga
// real de combustible.
//
// Las columnas viven en `vehiculos` y `viajes` (migración 20260724120000).
// Hasta que esa migración se aplique, `consumoDisponible()` devuelve false y los
// módulos NO mandan estos campos al guardar: un INSERT/UPDATE con una columna
// inexistente falla ENTERO en Postgres (mismo patrón que despacho.js y vales.js).
//
// ── El modelo ───────────────────────────────────────────────────────────────
//
// Es deliberadamente simple y explícito. Prefiere quedarse corto y DECIR qué no
// está modelando antes que inventar precisión:
//
//   L/100km = base(tipoRuta) × factorCarga
//   factorCarga = (1 − s) + s × (tara + peso) / tara
//
// `base` es el consumo con la unidad vacía, interpolado entre el valor urbano y
// el de ruta según el tipo de recorrido. `s` es la fracción del consumo que
// depende de la masa (rodadura + inercia); el resto (aerodinámica, auxiliares,
// ralentí) no cambia por llevar carga. Con peso 0 el factor da 1 y el estimado
// es el consumo en vacío, como corresponde.
//
// `s` baja a medida que la unidad es más pesada: en un semi a 90 km/h manda la
// aerodinámica, así que sumar toneladas pesa relativamente menos que en un
// furgón. Por eso SENSIBILIDAD está partida por clase y no es una constante.
//
// ── Lo que este modelo NO hace ──────────────────────────────────────────────
//
// - **Volumen.** En un furgón cerrado el volumen de la carga no cambia el
//   consumo: la sección frontal es la misma vaya lleno o vacío. Se calcula y se
//   muestra como APROVECHAMIENTO (cuánto del espacio útil se usa), que es lo que
//   de verdad informa, y no entra en la fórmula. El día que la ficha diga el
//   tipo de carrocería (playo, con lona, portacontenedor) ahí sí tiene sentido
//   un término aerodinámico — hoy sería un número inventado.
// - Altimetría, viento, temperatura, tipo de caja, relación de diferencial,
//   presión de neumáticos, estilo de manejo, ralentí en carga y descarga.
//
// Todo lo anterior es exactamente el motivo por el que `consumoRealVehiculo()`
// existe: el historial de cargas de combustible ya trae ese ruido incorporado.
// Cuando hay historial suficiente, el estimador lo muestra al lado del teórico
// para que el número de manual no se lea como si fuera la verdad.

import { supabase } from '../lib/supabase'
import { toISO } from './fecha'

export const RUTA_TIPOS = ['Urbano', 'Mixto', 'Ruta']

export const CAMPOS_CONSUMO_VEHICULO = [
  'motor_desc', 'consumo_urbano_l100', 'consumo_ruta_l100', 'tara_kg', 'carga_max_kg',
]
export const CAMPOS_CONSUMO_VIAJE = ['distancia_km', 'ruta_tipo']

export const emptyConsumoVehiculo = () => Object.fromEntries(CAMPOS_CONSUMO_VEHICULO.map(k => [k, '']))

// ── Detección de esquema ────────────────────────────────────────────────────
// Se consulta UNA vez por sesión (promesa cacheada a nivel módulo). Las dos
// tablas se chequean juntas porque las columnas vienen en la misma migración:
// si una está y la otra no, no alcanza para prender la función. 42703 = columna
// inexistente → false definitivo. Cualquier otro error (red, sesión) no es
// concluyente: devuelve false SIN cachear, para reintentar en el próximo montaje.
let _check = null
export function consumoDisponible() {
  if (!_check) {
    const sonda = (tabla, columna) =>
      supabase.from(tabla).select(columna).limit(1).then(({ error }) => {
        if (!error) return true
        if (error.code === '42703') return false
        return null   // no concluyente
      })
    _check = Promise.all([sonda('vehiculos', 'consumo_ruta_l100'), sonda('viajes', 'distancia_km')])
      .then(res => {
        if (res.some(r => r === null)) { _check = null; return false }
        return res.every(Boolean)
      })
      .catch(() => { _check = null; return false })
  }
  return _check
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// Los montos y medidas viven como string en la base (legado). Un '' o un null
// tienen que dar null y no 0: "sin dato" y "cero kilos" no son lo mismo, y un 0
// silencioso haría que el estimador conteste con una confianza que no tiene.
export function num(x) {
  if (x === null || x === undefined || x === '') return null
  const n = parseFloat(x)
  return Number.isFinite(n) ? n : null
}

// Clase por tara, y no una columna nueva: la tara ya separa perfectamente los
// tres grupos y es un dato que el usuario carga igual para el cálculo.
export function claseDe(taraKg) {
  if (taraKg == null) return 'liviano'
  if (taraKg < 3500)  return 'liviano'   // furgones, pickups
  if (taraKg < 12000) return 'mediano'   // camiones livianos y medianos
  return 'pesado'                        // tractores con semi
}

// Fracción del consumo que depende de la masa, por clase y tipo de recorrido.
//
// Calibrado contra el salto vacío→cargado que se observa en cada clase, no
// elegido a ojo. Un furgón que duplica su masa gasta ~30% más en ruta; un semi
// que TRIPLICA la suya (15 t de tara a 45 t) gasta sólo ~40% más, porque a 90
// km/h el que manda es el aire y ese no se entera de la carga. De ahí que `s`
// baje tan fuerte con el tamaño: (1−s)+s·3 = 1.40 → s ≈ 0.20 para el pesado.
const SENSIBILIDAD = {
  liviano: { urbano: 0.55, ruta: 0.45 },
  mediano: { urbano: 0.45, ruta: 0.32 },
  pesado:  { urbano: 0.38, ruta: 0.20 },
}

// Peso del componente urbano en la mezcla: 1 = todo ciudad, 0 = todo ruta.
const MEZCLA = { Urbano: 1, Mixto: 0.5, Ruta: 0 }
const mezclaDe = t => MEZCLA[t] ?? MEZCLA.Mixto

// Si sólo se cargó uno de los dos consumos, el otro se deriva con esta relación
// (el ciclo urbano gasta ~25% más que el de ruta). Es un supuesto y el estimador
// lo declara en `supuestos`.
const RATIO_URBANO_RUTA = 1.25

// ── Specs de la unidad ──────────────────────────────────────────────────────
//
// `l100Real` (opcional) es el promedio del historial de cargas: se usa como base
// SÓLO si la ficha no tiene specs cargadas. Es peor dato para separar vacío de
// cargado (el promedio ya trae carga adentro) pero es infinitamente mejor que
// no poder estimar nada, y `fuente` deja claro de dónde salió el número.
export function specsVehiculo(vehiculo, { l100Real = null } = {}) {
  const v = vehiculo || {}
  const supuestos = []

  let urbano = num(v.consumo_urbano_l100)
  let ruta   = num(v.consumo_ruta_l100)
  let fuente = 'ficha'

  if (urbano == null && ruta == null) {
    if (l100Real == null) return { ok: false, fuente: 'ninguna', supuestos }
    // El histórico es un promedio de todo tipo de recorrido: se toma como el
    // punto medio y se abre hacia los extremos con la misma relación de arriba.
    const medio = l100Real
    ruta   = medio / ((1 + RATIO_URBANO_RUTA) / 2)
    urbano = ruta * RATIO_URBANO_RUTA
    fuente = 'historico'
    supuestos.push('Sin specs en la ficha: se usa el consumo real promedio del historial de cargas.')
  } else if (urbano == null) {
    urbano = ruta * RATIO_URBANO_RUTA
    supuestos.push('Falta el consumo urbano en la ficha: se estimó un 25% sobre el de ruta.')
  } else if (ruta == null) {
    ruta = urbano / RATIO_URBANO_RUTA
    supuestos.push('Falta el consumo en ruta en la ficha: se estimó un 25% por debajo del urbano.')
  }

  const tara = num(v.tara_kg)
  // `capacidad` es texto libre viejo de la ficha ("2000 kg"): sirve de fallback,
  // parseFloat se queda con el número del principio.
  const cargaMax = num(v.carga_max_kg) ?? num(v.capacidad)

  return { ok: true, urbano, ruta, tara, cargaMax, clase: claseDe(tara), fuente, supuestos }
}

// ── El cálculo ──────────────────────────────────────────────────────────────
//
// Devuelve SIEMPRE un objeto: `faltan` dice qué datos hacen falta para que haya
// un número, y `supuestos` qué se dio por sentado para el número que hay. La UI
// muestra las dos listas — un estimado sin sus supuestos a la vista es una
// mentira prolija.
export function estimarConsumo({
  vehiculo, distanciaKm, pesoKg, volumenM3, rutaTipo,
  precioLitro = null, l100Real = null,
} = {}) {
  const dist   = num(distanciaKm)
  const peso   = num(pesoKg)
  const volumen = num(volumenM3)
  const specs  = specsVehiculo(vehiculo, { l100Real })
  const supuestos = [...(specs.supuestos || [])]
  const faltan = []

  if (!specs.ok) faltan.push('el consumo de la unidad (ficha de flota)')
  if (dist == null || dist <= 0) faltan.push('la distancia del viaje')

  if (faltan.length) return { ok: false, faltan, supuestos, specs }

  const w    = mezclaDe(rutaTipo)
  const sens = SENSIBILIDAD[specs.clase]
  const base = specs.ruta + w * (specs.urbano - specs.ruta)
  const s    = sens.ruta + w * (sens.urbano - sens.ruta)

  let factorCarga = 1
  let masaTotal = specs.tara
  if (peso != null && peso > 0) {
    if (specs.tara != null && specs.tara > 0) {
      masaTotal   = specs.tara + peso
      factorCarga = (1 - s) + s * (masaTotal / specs.tara)
    } else {
      supuestos.push('Falta la tara de la unidad: el peso de la carga no se pudo aplicar al cálculo.')
    }
  } else {
    supuestos.push('Sin peso de carga cargado: el estimado es el de la unidad vacía.')
  }

  const l100   = base * factorCarga
  const litros = l100 * dist / 100
  const precio = num(precioLitro)
  const costo  = precio != null ? litros * precio : null

  // El volumen no entra en la fórmula (ver cabecera): sólo informa cuánto del
  // espacio útil se está usando frente a cuánto del peso útil.
  const aprovPeso = (peso != null && specs.cargaMax) ? peso / specs.cargaMax : null

  return {
    ok: true,
    faltan: [],
    supuestos,
    specs,
    l100, litros, costo, precioLitro: precio,
    base, factorCarga, masaTotal, mezclaUrbana: w,
    sobrepeso: aprovPeso != null && aprovPeso > 1,
    aprovechamiento: { peso: aprovPeso, volumen },
    // El extra que le cuesta la carga a este viaje, que es lo que se cotiza.
    litrosVacio: base * dist / 100,
    litrosPorCarga: litros - base * dist / 100,
  }
}

// ── Contraste con la realidad ───────────────────────────────────────────────
//
// Consumo real de una unidad a partir del historial de cargas: entre dos cargas
// consecutivas, litros / km recorridos. Se ordena por ODÓMETRO y no por fecha —
// las fechas de esta base vienen en formatos mezclados y hay filas cargadas
// fuera de orden; el km es monótono y no miente.
//
// Sólo cuenta si la carga es a tanque lleno, cosa que la app no registra: por
// eso se descartan los intervalos con consumos absurdos (una carga parcial da un
// L/100km ridículamente bajo y la siguiente uno altísimo) en vez de promediarlos
// como si fueran válidos.
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
