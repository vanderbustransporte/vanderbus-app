// supabase/checks/aislamiento_rls.mjs
//
// Suite de aislamiento multi-tenant (Fase 1, punto 8 de la auditoría).
// Verifica contra la base REAL, vía REST con la anon key (igual que un atacante
// o un cliente cualquiera), tres cosas:
//
//   1. ANÓNIMO: ninguna tabla de `public` es legible sin sesión.
//   2. CROSS-TENANT: un usuario de la org B no ve NI UNA fila de la org A
//      (Vanderbus, que sí tiene datos), y solo ve lo propio en
//      profiles/organizations/org_settings.
//   3. ESCRITURA: la org B puede escribir en su propia org (insert + delete
//      de un contacto de prueba) y el RPC estado_suscripcion() responde.
//
// Uso:
//   node supabase/checks/aislamiento_rls.mjs                 # correr la suite
//   node supabase/checks/aislamiento_rls.mjs --provision     # crear la org B de prueba
//
// Credenciales: lee .env (no versionado). Además de VITE_SUPABASE_URL y
// VITE_SUPABASE_ANON_KEY necesita, para la parte con sesión:
//   TEST_ORG_B_EMAIL / TEST_ORG_B_PASSWORD
// Si no existen, correr una vez con --provision: registra el usuario, llama a
// crear_empresa() y muestra las líneas para pegar en .env.
//
// Sale con código 1 si alguna verificación falla.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// ── Env ───────────────────────────────────────────────────────────────────────
function cargarEnv() {
  const env = { ...process.env }
  try {
    for (const linea of readFileSync(new URL('../../.env', import.meta.url), 'utf8').split('\n')) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (m && !(m[1] in env)) env[m[1]] = m[2]
    }
  } catch { /* sin .env: se usan solo las vars de entorno */ }
  return env
}

const env = cargarEnv()
const URL_SB = env.VITE_SUPABASE_URL
const ANON   = env.VITE_SUPABASE_ANON_KEY
if (!URL_SB || !ANON) {
  console.error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (en .env o el entorno).')
  process.exit(1)
}

// Las 20 tablas de public (mantener en sync con supabase/checks/rls_audit.sql).
const TABLAS = [
  'organizations', 'profiles', 'org_settings',
  'vehiculos', 'vehiculo', 'combustible', 'mantenimiento', 'viajes',
  'contactos', 'nomina', 'ingresos', 'gastos', 'marketing',
  'notificaciones', 'ubicaciones_gps', 'viajes_gps', 'ubicaciones',
  'geofences', 'oportunidades', 'dispositivos_gps',
]

// Tablas donde la org B DEBE verse solo a sí misma (1 fila propia, no 0).
const FILA_PROPIA = { profiles: 1, organizations: 1, org_settings: 1 }

let fallas = 0
const ok   = (msg) => console.log(`  ✓ ${msg}`)
const fail = (msg) => { fallas++; console.log(`  ✗ ${msg}`) }

// ── 1. Pasada anónima ─────────────────────────────────────────────────────────
async function pasadaAnonima() {
  console.log('\n[1/3] Lectura ANÓNIMA (sin sesión) — se espera 0 filas en todo:')
  const anon = createClient(URL_SB, ANON, { auth: { persistSession: false } })
  for (const t of TABLAS) {
    const { data, error } = await anon.from(t).select('*').limit(1)
    if (error) { ok(`${t}: denegada (${error.code ?? error.message})`); continue }
    if ((data ?? []).length === 0) ok(`${t}: 0 filas`)
    else fail(`${t}: LEAK — devolvió ${data.length} fila(s) sin sesión`)
  }
  const { data: estado, error: eRpc } = await anon.rpc('estado_suscripcion')
  if (eRpc || estado == null) ok(`rpc estado_suscripcion: sin acceso anónimo (${eRpc?.code ?? 'null'})`)
  else fail(`rpc estado_suscripcion: respondió '${estado}' a un anónimo`)
}

// ── Provisión de la org B (una sola vez) ──────────────────────────────────────
async function provisionar() {
  const email = env.TEST_ORG_B_EMAIL ?? `rls-test-b+${Date.now()}@omatech.test`
  const bytes = new Uint8Array(18); crypto.getRandomValues(bytes)
  const password = Buffer.from(bytes).toString('base64url')

  console.log(`\nProvisionando org B de prueba (${email})...`)
  const sb = createClient(URL_SB, ANON, { auth: { persistSession: false } })

  const { data: alta, error: eUp } = await sb.auth.signUp({ email, password })
  if (eUp) { console.error(`signUp falló: ${eUp.message}`); process.exit(1) }
  if (!alta.session) {
    console.error(
      'signUp creó el usuario pero NO devolvió sesión: el proyecto exige confirmar el email.\n' +
      'Opciones: confirmar el usuario a mano en el dashboard (Auth → Users), o desactivar\n' +
      '"Confirm email" temporalmente, y después correr la suite con las credenciales en .env.'
    )
    console.log(`\nAgregá igual a .env:\nTEST_ORG_B_EMAIL=${email}\nTEST_ORG_B_PASSWORD=${password}`)
    process.exit(1)
  }

  const { data: orgId, error: eOrg } = await sb.rpc('crear_empresa', {
    p_nombre: 'Org B — pruebas de aislamiento RLS',
    p_nombre_usuario: 'Tester Org B',
  })
  if (eOrg) { console.error(`crear_empresa falló: ${eOrg.message}`); process.exit(1) }

  console.log(`Org B creada: ${orgId}`)
  console.log(`\nAgregá estas líneas a .env (NO se versiona) y volvé a correr la suite:\n`)
  console.log(`TEST_ORG_B_EMAIL=${email}`)
  console.log(`TEST_ORG_B_PASSWORD=${password}`)
  await sb.auth.signOut()
}

