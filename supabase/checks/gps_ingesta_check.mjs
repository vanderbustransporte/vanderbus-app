// supabase/checks/gps_ingesta_check.mjs
//
// Verificación end-to-end del GPS server-side (Fase 2, último ítem) contra la
// base REAL, usando la org B de prueba (no toca datos de Vanderbus):
//
//   1. RLS de dispositivos_gps: anónimo no lee; la org B crea/lee lo suyo.
//   2. gps-ingesta: sin token → 401, token inválido → 401, token válido → 201
//      (el ping queda en la org B con dispositivo = alias, ignora el body),
//      dispositivo desactivado → 401 (revocación).
//   3. detectar-viajes-gps: sin secret → 401. Si hay CRON_SECRET en .env,
//      además: siembra un viaje sintético por la ingesta, corre la detección
//      DOS veces y verifica que el viaje aparece una sola vez (idempotencia).
//   4. Limpieza: borra pings, viajes y dispositivo de prueba.
//
// Uso:  node supabase/checks/gps_ingesta_check.mjs
// Requiere en .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
//   TEST_ORG_B_EMAIL / TEST_ORG_B_PASSWORD, y opcionalmente CRON_SECRET
//   (select decrypted_secret from vault.decrypted_secrets where name='gps_cron_secret').
//
// Sale con código 1 si alguna verificación falla.

import { readFileSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// ── Env ───────────────────────────────────────────────────────────────────────
function cargarEnv() {
  const env = { ...process.env }
  try {
    for (const linea of readFileSync(new URL('../../.env', import.meta.url), 'utf8').split('\n')) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (m && !(m[1] in env)) env[m[1]] = m[2]
    }
  } catch { /* sin .env */ }
  return env
}

const env  = cargarEnv()
const URL_SB = env.VITE_SUPABASE_URL
const ANON   = env.VITE_SUPABASE_ANON_KEY
if (!URL_SB || !ANON || !env.TEST_ORG_B_EMAIL || !env.TEST_ORG_B_PASSWORD) {
  console.error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / TEST_ORG_B_EMAIL / TEST_ORG_B_PASSWORD.')
  process.exit(1)
}

const INGESTA_URL   = `${URL_SB}/functions/v1/gps-ingesta`
const DETECTAR_URL  = `${URL_SB}/functions/v1/detectar-viajes-gps`
const ALIAS_PRUEBA  = 'check-gps-ingesta'

let fallas = 0
const ok   = (msg) => console.log(`  ✓ ${msg}`)
const fail = (msg) => { fallas++; console.error(`  ✗ ${msg}`) }
const check = (cond, msg) => (cond ? ok(msg) : fail(msg))

const sha256Hex = (s) => createHash('sha256').update(s).digest('hex')

