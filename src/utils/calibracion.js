// Motor de calibración progresiva del consumo por unidad.
//
// La idea de fondo: el consumo del manual es una SEMILLA, no la verdad. Sirve
// para poder estimar el día uno, cuando la unidad todavía no tiene historial.
// A medida que se acumulan cargas de combustible medibles, el estimador migra
// solo hacia el consumo REAL de esa unidad, sin que nadie toque una perilla.
//
// Por cada unidad se mantienen tres números:
//
//   teórico → el de la ficha, ya corregido por la fuente del dato
//   real    → Σ litros / Σ km × 100 sobre las últimas N cargas medibles
//   usado   → el que alimenta la estimación
//
//   w = n / (n + k)         con k = 5
//   usado = w × real + (1 − w) × teórico
//
// Con 1 carga el teórico pesa 83%; con 5 cargas están 50/50; con 20 cargas el
// real pesa 80%. Sin saltos ni umbrales: la unidad converge sola.
//
// ── Qué carga cuenta y cuál no ──────────────────────────────────────────────
//
// SOLO las de tanque lleno a tanque lleno. Es la única forma de saber cuántos
// litros entraron por los km recorridos: si la carga fue parcial, los litros que
// se cargaron no son los que se gastaron y el L/100km que sale no significa
// nada. Por eso existe `combustible.tanque_lleno` (migración 20260724130000) y
// por eso acá se ignora todo lo demás.
//
// Encima se descartan outliers: un error de tipeo en el odómetro (150000 →
// 15000) o una carga mal declarada puede envenenar el promedio de una unidad
// entera y quedarse ahí para siempre. Doble filtro:
//   1. Rango duro por clase (data/clases.js). Un semi no consume 4 L/100km.
//   2. Más de 3σ del centro, con al menos 4 muestras (con menos, la dispersión
//      no significa nada y descartar sería peor que no descartar).
//
// Ojo con el punto 2: el centro es la MEDIANA y la σ se estima por MAD, no por
// el promedio y el desvío clásicos. Motivo concreto: el outlier que estamos
// buscando entra en el cálculo de su propio umbral y lo infla — con 9 muestras,
// una medición de 7 L/100km metida entre valores de 14 se queda adentro del 3σ
// clásico porque ella misma agrandó la σ. Además la σ por MAD tiene un piso del
// 15% de la mediana: el consumo real varía de verdad entre cargas (ruta,
// chofer, clima) y un umbral demasiado ajustado descartaría mediciones buenas.
//
// ── El desvío teórico vs. real vale por sí solo ─────────────────────────────
//
// Si una unidad viene sostenidamente 20% arriba del teórico hay algo: inyectores,
// chofer, neumáticos, o combustible que se está yendo por otro lado. Por eso el
// panel muestra los TRES números y el desvío, no sólo el que usa.

import { num, factorCarga, sensibilidadDe } from './consumo'
import { claseInfo } from '../data/clases'

// Cargas que se miran hacia atrás. Una unidad cambia (cubiertas, service, ruta
// habitual): el promedio de toda la vida útil pesa menos que el de los últimos
// meses. 10 intervalos son ~2 a 6 meses de operación normal.
export const VENTANA = 10

// Constante de la transición. Con k=5 hacen falta 5 cargas para que el real
// pese lo mismo que el teórico. Más chico confía demasiado rápido en pocas
// mediciones; más grande hace que la calibración no se note nunca.
export const K = 5

const SIGMAS = 3
const MIN_PARA_SIGMA = 4
// Piso de la dispersión, como fracción de la mediana (ver comentario de arriba).
const DISPERSION_MINIMA = 0.15

const mediana = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export const esTanqueLleno = r => r?.tanque_lleno === 'si' || r?.tanque_lleno === true

