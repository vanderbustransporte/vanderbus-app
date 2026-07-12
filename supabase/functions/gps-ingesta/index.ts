// Edge Function: gps-ingesta
//
// Ingesta de pings GPS autenticada por dispositivo (Fase 2, último ítem).
// Reemplaza el POST anónimo del GPSLogger a /rest/v1/ubicaciones_gps que quedó
// bloqueado por RLS en Fase 0 (migración 20260710120100, opción "a").
//
// Flujo:
//   1. El tracker manda el token en el header `x-device-token` (o query ?token=).
//   2. Se busca su sha256 en dispositivos_gps; si no existe o está inactivo → 401.
//   3. El ping se inserta con service_role, con la organization_id del
//      dispositivo y `dispositivo` = alias de la tabla (el body NO puede
//      hacerse pasar por otro tracker).
//
// Config del GPSLogger (Custom URL):
//   URL:     https://<proyecto>.supabase.co/functions/v1/gps-ingesta
//   Método:  POST  ·  Header: x-device-token: <token>
//   Body JSON: { "lat": %LAT, "lon": %LON, "velocidad": <km/h>,
//                "precision_m": %ACC, "bateria": %BATT, "capturado_en": "%TIME" }
//   (mismo contrato que el POST viejo a /rest/v1; `dispositivo` ya no hace falta)
//
// Deploy: dashboard → Edge Functions → "gps-ingesta" → pegar este archivo y
// APAGAR "Verify JWT with legacy secret" (el tracker no manda JWT). O con CLI:
//   supabase functions deploy gps-ingesta --no-verify-jwt --project-ref <ref>

import { createClient } from 'npm:@supabase/supabase-js@2'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

async function sha256Hex(texto: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' })

  try {
    const url = new URL(req.url)
    const token = req.headers.get('x-device-token') ?? url.searchParams.get('token')
    if (!token) return json(401, { error: 'Falta el token de dispositivo' })

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    const { data: disp, error: eDisp } = await admin
      .from('dispositivos_gps')
      .select('id, organization_id, alias, activo')
      .eq('token_hash', await sha256Hex(token))
      .maybeSingle()
    if (eDisp) return json(500, { error: eDisp.message })
    if (!disp || !disp.activo) return json(401, { error: 'Dispositivo desconocido o inactivo' })

    // Body JSON o query params (GPSLogger puede mandar cualquiera de los dos).
    let body: Record<string, unknown> = {}
    try { body = await req.json() } catch { /* sin body: se leen query params */ }
    const campo = (k: string) => body[k] ?? url.searchParams.get(k) ?? null

    const lat = num(campo('lat'))
    const lon = num(campo('lon'))
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return json(400, { error: 'lat/lon inválidos' })
    }

    const capturadoEn = campo('capturado_en')
    const ping = {
      organization_id: disp.organization_id,
      dispositivo:     disp.alias,
      lat,
      lon,
      velocidad:    num(campo('velocidad')),
      precision_m:  num(campo('precision_m')),
      bateria:      num(campo('bateria')),
      capturado_en:
        typeof capturadoEn === 'string' && !Number.isNaN(Date.parse(capturadoEn))
          ? capturadoEn
          : new Date().toISOString(),
    }

    const { error: eIns } = await admin.from('ubicaciones_gps').insert(ping)
    if (eIns) return json(500, { error: eIns.message })

    // Última señal del dispositivo (best-effort, no bloquea la respuesta).
    await admin.from('dispositivos_gps').update({ ultimo_ping: new Date().toISOString() }).eq('id', disp.id)

    return json(201, { ok: true })
  } catch (e) {
    return json(500, { error: `Error inesperado: ${e instanceof Error ? e.message : String(e)}` })
  }
})
