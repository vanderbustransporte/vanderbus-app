// Clases de vehículo y coeficientes del estimador de consumo.
//
// ⚠️ TODOS LOS NÚMEROS DE ESTE ARCHIVO SON DE REFERENCIA.
//
// Son órdenes de magnitud habituales del mercado argentino, no mediciones ni
// fichas verificadas. Sirven para tres cosas: (1) tener un punto de partida
// cuando la unidad no tiene ficha cargada, (2) validar que un valor extraído de
// un PDF no sea un disparate, y (3) descartar outliers del historial de cargas.
// Lo que el usuario carga en la ficha SIEMPRE gana. La UI los muestra rotulados
// como referencia: un coeficiente inventado presentado como dato es peor que no
// tener coeficiente.
//
// El rango va de auto particular a tractor con semi a propósito: el estimador
// tiene que servir para toda la flota, no sólo para los pesados.

// ── Clases ──────────────────────────────────────────────────────────────────
//
// `s` = fracción del consumo que depende de la MASA (rodadura + inercia). El
// resto (aerodinámica, auxiliares, ralentí) no cambia por llevar carga. Baja con
// el tamaño porque a 90 km/h en un semi manda el aire, no el peso: un furgón que
// duplica su masa gasta ~30% más en ruta, un semi que la TRIPLICA (15 t → 45 t)
// gasta sólo ~40% más. De ahí (1−s)+s·3 = 1.40 → s ≈ 0.20 para el tractor.
//
// `l100` = rango plausible de consumo VACÍO. Se usa para validar extracciones de
// PDF y para descartar intervalos absurdos del historial (una carga parcial mal
// declarada da un L/100km ridículo y no puede envenenar el promedio).
//
// `ralenti` = litros/hora con el motor detenido, orientativo por clase.
// `taraTip` = tara típica, sólo para deducir la clase cuando no está declarada.
export const CLASES = {
  auto: {
    label: 'Auto',
    hint: 'Auto particular o utilitario chico',
    s: { urbano: 0.60, ruta: 0.45 },
    l100: [3, 22],
    ralenti: 0.6,
    taraTip: 1300,
  },
  pickup: {
    label: 'Pickup',
    hint: 'Hilux, Ranger, Amarok, S10…',
    s: { urbano: 0.55, ruta: 0.45 },
    l100: [6, 22],
    ralenti: 0.8,
    taraTip: 2100,
  },
  furgon: {
    label: 'Furgón / utilitario',
    hint: 'Master, Sprinter, Ducato, Daily…',
    s: { urbano: 0.55, ruta: 0.45 },
    l100: [7, 26],
    ralenti: 0.9,
    taraTip: 2200,
  },
  chasis_liviano: {
    label: 'Chasis liviano',
    hint: 'Camión hasta ~9 t de PBT',
    s: { urbano: 0.50, ruta: 0.38 },
    l100: [10, 32],
    ralenti: 1.5,
    taraTip: 4000,
  },
  chasis_mediano: {
    label: 'Chasis mediano',
    hint: 'Camión de ~9 a ~17 t de PBT',
    s: { urbano: 0.45, ruta: 0.32 },
    l100: [14, 42],
    ralenti: 2.0,
    taraTip: 6800,
  },
  camion_pesado: {
    label: 'Camión pesado',
    hint: 'Chasis pesado o balancín, sin semi',
    s: { urbano: 0.42, ruta: 0.26 },
    l100: [18, 55],
    ralenti: 2.8,
    taraTip: 11000,
  },
  tractor_semi: {
    label: 'Tractor + semi',
    hint: 'El conjunto completo: es lo que rueda',
    s: { urbano: 0.38, ruta: 0.20 },
    l100: [20, 75],
    ralenti: 3.2,
    taraTip: 15000,
  },
}

export const CLASE_IDS = Object.keys(CLASES)

export const claseInfo = id => CLASES[id] || null

// Clase deducida de la tara, para las fichas que no la declaran. Es GRUESA a
// propósito y está documentado que lo es: la tara no distingue un auto de una
// pickup ni un furgón de una pickup con cúpula. La clase declarada siempre gana;
// esto sólo evita que el cálculo se quede sin coeficientes.
export function claseDesdeTara(taraKg) {
  if (taraKg == null) return 'furgon'
  if (taraKg <  1900) return 'auto'
  if (taraKg <  2800) return 'furgon'
  if (taraKg <  5000) return 'chasis_liviano'
  if (taraKg <  9000) return 'chasis_mediano'
  if (taraKg < 14000) return 'camion_pesado'
  return 'tractor_semi'
}