// ── Intervalos medibles de una unidad ───────────────────────────────────────
//
// Se ordena por ODÓMETRO y no por fecha: las fechas de esta base vienen en
// formatos mezclados y hay filas cargadas fuera de orden; el km es monótono y no
// miente. Entre dos cargas a tanque lleno consecutivas, los litros de la SEGUNDA
// son exactamente los que se gastaron en los km del intervalo.
export function intervalosMedibles(combustible, vehiculoId, claseId) {
  if (!vehiculoId) return { intervalos: [], descartados: 0, cargasLlenas: 0 }

  const llenas = (combustible || [])
    .filter(r => r.vehiculo_id === vehiculoId && esTanqueLleno(r) &&
                 num(r.km) != null && num(r.litros) != null)
    .sort((a, b) => num(a.km) - num(b.km))

  const rango = (claseInfo(claseId) || claseInfo('furgon')).l100
  // El rango de clase es para consumo VACÍO; una unidad cargada consume más.
  // Se abre un 80% hacia arriba para no descartar mediciones legítimas a plena
  // carga, que son justamente las que más importan.
  const min = rango[0] * 0.7
  const max = rango[1] * 1.8

  const crudos = []
  let descartados = 0
  for (let i = 1; i < llenas.length; i++) {
    const kmDiff = num(llenas[i].km) - num(llenas[i - 1].km)
    if (kmDiff <= 0) continue
    const l100 = (num(llenas[i].litros) / kmDiff) * 100
    if (!Number.isFinite(l100) || l100 < min || l100 > max) { descartados++; continue }
    crudos.push({ l100, kmDiff, litros: num(llenas[i].litros), fila: llenas[i] })
  }

  // Ventana móvil: las últimas VENTANA mediciones (las de km más alto). Una
  // unidad cambia con el tiempo; el promedio de toda su vida útil informa menos
  // que el de los últimos meses.
  const ventana = crudos.slice(-VENTANA)

  // Outliers, sobre la ventana. Una sola pasada: si se itera hasta converger,
  // con pocas muestras termina descartando todo menos la mediana.
  let intervalos = ventana
  if (ventana.length >= MIN_PARA_SIGMA) {
    const centro = mediana(ventana.map(x => x.l100))
    const mad    = mediana(ventana.map(x => Math.abs(x.l100 - centro)))
    const sigma  = Math.max(1.4826 * mad, DISPERSION_MINIMA * centro)
    if (sigma > 0) {
      intervalos = ventana.filter(x => Math.abs(x.l100 - centro) <= SIGMAS * sigma)
      descartados += ventana.length - intervalos.length
    }
  }

  return {
    intervalos,
    descartados,
    cargasLlenas: llenas.length,
    // Cuántas mediciones válidas hay en TODA la historia. No es lo mismo que
    // `intervalos.length`: el valor se calcula con la ventana, pero la confianza
    // (el peso `w` y la banda de error) mira el historial completo — 40 cargas
    // consistentes dan más certeza que 10, aunque el promedio use las últimas 10.
    nTotal: crudos.length,
  }
}

// Consumo real medido: Σ litros / Σ km × 100 (ponderado por km, no promedio de
// promedios — un intervalo de 1200 km informa más que uno de 90).
export function consumoRealMedido(combustible, vehiculoId, claseId) {
  const { intervalos, descartados, cargasLlenas, nTotal } = intervalosMedibles(combustible, vehiculoId, claseId)
  if (!intervalos.length) {
    return { l100: null, n: 0, nTotal: 0, kmCubiertos: 0, litros: 0, descartados, cargasLlenas }
  }
  const km     = intervalos.reduce((s, x) => s + x.kmDiff, 0)
  const litros = intervalos.reduce((s, x) => s + x.litros, 0)
  return {
    l100: (litros / km) * 100,
    n: intervalos.length,     // las que entraron al promedio (ventana)
    nTotal,                   // las medibles de toda la historia (confianza)
    kmCubiertos: km,
    litros,
    descartados,
    cargasLlenas,
  }
}

// ── Normalización del medido a "unidad vacía" ───────────────────────────────
//
// El teórico de la ficha es el consumo VACÍO; el medido trae adentro la carga
// que la unidad llevó en esos viajes. Mezclarlos sin más contaría el peso dos
// veces: primero adentro del medido y otra vez al aplicarle el factor de carga
// del viaje que se está estimando.
//
// Para descontarlo se calcula el factor de carga PROMEDIO de los viajes de esa
// unidad (los que tienen peso declarado) y se divide. Si no hay viajes con peso
// declarado el factor es 1 y se dice en los supuestos: el medido se toma como si
// fuera en vacío, que subestima el efecto de la carga en el viaje estimado.
export function factorCargaMedio(viajes, vehiculoId, specs) {
  if (!specs?.ok || !(specs.tara > 0)) return { factor: 1, n: 0 }
  const conPeso = (viajes || [])
    .filter(v => v.vehiculo_id === vehiculoId && num(v.carga_peso_kg) > 0)
  if (!conPeso.length) return { factor: 1, n: 0 }

  const factores = conPeso.map(v => {
    const w = v.ruta_tipo === 'Urbano' ? 1 : v.ruta_tipo === 'Ruta' ? 0 : 0.5
    return factorCarga(specs.tara, num(v.carga_peso_kg), sensibilidadDe(specs.clase, w))
  })
  return { factor: factores.reduce((s, x) => s + x, 0) / factores.length, n: conPeso.length }
}

