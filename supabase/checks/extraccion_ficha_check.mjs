// Check de la extracción de ficha técnica (Edge Function extraer-ficha-tecnica).
//
// Prueba la lógica PURA de la función —qué páginas se mandan al modelo y qué
// valores se aceptan al volver— con documentos sintéticos, sin desplegar nada,
// sin tocar Supabase y sin gastar una llamada a la API.
//
// Lo que NO cubre (y no puede, sin desplegar): que el modelo respete el
// "devolvé null si no está". Eso se verifica a mano contra un PDF real después
// del deploy — y es justamente por eso que existen el filtro por rango de acá y
// la confirmación humana en pantalla.
//
// Correr:  node --experimental-strip-types supabase/checks/extraccion_ficha_check.mjs

import {
  elegirPaginas, armarFragmentos, validar,
  MAX_PAGINAS, MAX_CHARS_TOTAL,
} from '../functions/extraer-ficha-tecnica/logica.ts'

let fallos = 0
const ok = (cond, nombre, detalle = '') => {
  console.log(`${cond ? '  OK  ' : ' FALLA'} ${nombre}${detalle ? ` — ${detalle}` : ''}`)
  if (!cond) fallos++
}
const titulo = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 60 - t.length))}`)

// ── Documentos sintéticos ───────────────────────────────────────────────────

const paginaProsa = (n) =>
  `Capítulo ${n}. Antes de conducir el vehículo, ajuste el asiento y los espejos. ` +
  'Verifique que todos los ocupantes lleven el cinturón de seguridad abrochado. ' +
  'El sistema de frenos requiere una revisión periódica según el plan de mantenimiento.'

const paginaSpecs = `ESPECIFICACIONES TÉCNICAS

Motor
  Cilindrada .................. 2.3 L
  Potencia máxima ............. 130 CV a 3500 rpm
  Par motor ................... 320 Nm
  Norma de emisión ............ Euro V
  Transmisión ................. Manual de 6 velocidades

Consumo de combustible (ciclo homologado)
  Urbano ...................... 11,5 L/100km
  Ruta ........................ 9,5 L/100km
  Mixto ....................... 10,3 L/100km