// ── Fuente del consumo declarado ────────────────────────────────────────────
//
// Acá está el punto delicado de toda la ficha. Un consumo homologado y un
// benchmark de flota NO valen lo mismo y no pueden mostrarse con la misma
// autoridad:
//
//  - Los livianos (auto, pickup, furgón chico) tienen homologación publicada.
//    Es un dato real, pero es OPTIMISTA: en uso urbano argentino el consumo
//    efectivo está entre 10% y 25% por encima. Por eso el factor > 1.
//  - Los pesados no tienen homologación de L/100km publicada. Lo que haya en la
//    ficha vino de un benchmark de flota o de lo que declara el transportista:
//    ya es un número "de la vida real", así que no se corrige.
//
// El factor se aplica al consumo de la ficha y SIEMPRE se declara en los
// supuestos del estimado.
export const FUENTES_CONSUMO = {
  homologado: {
    label: 'Homologado (ciclo oficial)',
    factor: 1.18,
    nota: 'El ciclo oficial es optimista: en uso real se consume entre 10% y 25% más. Se corrige un 18%.',
    confiable: true,
  },
  fabricante: {
    label: 'Declarado por el fabricante',
    factor: 1.10,
    nota: 'Valor de folleto o ficha comercial, medido en condiciones favorables. Se corrige un 10%.',
    confiable: true,
  },
  benchmark_flota: {
    label: 'Benchmark de flota / experiencia',
    factor: 1.00,
    nota: 'Valor de referencia de flotas parecidas, no una medición de esta unidad. No es un dato de fábrica.',
    confiable: false,
  },
  estimado_clase: {
    label: 'Estimado por clase (referencia)',
    factor: 1.00,
    nota: 'Valor de referencia por tipo de unidad. Es el más flojo de todos: conviene reemplazarlo por el de la ficha real.',
    confiable: false,
  },
}

export const FUENTE_DEFAULT = 'estimado_clase'
export const fuenteInfo = id => FUENTES_CONSUMO[id] || FUENTES_CONSUMO[FUENTE_DEFAULT]

// ── Carrocería ──────────────────────────────────────────────────────────────
//
// NO entra por masa: entra como factor multiplicativo y SÓLO sobre el tramo de
// ruta. Un furgón cerrado y un playo vacío pesan lo mismo y no consumen lo
// mismo, pero la diferencia es aerodinámica y por debajo de ~70 km/h es ruido.
// Los factores son relativos a una carrocería CON LONA (la más común en carga
// general) y son deliberadamente chicos: es un ajuste, no una medición.
export const CARROCERIAS = {
  n_a:             { label: 'Sin declarar / no aplica', factor: 1.00 },
  playo:           { label: 'Playo (plataforma)',        factor: 0.97 },
  con_lona:        { label: 'Con lona / sider',          factor: 1.00 },
  furgon_cerrado:  { label: 'Furgón cerrado',            factor: 1.03 },
  tanque:          { label: 'Tanque / cisterna',         factor: 1.00 },
  portacontenedor: { label: 'Portacontenedor',           factor: 1.05 },
  volcador:        { label: 'Volcador',                  factor: 1.02 },
}

export const carroceriaInfo = id => CARROCERIAS[id] || CARROCERIAS.n_a

// ── Topografía del recorrido ────────────────────────────────────────────────
// Factor sobre el consumo del viaje entero. En llano el motor no compensa nada;
// en montaña lo que se gana bajando no alcanza a devolver lo que costó subir.
export const TOPOGRAFIAS = {
  llano:    { label: 'Llano',    factor: 1.00 },
  ondulado: { label: 'Ondulado', factor: 1.06 },
  montana:  { label: 'Montaña',  factor: 1.15 },
}

export const TOPOGRAFIA_DEFAULT = 'llano'
export const topografiaInfo = id => TOPOGRAFIAS[id] || TOPOGRAFIAS[TOPOGRAFIA_DEFAULT]

// ── Otros catálogos de la ficha (sólo etiquetas) ────────────────────────────
export const COMBUSTIBLES_MOTOR = [
  { id: 'diesel',  label: 'Diesel / gasoil' },
  { id: 'nafta',   label: 'Nafta' },
  { id: 'gnc',     label: 'GNC' },
  { id: 'hibrido', label: 'Híbrido' },
]

export const TRANSMISIONES = [
  { id: 'manual',       label: 'Manual' },
  { id: 'automatica',   label: 'Automática' },
  { id: 'automatizada', label: 'Automatizada' },
]

export const NORMAS_EMISION = ['Euro II', 'Euro III', 'Euro IV', 'Euro V', 'Euro VI']

// Ralentí estimado cuando la ficha no lo trae. La cilindrada afina el valor de
// clase (un 2.0 y un 3.0 del mismo porte no queman lo mismo parados), pero es
// una interpolación de referencia y se declara como estimada en la UI.
export function ralentiEstimado(claseId, cilindradaL) {
  const base = (CLASES[claseId] || CLASES.furgon).ralenti
  const cil = Number(cilindradaL)
  if (!Number.isFinite(cil) || cil <= 0) return base
  const cilTip = claseId === 'auto' ? 1.6
    : claseId === 'pickup' || claseId === 'furgon' ? 2.5
    : claseId === 'chasis_liviano' ? 4.0
    : claseId === 'chasis_mediano' ? 6.0
    : claseId === 'camion_pesado' ? 9.0
    : 12.0
  // Escala suave: media entre el valor de clase y el proporcional a cilindrada,
  // acotada para que un dato mal cargado no dispare el número.
  const escalado = base * (cil / cilTip)
  const mezcla = (base + escalado) / 2
  return Math.min(Math.max(mezcla, base * 0.5), base * 1.8)
}
