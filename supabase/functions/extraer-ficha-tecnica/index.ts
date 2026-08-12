// Edge Function: extraer-ficha-tecnica
//
// Lee el PDF de la ficha técnica / manual de una unidad (subido a
// `vehiculo-docs`, migración 20260724140000) y PROPONE valores para la ficha de
// consumo del vehículo. La propuesta la revisa una persona: nada de lo que sale
// de acá entra al cálculo sin que alguien lo acepte en pantalla.
//
// ── Por qué no se manda el PDF entero ───────────────────────────────────────
//
// Un manual de camión son 300 a 600 páginas: cientos de miles de tokens por
// consulta, la mayoría irrelevante. El flujo es:
//
//   1. Extraer el texto PÁGINA POR PÁGINA (unpdf, en el server).
//   2. Puntuar cada página por palabras clave de especificaciones y quedarse
//      con las mejores (MAX_PAGINAS), recortadas a MAX_CHARS_PAGINA.
//   3. Mandar SOLO ese subconjunto al modelo, con la página de origen marcada.
//   4. Validar cada número contra rangos plausibles por clase ANTES de devolverlo.
//
// ── La regla que no se negocia ──────────────────────────────────────────────
//
// `null` es una respuesta válida y esperada. Si el dato no está en el
// documento, el campo va en null. El modelo NO infiere, NO promedia y NO
// completa con conocimiento general: un consumo inventado se ve exactamente
// igual que uno real y es el peor resultado posible de todo este feature. Está
// dicho en el system prompt, en la descripción de cada campo del esquema, y
// además se valida por rango al volver.
//
// ── Seguridad ───────────────────────────────────────────────────────────────
//
// Corre con service_role (solo en los servidores de Supabase). Antes de tocar
// nada verifica que quien llama tenga sesión y que el documento pertenezca a SU
// organización: sin ese chequeo, un usuario podría leer el PDF de otra empresa
// pasando un id ajeno (la service_role saltea RLS por definición).
//
// Secreto necesario: ANTHROPIC_API_KEY
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref <ref>
//
// Deploy:
//   supabase functions deploy extraer-ficha-tecnica --project-ref <ref>
//
// Invocación desde el frontend (src/utils/extraccion.js):
//   supabase.functions.invoke('extraer-ficha-tecnica', { body: { doc_id } })
//   → { campos: {...}, paginas_leidas: [...], descartados: [...] }

import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.68.0'
import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1'
// Qué páginas se mandan y qué valores se aceptan al volver. Vive aparte para
// poder probarse sin desplegar ni gastar una llamada a la API
// (supabase/checks/extraccion_ficha_check.mjs).
import {
  elegirPaginas, armarFragmentos, validar,
  CAMPOS_CONSUMO, CAMPOS_TEXTO,
} from './logica.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })


// Esquema de salida. Cada campo numérico devuelve el valor, la unidad tal como
// figura, la página y la confianza — la página es lo que le permite al usuario
// verificar en el visor sin buscar a ciegas.
const campoNumerico = (desc: string) => ({
  type: ['object', 'null'],
  description: desc + ' Devolvé null si el documento no lo dice explícitamente.',
  properties: {
    valor: { type: 'number' },
    unidad: { type: 'string', description: 'La unidad tal como figura en el documento.' },
    pagina: { type: 'integer', description: 'Número de página donde figura.' },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    cita: { type: 'string', description: 'Fragmento textual corto del documento donde aparece.' },
  },
  required: ['valor', 'unidad', 'pagina', 'confianza', 'cita'],
  additionalProperties: false,
})

const campoTexto = (desc: string) => ({
  type: ['object', 'null'],
  description: desc + ' Devolvé null si el documento no lo dice explícitamente.',
  properties: {
    valor: { type: 'string' },
    pagina: { type: 'integer' },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    cita: { type: 'string' },
  },
  required: ['valor', 'pagina', 'confianza', 'cita'],
  additionalProperties: false,
})

const ESQUEMA = {
  type: 'object',
  properties: {
    consumo_urbano_l100:  campoNumerico('Consumo en ciclo urbano, en L/100km.'),
    consumo_ruta_l100:    campoNumerico('Consumo en ruta o carretera, en L/100km.'),
    consumo_mixto_l100:   campoNumerico('Consumo mixto o combinado, en L/100km.'),
    consumo_ralenti_lh:   campoNumerico('Consumo con el motor en ralentí, en litros por hora.'),
    tara_kg:              campoNumerico('Tara: peso de la unidad vacía, en kg.'),
    carga_max_kg:         campoNumerico('Carga útil máxima, en kg.'),
    pbt_kg:               campoNumerico('Peso bruto total (PBT) admitido, en kg.'),
    tanque_l:             campoNumerico('Capacidad del tanque de combustible, en litros.'),
    motor_cilindrada_l:   campoNumerico('Cilindrada del motor, en litros.'),
    motor_potencia_cv:    campoNumerico('Potencia máxima, en CV o HP.'),
    motor_torque_nm:      campoNumerico('Par motor máximo, en Nm.'),
    norma_emision:        campoTexto('Norma de emisión (ej: Euro V).'),
    transmision:          campoTexto('Tipo de transmisión: manual, automática o automatizada.'),
    relacion_diferencial: campoTexto('Relación del diferencial (ej: 3.42).'),
  },
  required: [
    ...CAMPOS_CONSUMO, 'consumo_ralenti_lh',
    'tara_kg', 'carga_max_kg', 'pbt_kg', 'tanque_l',
    'motor_cilindrada_l', 'motor_potencia_cv', 'motor_torque_nm',
    ...CAMPOS_TEXTO,
  ],
  additionalProperties: false,
}

