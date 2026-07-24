// Lógica pura de la extracción: qué páginas del PDF se mandan al modelo y qué
// valores se aceptan al volver. Vive aparte de index.ts para poder probarse sin
// desplegar la función ni gastar una llamada a la API
// (supabase/checks/extraccion_ficha_check.mjs la corre con datos sintéticos).
//
// Sin imports a propósito: se ejecuta igual en Deno (la función) que en Node
// con --experimental-strip-types (el check).

// ── Localización de las páginas de especificaciones ─────────────────────────
//
// Los términos fuertes titulan la sección que buscamos; los débiles aparecen
// sueltos en cualquier lado y sólo desempatan. En un manual de operador esto
// encuentra poco y nada — y está bien: es exactamente el caso en el que el
// resultado tiene que ser todo null.
export const CLAVES_FUERTES = [
  'especificaciones tecnicas', 'especificaciones técnicas', 'datos tecnicos', 'datos técnicos',
  'ficha tecnica', 'ficha técnica', 'technical specifications', 'specifications',
  'pesos y dimensiones', 'weights and dimensions', 'capacidades', 'capacities',
]

export const CLAVES_DEBILES = [
  'consumo', 'l/100', 'litros/100', 'fuel consumption', 'combustible',
  'tara', 'pbt', 'peso bruto', 'carga util', 'carga útil', 'payload',
  'cilindrada', 'displacement', 'potencia', 'par motor', 'torque',
  'deposito', 'depósito', 'tanque', 'tank', 'norma euro', 'euro v', 'euro vi',
  'relacion', 'relación', 'diferencial', 'caja de cambios', 'transmision', 'transmisión',
]

export const MAX_PAGINAS = 12
export const MAX_CHARS_PAGINA = 3500
export const MAX_CHARS_TOTAL = 60000

export const sinTildes = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

export function puntuar(texto: string): number {
  const t = sinTildes(texto)
  let p = 0
  for (const k of CLAVES_FUERTES) if (t.includes(sinTildes(k))) p += 10
  for (const k of CLAVES_DEBILES) if (t.includes(sinTildes(k))) p += 2
  // Una tabla de specs tiene muchos números; un párrafo de prosa no.
  const digitos = (t.match(/\d/g) || []).length
  if (digitos > 80) p += 3
  return p
}

export type PaginaElegida = { pagina: number; texto: string; puntaje: number }

// Las mejores MAX_PAGINAS páginas, devueltas en orden de lectura. Una página sin
// texto (escaneo sin OCR) o sin ninguna palabra clave no entra: mandarla sería
// pagar tokens por ruido.
export function elegirPaginas(paginas: string[]): PaginaElegida[] {
  return paginas
    .map((texto, i) => ({ pagina: i + 1, texto: texto || '', puntaje: puntuar(texto || '') }))
    .filter(p => p.texto.trim().length > 40 && p.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, MAX_PAGINAS)
    .sort((a, b) => a.pagina - b.pagina)
}

// Recorta cada página y corta el total: un tope duro sobre lo que se manda.
export function armarFragmentos(elegidas: PaginaElegida[]): string[] {
  let acumulado = 0
  const fragmentos: string[] = []
  for (const p of elegidas) {
    const recorte = p.texto.slice(0, MAX_CHARS_PAGINA)
    if (acumulado + recorte.length > MAX_CHARS_TOTAL) break
    acumulado += recorte.length
    fragmentos.push(`--- PÁGINA ${p.pagina} ---\n${recorte}`)
  }
  return fragmentos
}

// ── Rangos plausibles ───────────────────────────────────────────────────────
//
// Espejo (a propósito, del lado del server) de src/data/clases.js. Un valor
// fuera de rango NO se devuelve como dato: va a `descartados` con el motivo y la
// UI lo muestra como algo a revisar a mano. Es preferible no proponer nada a
// proponer un disparate con cara de dato.
export const L100_POR_CLASE: Record<string, [number, number]> = {
  auto: [3, 22],
  pickup: [6, 22],
  furgon: [7, 26],
  chasis_liviano: [10, 32],
  chasis_mediano: [14, 42],
  camion_pesado: [18, 55],
  tractor_semi: [20, 75],
}
export const RANGO_L100_GENERAL: [number, number] = [3, 75]

export const RANGOS: Record<string, [number, number]> = {
  tara_kg: [600, 25000],
  carga_max_kg: [200, 45000],
  pbt_kg: [1000, 60000],
  tanque_l: [20, 1500],
  motor_cilindrada_l: [0.8, 16],
  motor_potencia_cv: [40, 800],
  motor_torque_nm: [80, 3600],
  consumo_ralenti_lh: [0.2, 8],
}

export const CAMPOS_CONSUMO = ['consumo_urbano_l100', 'consumo_ruta_l100', 'consumo_mixto_l100']
export const CAMPOS_TEXTO = ['norma_emision', 'transmision', 'relacion_diferencial']

export type Descartado = { campo: string; valor: unknown; motivo: string; pagina?: number }

// Último filtro antes de que un número le llegue a una persona como propuesta.
// `null` pasa de largo: es una respuesta válida y esperada, no un error.
export function validar(crudo: Record<string, unknown>, clase?: string | null) {
  const rangoConsumo = (clase && L100_POR_CLASE[clase]) || RANGO_L100_GENERAL
  const campos: Record<string, unknown> = {}
  const descartados: Descartado[] = []

  for (const [campo, valor] of Object.entries(crudo || {})) {
    if (valor == null) continue
    const v = valor as Record<string, unknown>

    if (CAMPOS_TEXTO.includes(campo)) {
      if (typeof v.valor === 'string' && v.valor.trim()) campos[campo] = v
      continue
    }

    const n = Number(v.valor)
    if (!Number.isFinite(n)) {
      descartados.push({ campo, valor: v.valor, motivo: 'No es un número', pagina: v.pagina as number })
      continue
    }
    const [min, max] = CAMPOS_CONSUMO.includes(campo)
      ? rangoConsumo
      : (RANGOS[campo] ?? [-Infinity, Infinity])
    if (n < min || n > max) {
      descartados.push({
        campo, valor: n, pagina: v.pagina as number,
        motivo: `Fuera del rango plausible (${min}–${max}) para esta clase de unidad`,
      })
      continue
    }
    campos[campo] = { ...v, valor: n }
  }

  return { campos, descartados }
}