async function postIngesta(token, body) {
  const res = await fetch(INGESTA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-device-token': token } : {}),
    },
    body: JSON.stringify(body ?? {}),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

// ── Sesión org B ──────────────────────────────────────────────────────────────
const anon = createClient(URL_SB, ANON)
const orgB = createClient(URL_SB, ANON)
const { data: login, error: eLogin } = await orgB.auth.signInWithPassword({
  email: env.TEST_ORG_B_EMAIL,
  password: env.TEST_ORG_B_PASSWORD,
})
if (eLogin) { console.error('Login org B falló:', eLogin.message); process.exit(1) }

const { data: perfil } = await orgB.from('profiles').select('organization_id').eq('id', login.user.id).single()
const ORG_B = perfil?.organization_id
if (!ORG_B) { console.error('No se pudo resolver la org B.'); process.exit(1) }

// ── Limpieza previa (por si un run anterior quedó a medias) ───────────────────
async function limpiar() {
  await orgB.from('ubicaciones_gps').delete().eq('dispositivo', ALIAS_PRUEBA)
  await orgB.from('viajes_gps').delete().eq('patente', ALIAS_PRUEBA)
  await orgB.from('dispositivos_gps').delete().eq('alias', ALIAS_PRUEBA)
}
await limpiar()

try {
  // ── 1. RLS de dispositivos_gps ──────────────────────────────────────────────
  console.log('\n1. RLS de dispositivos_gps')
  {
    const { data, error } = await anon.from('dispositivos_gps').select('id').limit(1)
    check(error !== null || (data ?? []).length === 0, 'anónimo no lee dispositivos_gps')
  }

  const token = randomBytes(24).toString('hex')
  {
    const { error } = await orgB.from('dispositivos_gps').insert({
      organization_id: ORG_B,
      alias: ALIAS_PRUEBA,
      token_hash: sha256Hex(token),
    })
    check(!error, `org B crea su dispositivo (${error?.message ?? 'ok'})`)
  }
  {
    const { error } = await orgB.from('dispositivos_gps').insert({
      organization_id: '00000000-0000-0000-0000-000000000000',
      alias: 'intruso',
      token_hash: sha256Hex('x'),
    })
    check(error !== null, 'with check rechaza dispositivo para otra org')
  }

  // ── 2. gps-ingesta ──────────────────────────────────────────────────────────
  console.log('\n2. Edge Function gps-ingesta')
  {
    const r = await postIngesta(null, { lat: -34.77, lon: -58.37 })
    if (r.status === 404) {
      fail('gps-ingesta no está deployada (404) — deployar y reintentar')
      throw new Error('sin función')
    }
    check(r.status === 401, `sin token → 401 (dio ${r.status})`)
  }
  {
    const r = await postIngesta('token-falso', { lat: -34.77, lon: -58.37 })
    check(r.status === 401, `token inválido → 401 (dio ${r.status})`)
  }
  {
    const r = await postIngesta(token, { lat: 999, lon: 0 })
    check(r.status === 400, `lat inválida → 400 (dio ${r.status})`)
  }
  {
    const capturado = new Date(Date.now() - 60_000).toISOString()
    const r = await postIngesta(token, {
      lat: -34.77, lon: -58.37, velocidad: 12, bateria: 80,
      capturado_en: capturado, dispositivo: 'spoof-de-otro',
    })
    check(r.status === 201, `ping válido → 201 (dio ${r.status}: ${JSON.stringify(r.body)})`)

    const { data } = await orgB
      .from('ubicaciones_gps')
      .select('dispositivo, organization_id, lat, capturado_en')
      .eq('capturado_en', capturado)
    const fila = (data ?? [])[0]
    check(!!fila, 'el ping quedó en la base (visible para la org B)')
    if (fila) {
      check(fila.dispositivo === ALIAS_PRUEBA, `dispositivo = alias de la tabla, ignora el spoof (${fila.dispositivo})`)
      check(fila.organization_id === ORG_B, 'organization_id = org del dispositivo')
    }

    const { data: d } = await orgB.from('dispositivos_gps').select('ultimo_ping').eq('alias', ALIAS_PRUEBA).single()
    check(!!d?.ultimo_ping, 'ultimo_ping actualizado')
  }
  {
    // GPSLogger manda %SPD en m/s → la función convierte a km/h.
    const capturado = new Date(Date.now() - 50_000).toISOString()
    const r = await postIngesta(token, {
      lat: -34.77, lon: -58.37, velocidad_ms: 25, capturado_en: capturado,
    })
    check(r.status === 201, `ping con velocidad_ms → 201 (dio ${r.status})`)
    const { data } = await orgB
      .from('ubicaciones_gps').select('velocidad').eq('capturado_en', capturado)
    check(data?.[0]?.velocidad === 90, `velocidad_ms 25 m/s se guardó como 90 km/h (dio ${data?.[0]?.velocidad})`)
  }
  {
    await orgB.from('dispositivos_gps').update({ activo: false }).eq('alias', ALIAS_PRUEBA)
    const r = await postIngesta(token, { lat: -34.77, lon: -58.37 })
    check(r.status === 401, `dispositivo desactivado → 401 (revocación) (dio ${r.status})`)
    await orgB.from('dispositivos_gps').update({ activo: true }).eq('alias', ALIAS_PRUEBA)
  }

  // ── 3. detectar-viajes-gps ──────────────────────────────────────────────────
  console.log('\n3. Edge Function detectar-viajes-gps')
  {
    const res = await fetch(DETECTAR_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    if (res.status === 404) fail('detectar-viajes-gps no está deployada (404)')
    else check(res.status === 401, `sin x-cron-secret → 401 (dio ${res.status})`)
  }

  if (!env.CRON_SECRET) {
    console.log('  – CRON_SECRET no está en .env: se salta la prueba positiva de detección.')
    console.log("    (select decrypted_secret from vault.decrypted_secrets where name='gps_cron_secret')")
  } else {
    // Viaje sintético: 10 pings hace 2 h, cada 30 s, avanzando ~90 m por ping
    // (~0.8 km total, 270 s) → supera MIN_DISTANCIA_KM y MIN_DURACION_SEG, y
    // como el último ping es viejo el viaje se cierra.
    const t0 = Date.now() - 2 * 3600_000
    for (let i = 0; i < 10; i++) {
      const r = await postIngesta(token, {
        lat: -34.77 + i * 0.0008,
        lon: -58.37,
        velocidad: 20,
        capturado_en: new Date(t0 + i * 30_000).toISOString(),
      })
      if (r.status !== 201) { fail(`siembra de ping ${i} falló (${r.status})`); break }
    }

    const correr = async () => {
      const res = await fetch(DETECTAR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cron-secret': env.CRON_SECRET },
        body: '{}',
      })
      return { status: res.status, body: await res.json().catch(() => null) }
    }

    const r1 = await correr()
    check(r1.status === 200, `detección con secret → 200 (dio ${r1.status}: ${JSON.stringify(r1.body)})`)

    const { data: v1 } = await orgB.from('viajes_gps').select('id, distancia_km, duracion_seg').eq('patente', ALIAS_PRUEBA)
    check((v1 ?? []).length === 1, `el viaje sintético se detectó una vez (hay ${(v1 ?? []).length})`)
    if ((v1 ?? []).length === 1) {
      check(v1[0].duracion_seg === 270, `duración 270 s (dio ${v1[0].duracion_seg})`)
      check(v1[0].distancia_km > 0.5, `distancia > 0.5 km (dio ${v1[0].distancia_km})`)
    }

    const r2 = await correr()
    check(r2.status === 200 && r2.body?.viajes_insertados === 0,
      `segunda pasada idempotente: 0 insertados (dio ${JSON.stringify(r2.body)})`)
    const { data: v2 } = await orgB.from('viajes_gps').select('id').eq('patente', ALIAS_PRUEBA)
    check((v2 ?? []).length === 1, 'sigue habiendo exactamente 1 viaje')
  }
} catch (e) {
  if (e.message !== 'sin función') { fallas++; console.error('Error inesperado:', e) }
} finally {
  // ── 4. Limpieza ─────────────────────────────────────────────────────────────
  console.log('\n4. Limpieza')
  await limpiar()
  const { data: quedan } = await orgB.from('dispositivos_gps').select('id').eq('alias', ALIAS_PRUEBA)
  check((quedan ?? []).length === 0, 'dispositivo, pings y viajes de prueba borrados')
  await orgB.auth.signOut({ scope: 'local' })
}

console.log(fallas === 0 ? '\nTODO OK' : `\n${fallas} FALLAS`)
process.exit(fallas === 0 ? 0 : 1)