const SYSTEM = `Extraés especificaciones técnicas de vehículos desde fragmentos de un documento del fabricante.

REGLA ABSOLUTA: sólo devolvés un valor si está EXPLÍCITAMENTE escrito en el texto que te paso.

- Si un dato no está, el campo va en null. null es una respuesta correcta y esperada; devolver muchos null no es un fracaso.
- NUNCA infieras, estimes, promedies, conviertas desde otro modelo, ni completes con lo que sepas del vehículo por tu cuenta.
- Un consumo inventado se ve igual que uno medido y es el peor resultado posible: ante la duda, null.
- El documento puede ser un manual de operador que no trae consumo. Eso es normal: devolvé null en esos campos.
- Convertí unidades sólo cuando la conversión es aritmética directa y sin supuestos (km/l a L/100km, toneladas a kg, kW a CV). Dejá en "unidad" la unidad ORIGINAL del documento.
- Si el documento da varias versiones o motorizaciones, elegí la que coincide con la unidad descripta y bajá la confianza a "media"; si no podés distinguir cuál corresponde, devolvé null.
- "pagina" es el número de página que te indico en cada fragmento. "cita" es el texto textual corto donde aparece el dato, para que una persona lo verifique.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' })

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json(500, { error: 'Falta configurar ANTHROPIC_API_KEY en la función.' })

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    // ── 1. Sesión + pertenencia del documento ─────────────────────────────────
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return json(401, { error: 'Falta el token de sesión' })

    const { data: caller, error: eCaller } = await admin.auth.getUser(jwt)
    if (eCaller || !caller?.user) return json(401, { error: 'Token inválido' })

    const { data: perfil } = await admin
      .from('profiles').select('organization_id').eq('id', caller.user.id).maybeSingle()
    const orgId = perfil?.organization_id
    if (!orgId) return json(403, { error: 'El usuario no pertenece a ninguna empresa' })

    const { doc_id, clase } = await req.json()
    if (!doc_id) return json(400, { error: 'Falta doc_id' })

    const { data: doc } = await admin
      .from('vehiculo_docs').select('*').eq('id', doc_id).maybeSingle()
    if (!doc) return json(404, { error: 'Documento inexistente' })
    // La service_role saltea RLS: este chequeo es el que impide leer el PDF de
    // otra empresa mandando un id ajeno.
    if (doc.organization_id !== orgId) return json(403, { error: 'Ese documento no es de tu empresa' })

    // ── 2. Descarga + texto por página ────────────────────────────────────────
    const { data: blob, error: eDown } = await admin.storage
      .from('vehiculo-docs').download(doc.storage_path)
    if (eDown || !blob) return json(404, { error: 'No se pudo leer el archivo del almacenamiento' })

    const bytes = new Uint8Array(await blob.arrayBuffer())
    const pdf = await getDocumentProxy(bytes)
    const { text: paginas, totalPages } = await extractText(pdf, { mergePages: false })

    // Guardar el nº de páginas para mostrarlo en la ficha.
    await admin.from('vehiculo_docs').update({ paginas: String(totalPages) }).eq('id', doc_id)

    // ── 3. Elegir las páginas de especificaciones ─────────────────────────────
    const puntuadas = elegirPaginas(paginas as string[])

    if (!puntuadas.length) {
      return json(200, {
        campos: {}, paginas_leidas: [], descartados: [], total_paginas: totalPages,
        aviso: 'No se encontraron páginas de especificaciones en el PDF. Puede ser un manual de operador ' +
               '(que no suele traer estos datos) o un escaneo sin texto seleccionable.',
      })
    }

    const fragmentos = armarFragmentos(puntuadas)

    // ── 4. Extracción ─────────────────────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey })
    const contexto = [
      doc.nombre ? `Documento: ${doc.nombre}` : null,
      clase ? `Clase de unidad declarada por el usuario: ${clase}` : null,
    ].filter(Boolean).join('\n')

    const respuesta = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: ESQUEMA } },
      messages: [{
        role: 'user',
        content: `${contexto}\n\nFragmentos del documento:\n\n${fragmentos.join('\n\n')}`,
      }],
    })

    if (respuesta.stop_reason === 'refusal') {
      return json(502, { error: 'El modelo no pudo procesar el documento.' })
    }

    const texto = respuesta.content.find((b: { type: string }) => b.type === 'text')
    let crudo: Record<string, unknown> = {}
    try {
      crudo = JSON.parse((texto as { text: string })?.text ?? '{}')
    } catch {
      return json(502, { error: 'La respuesta del modelo no se pudo interpretar. Reintentá.' })
    }

    // ── 5. Validación por rango ───────────────────────────────────────────────
    //
    // Último filtro antes de que un número le llegue a una persona como
    // propuesta. Fuera de rango = se descarta y se marca para revisión: es
    // preferible no proponer nada a proponer un disparate con cara de dato.
    const { campos, descartados } = validar(crudo, clase)

    return json(200, {
      campos,
      descartados,
      paginas_leidas: puntuadas.map(p => p.pagina),
      total_paginas: totalPages,
      uso: respuesta.usage,
    })
  } catch (e) {
    return json(500, { error: `Error inesperado: ${e instanceof Error ? e.message : String(e)}` })
  }
})