// ── La transición ───────────────────────────────────────────────────────────
//
// `teoricoBase` es el consumo vacío de la ficha para la mezcla urbano/ruta del
// viaje que se está estimando (lo calcula utils/consumo.js). `real` es el
// medido, ya normalizado a vacío.
export function calibrar({ teoricoBase, real, n, k = K }) {
  if (teoricoBase == null && real == null) return { ok: false, w: 0, n: 0 }
  if (real == null || !(n > 0)) {
    return { ok: false, w: 0, n: 0, teoricoBase, usadoBase: teoricoBase, real: null, desvio: null }
  }
  if (teoricoBase == null) {
    return { ok: true, w: 1, n, teoricoBase: null, real, usadoBase: real, desvio: null,
             explicacion: `Sin consumo en la ficha: se usa el medido de las últimas ${n} cargas a tanque lleno.` }
  }
  const w = n / (n + k)
  const usadoBase = w * real + (1 - w) * teoricoBase
  const desvio = (real - teoricoBase) / teoricoBase
  return {
    ok: true, w, n, teoricoBase, real, usadoBase, desvio,
    explicacion: `Consumo calibrado con ${n} ${n === 1 ? 'carga medible' : 'cargas medibles'} a tanque lleno: ` +
      `el medido pesa ${Math.round(w * 100)}% y la ficha ${Math.round((1 - w) * 100)}%.`,
  }
}

// ── Todo junto ──────────────────────────────────────────────────────────────
//
// Lo que consume la UI: los tres números de una unidad más el diagnóstico.
// `teoricoBase` lo pasa el llamador porque depende de la mezcla urbano/ruta del
// viaje que se está estimando; para la ficha del vehículo se puede pasar el
// consumo mixto.
export function calibracionVehiculo({ combustible, viajes, vehiculoId, specs, teoricoBase }) {
  const clase = specs?.clase || 'furgon'
  const medido = consumoRealMedido(combustible, vehiculoId, clase)
  const fc = factorCargaMedio(viajes, vehiculoId, specs)

  // Normalizar el medido a "vacío" para poder mezclarlo con el teórico.
  const realVacio = medido.l100 == null ? null : medido.l100 / fc.factor
  // El peso `w` usa el total histórico de mediciones válidas, no las de la
  // ventana: el valor se promedia sobre las últimas 10, pero la confianza en que
  // ese valor describe a la unidad crece con todo lo medido.
  const cal = calibrar({ teoricoBase, real: realVacio, n: medido.nTotal })

  const avisos = []
  if (medido.l100 != null && fc.n === 0) {
    avisos.push('El consumo medido incluye la carga que llevó la unidad, pero no hay viajes con peso declarado para descontarla: se lo toma como si fuera en vacío.')
  }
  if (medido.descartados > 0) {
    avisos.push(`Se descartaron ${medido.descartados} ${medido.descartados === 1 ? 'medición' : 'mediciones'} fuera de rango o a más de 3σ del promedio.`)
  }
  if (medido.cargasLlenas > 0 && medido.n === 0) {
    avisos.push('Hay cargas a tanque lleno pero ninguna dio un intervalo medible (falta el odómetro o los km no avanzan).')
  }

  return {
    ...cal,
    medidoBruto: medido.l100,
    realVacio,
    nVentana: medido.n,
    factorCargaMedio: fc.factor,
    viajesConPeso: fc.n,
    kmCubiertos: medido.kmCubiertos,
    descartados: medido.descartados,
    cargasLlenas: medido.cargasLlenas,
    avisos,
  }
}