// ── 2 y 3. Pasada como org B ──────────────────────────────────────────────────
async function pasadaOrgB() {
  const email = env.TEST_ORG_B_EMAIL, password = env.TEST_ORG_B_PASSWORD
  if (!email || !password) {
    console.log('\n[2/3] SALTEADO: faltan TEST_ORG_B_EMAIL / TEST_ORG_B_PASSWORD en .env.')
    console.log('      Corré antes: node supabase/checks/aislamiento_rls.mjs --provision')
    fallas++
    return
  }

  const sb = createClient(URL_SB, ANON, { auth: { persistSession: false } })
  const { error: eIn } = await sb.auth.signInWithPassword({ email, password })
  if (eIn) { fail(`login org B falló: ${eIn.message}`); return }

  // Si el usuario quedó confirmado pero sin empresa (--provision cortado por la
  // confirmación de email), completar acá la provisión.
  const { data: yaTieneOrg } = await sb.rpc('estado_suscripcion')
  if (yaTieneOrg == null) {
    const { data: orgId, error: eOrg } = await sb.rpc('crear_empresa', {
      p_nombre: 'Org B — pruebas de aislamiento RLS',
      p_nombre_usuario: 'Tester Org B',
    })
    if (eOrg) { fail(`org B sin empresa y crear_empresa falló: ${eOrg.message}`); return }
    console.log(`\n(Provisión completada: org B creada → ${orgId})`)
  }

  console.log('\n[2/3] Lectura CROSS-TENANT (logueado como org B):')
  for (const t of TABLAS) {
    const esperado = FILA_PROPIA[t] ?? 0
    const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true })
    if (error) {
      // Denegación total también aísla (ej. tablas vestigiales sin policy de select).
      ok(`${t}: denegada (${error.code ?? error.message})`)
      continue
    }
    if ((count ?? 0) === esperado) ok(`${t}: ${count ?? 0} fila(s) (esperado ${esperado})`)
    else fail(`${t}: ve ${count} fila(s), esperaba ${esperado} — posible fuga de la org A`)
  }

  console.log('\n[3/3] Escritura y RPC (org B):')
  const { data: estado, error: eRpc } = await sb.rpc('estado_suscripcion')
  if (eRpc) fail(`estado_suscripcion: ${eRpc.message}`)
  else if (estado === 'activa') ok(`estado_suscripcion() = 'activa'`)
  else fail(`estado_suscripcion() = '${estado}' (¿org B suspendida?)`)

  const { data: prof } = await sb.from('profiles').select('organization_id').single()
  const miOrg = prof?.organization_id
  const marca = `[test-rls ${new Date().toISOString()}]`

  // (a) Insert SIN organization_id → el with check de tenant_isolation debe
  //     rechazarlo (contactos no tiene default; la app siempre lo manda explícito).
  const { error: eSinOrg } = await sb
    .from('contactos')
    .insert({ id: `rlstest${Date.now().toString(36)}a`, nombre: marca, tipo: 'otro' })
  if (eSinOrg) ok(`insert sin organization_id: rechazado por RLS (${eSinOrg.code ?? eSinOrg.message})`)
  else fail('insert sin organization_id: PASÓ — el with check no está exigiendo la org')

  // (b) Insert con la org propia (como hace useStore) → debe pasar; se limpia.
  const { data: ins, error: eIns } = await sb
    .from('contactos')
    .insert({ id: `rlstest${Date.now().toString(36)}b`, nombre: marca, tipo: 'otro', organization_id: miOrg })
    .select('id, organization_id')
    .single()
  if (eIns) fail(`insert propio en contactos falló: ${eIns.message}`)
  else {
    ok(`insert propio en contactos ok (org ${ins.organization_id})`)
    const { error: eDel } = await sb.from('contactos').delete().eq('id', ins.id)
    if (eDel) fail(`limpieza del contacto de prueba falló: ${eDel.message} (borralo a mano: ${ins.id})`)
    else ok('contacto de prueba borrado')
  }

  // (c) organizations debe ser SOLO-LECTURA para el tenant (migración
  //     20260710130100): un cliente no puede tocarse el plan ni el estado_sub.
  const { data: orgRow } = await sb.from('organizations').select('plan').eq('id', miOrg).maybeSingle()
  const { data: uOrg, error: eUOrg } = await sb
    .from('organizations').update({ plan: 'rls-probe' }).eq('id', miOrg).select()
  if (eUOrg || (uOrg?.length ?? 0) === 0) {
    ok(`update a organizations: denegado (${eUOrg?.code ?? '0 filas afectadas'})`)
  } else {
    fail('update a organizations: PASÓ — un tenant puede cambiarse plan/estado_sub')
    await sb.from('organizations').update({ plan: orgRow?.plan ?? 'trial' }).eq('id', miOrg) // revertir
  }

  await sb.auth.signOut()
}

// ── Main ──────────────────────────────────────────────────────────────────────
if (process.argv.includes('--provision')) {
  await provisionar()
} else {
  console.log(`Suite de aislamiento RLS — ${URL_SB}`)
  await pasadaAnonima()
  await pasadaOrgB()
  console.log(fallas === 0 ? '\nTODO OK: aislamiento verificado.' : `\n${fallas} FALLA(S) — revisar arriba.`)
  process.exit(fallas === 0 ? 0 : 1)
}