Pesos y dimensiones
  Tara ........................ 2150 kg
  Carga útil .................. 1550 kg
  PBT ......................... 3700 kg
  Capacidad del depósito ...... 80 L`

// 1) Ficha técnica: 40 páginas de las cuales 3 son specs.
const PDF_CON_DATOS = Array.from({ length: 40 }, (_, i) =>
  (i === 12 || i === 13 || i === 27) ? paginaSpecs : paginaProsa(i + 1))

// 2) Manual de operador: 300 páginas, ninguna de especificaciones.
const PDF_SIN_DATOS = Array.from({ length: 300 }, (_, i) => paginaProsa(i + 1))

// 3) Manual enorme: 600 páginas y 200 de ellas mencionan specs.
const PDF_ENORME = Array.from({ length: 600 }, (_, i) =>
  i % 3 === 0 ? paginaSpecs + '\n' + paginaProsa(i) : paginaProsa(i + 1))

// 4) Escaneo sin OCR: páginas vacías o con basura de dos caracteres.
const PDF_ESCANEADO = Array.from({ length: 120 }, () => '  \n \f ')

// ── 1. Selección de páginas ─────────────────────────────────────────────────
titulo('Qué páginas se mandan al modelo')

const conDatos = elegirPaginas(PDF_CON_DATOS)
ok(conDatos.length === 3, 'Ficha técnica: encuentra las 3 páginas de specs',
   `páginas ${conDatos.map(p => p.pagina).join(', ')} de ${PDF_CON_DATOS.length}`)
ok(conDatos.every(p => [13, 14, 28].includes(p.pagina)), 'Y son exactamente las correctas')
ok(conDatos[0].pagina < conDatos[1].pagina, 'Vuelven en orden de lectura')

const sinDatos = elegirPaginas(PDF_SIN_DATOS)
ok(sinDatos.length === 0, 'Manual de operador (300 pág.): no manda NADA al modelo',
   'sin páginas de specs → la función corta antes de llamar a la API')

const escaneado = elegirPaginas(PDF_ESCANEADO)
ok(escaneado.length === 0, 'Escaneo sin texto: no manda nada')

const enorme = elegirPaginas(PDF_ENORME)
ok(enorme.length === MAX_PAGINAS, `PDF de 600 páginas: se topea en ${MAX_PAGINAS} páginas`,
   `candidatas: 200`)

// ── 2. Tope de tamaño de lo que se manda ────────────────────────────────────
titulo('Cuánto texto se manda')

for (const [nombre, doc] of [['ficha técnica', PDF_CON_DATOS], ['manual enorme', PDF_ENORME]]) {
  const frags = armarFragmentos(elegirPaginas(doc))
  const chars = frags.reduce((s, f) => s + f.length, 0)
  ok(chars <= MAX_CHARS_TOTAL + 200, `${nombre}: ${chars.toLocaleString('es-AR')} caracteres`,
     `tope ${MAX_CHARS_TOTAL.toLocaleString('es-AR')}`)
}
const fragsEnorme = armarFragmentos(elegirPaginas(PDF_ENORME))
ok(fragsEnorme.every(f => f.startsWith('--- PÁGINA ')),
   'Cada fragmento va rotulado con su página (para que el modelo pueda citarla)')

// ── 3. Validación de lo que devuelve el modelo ──────────────────────────────
titulo('Validación por rango de lo extraído')

// Respuesta "buena" para un furgón.
const buena = {
  consumo_urbano_l100: { valor: 11.5, unidad: 'L/100km', pagina: 13, confianza: 'alta', cita: 'Urbano 11,5' },
  consumo_ruta_l100:   { valor: 9.5,  unidad: 'L/100km', pagina: 13, confianza: 'alta', cita: 'Ruta 9,5' },
  tara_kg:             { valor: 2150, unidad: 'kg', pagina: 13, confianza: 'alta', cita: 'Tara 2150 kg' },
  carga_max_kg:        { valor: 1550, unidad: 'kg', pagina: 13, confianza: 'alta', cita: 'Carga útil 1550' },
  norma_emision:       { valor: 'Euro V', pagina: 13, confianza: 'alta', cita: 'Euro V' },
  consumo_mixto_l100: null,
  consumo_ralenti_lh: null,
  pbt_kg: null, tanque_l: null,
  motor_cilindrada_l: null, motor_potencia_cv: null, motor_torque_nm: null,
  transmision: null, relacion_diferencial: null,
}
const r1 = validar(buena, 'furgon')
ok(Object.keys(r1.campos).length === 5, 'Pasan los 5 campos con dato', `descartados: ${r1.descartados.length}`)
ok(r1.descartados.length === 0, 'Ninguno descartado')
ok(!('consumo_mixto_l100' in r1.campos), 'Los null NO entran como campos (null es respuesta válida)')

// Respuesta con datos inventados / mal leídos.
const mala = {
  // 4.2 L/100km en un furgón es imposible (rango 7–26): típico de leer mal una
  // tabla o de completar con conocimiento general.
  consumo_urbano_l100: { valor: 4.2, unidad: 'L/100km', pagina: 88, confianza: 'media', cita: '4,2' },
  // Tara de un semi metida en la ficha de un furgón.
  tara_kg:             { valor: 44000, unidad: 'kg', pagina: 90, confianza: 'baja', cita: '44000' },
  // Cilindrada absurda (rango 0.8–16).
  motor_cilindrada_l:  { valor: 230, unidad: 'cc', pagina: 91, confianza: 'baja', cita: '230' },
  // Un valor no numérico donde se espera número.
  tanque_l:            { valor: 'ochenta', unidad: 'L', pagina: 92, confianza: 'baja', cita: 'ochenta' },
  // Este sí es plausible y tiene que pasar.
  consumo_ruta_l100:   { valor: 9.5, unidad: 'L/100km', pagina: 13, confianza: 'alta', cita: '9,5' },
}
const r2 = validar(mala, 'furgon')
ok(Object.keys(r2.campos).length === 1 && 'consumo_ruta_l100' in r2.campos,
   'Sólo sobrevive el valor plausible', `descartados: ${r2.descartados.map(d => d.campo).join(', ')}`)
ok(r2.descartados.length === 4, 'Los 4 disparates se descartan con motivo')
ok(r2.descartados.every(d => d.motivo && d.pagina), 'Cada descarte dice por qué y en qué página')

// El rango depende de la clase: 30 L/100km es absurdo en un furgón y normal en un semi.
const treinta = { consumo_ruta_l100: { valor: 30, unidad: 'L/100km', pagina: 5, confianza: 'alta', cita: '30' } }
ok(validar(treinta, 'furgon').descartados.length === 1, '30 L/100km se descarta en un furgón')
ok(Object.keys(validar(treinta, 'tractor_semi').campos).length === 1, 'Y se acepta en un tractor con semi')
ok(Object.keys(validar(treinta, null).campos).length === 1,
   'Sin clase declarada se usa el rango general (más permisivo)')

// Un texto vacío no es un dato.
const vacio = { transmision: { valor: '   ', pagina: 3, confianza: 'baja', cita: '' } }
ok(Object.keys(validar(vacio, 'furgon').campos).length === 0, 'Un campo de texto vacío no pasa')

console.log(`\n${fallos === 0 ? 'TODO OK' : `${fallos} FALLA(S)`}\n`)
process.exit(fallos === 0 ? 0 : 1)
