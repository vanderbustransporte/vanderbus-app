// Edge Function: detectar-viajes-gps
//
// Detección de viajes GPS server-side (Fase 2, último ítem). Antes corría en
// el browser de quien abría el Historial: cada visitante bajaba los pings,
// corría detectarViajes() y ESCRIBÍA en viajes_gps con dedup por
// patente|inicio — no determinístico y con carreras entre visitantes. Ahora
// corre acá, invocada por pg_cron cada 10 minutos (migración 20260712120000),
// y el frontend solo LEE viajes_gps.
//
// Idempotencia: `inicio` de un viaje = timestamp del primer ping, así que
// recomputar la misma ventana produce las mismas filas; el unique index
// (organization_id, patente, inicio) + upsert ignoreDuplicates hace que las
// repetidas no dupliquen.
//
// Ventana: se procesan los pings de las últimas VENTANA_H horas, pero solo se
// insertan viajes con inicio en las últimas INSERTAR_H. Un viaje cuyo comienzo
// quedó fuera de la ventana se recomputaría truncado (otro `inicio` → otra
// fila); el margen VENTANA_H - INSERTAR_H = 6 h lo evita para cualquier viaje
// de hasta 6 h de duración.
//
// Seguridad: exige header `x-cron-secret` == env CRON_SECRET. El secret vive
// en Vault ('gps_cron_secret', lo genera la migración) y hay que copiarlo a
// los secrets de Edge Functions como CRON_SECRET. Sin secret válido → 401.
//
// Deploy: dashboard → Edge Functions → "detectar-viajes-gps" → subir index.ts
// y detectar.ts, y APAGAR "Verify JWT with legacy secret". O con CLI:
//   supabase functions deploy detectar-viajes-gps --no-verify-jwt --project-ref <ref>

import { createClient } from 'npm:@supabase/supabase-js@2'
import { detectarViajes, type Ping } from './detectar.ts'

const VENTANA_H  = 30  // horas de pings a mirar
const INSERTAR_H = 24  // solo se insertan viajes que arrancan en estas horas

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' })

  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return json(401, { error: 'Secret de cron inválido' })
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    const desdeVentana  = new Date(Date.now() - VENTANA_H  * 3600_000).toISOString()
    const desdeInsertar = new Date(Date.now() - INSERTAR_H * 3600_000).toISOString()

    // Pings de la ventana, de TODAS las orgs (service_role no pasa por RLS).
    // paginado defensivo: PostgREST corta en ~1000 filas por default.
    const pings: {
      organization_id: string; dispositivo: string
      lat: number; lon: number; velocidad: number | null; capturado_en: string
    }[] = []
    for (let page = 0; ; page++) {
      const { data, error } = await admin
        .from('ubicaciones_gps')
        .select('organization_id, dispositivo, lat, lon, velocidad, capturado_en')
        .gte('capturado_en', desdeVentana)
        .order('capturado_en', { ascending: true })
        .range(page * 1000, page * 1000 + 999)
      if (error) return json(500, { error: error.message })
      pings.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    // Agrupar por org + dispositivo y correr el detector por grupo.
    const grupos = new Map<string, { org: string; pings: Ping[] }>()
    for (const p of pings) {
      const key = `${p.organization_id}|${p.dispositivo}`
      if (!grupos.has(key)) grupos.set(key, { org: p.organization_id, pings: [] })
      grupos.get(key)!.pings.push({
        patente:    p.dispositivo,
        lat:        p.lat,
        lng:        p.lon,
        velocidad:  p.velocidad,
        created_at: p.capturado_en,
      })
    }

    const filas: Record<string, unknown>[] = []
    for (const { org, pings: ps } of grupos.values()) {
      for (const v of detectarViajes(ps)) {
        if (v.inicio < desdeInsertar) continue // posible viaje truncado por la ventana
        filas.push({
          organization_id: org,
          patente:       v.patente,
          chofer:        v.chofer,
          inicio:        v.inicio,
          fin:           v.fin,
          duracion_seg:  v.duracion_seg,
          distancia_km:  Math.round(v.distancia_km * 1000) / 1000,
          velocidad_max: v.velocidad_max != null ? Math.round(v.velocidad_max * 10) / 10 : null,
          recorrido:     v.recorrido,
        })
      }
    }

    let insertados = 0
    if (filas.length > 0) {
      // ignoreDuplicates → INSERT .. ON CONFLICT DO NOTHING sobre el unique
      // index (organization_id, patente, inicio).
      const { data, error } = await admin
        .from('viajes_gps')
        .upsert(filas, { onConflict: 'organization_id,patente,inicio', ignoreDuplicates: true })
        .select('id')
      if (error) return json(500, { error: error.message })
      insertados = data?.length ?? 0
    }

    return json(200, {
      pings: pings.length,
      dispositivos: grupos.size,
      viajes_detectados: filas.length,
      viajes_insertados: insertados,
    })
  } catch (e) {
    return json(500, { error: `Error inesperado: ${e instanceof Error ? e.message : String(e)}` })
  }
})
