// supabase/checks/provisionar_empresa_check.mjs
//
// Verificación del alta administrada de empresas (Fase 1, Área 2):
// migración 20260710130200 (función SQL provisionar_empresa) + Edge Function
// provisionar-empresa. Corre contra la base REAL vía REST, como un atacante.
//
// Qué asierta:
//   1. El RPC provisionar_empresa EXISTE pero está denegado para anon
//      (si devuelve PGRST202 → la migración 130200 no está aplicada).
//   2. También está denegado para un usuario autenticado común (org B):
//      solo service_role puede ejecutarlo.
//   3. La Edge Function está deployada (no 404) y sin token responde 401.
//   4. Con el token de un usuario NO-superadmin (org B) responde 403.
//
// NO provisiona ninguna empresa: solo verifica que las puertas estén cerradas.
// La prueba positiva (crear una empresa real) se hace una vez, a mano, desde
// una sesión superadmin — ver el encabezado de functions/provisionar-empresa/index.ts.
//
// Uso: node supabase/checks/provisionar_empresa_check.mjs
// Credenciales: lee .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY y, para los
// puntos 2 y 4, TEST_ORG_B_EMAIL / TEST_ORG_B_PASSWORD).
//
// Sale con código 1 si algo falla o falta deployar.

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

let fallas = 0
const ok   = (msg) => console.log(`  ✓ ${msg}`)
const fail = (msg) => { fallas++; console.log(`  ✗ ${msg}`) }

const ARGS_RPC = {
  p_nombre_empresa: 'probe',
  p_owner_id: '00000000-0000-0000-0000-000000000000',
}

async function llamarRpc(sb) {
  return sb.rpc('provisionar_empresa', ARGS_RPC)
}

async function llamarFuncion(token) {
  const res = await fetch(`${URL_SB}/functions/v1/provisionar-empresa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // El gateway de Edge Functions exige apikey además del JWT (como supabase-js).
      apikey: ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({}),
  })
  return { status: res.status, body: await res.text() }
}

console.log(`Check de provisionar-empresa — ${URL_SB}`)

// ── 1. RPC como anon ──────────────────────────────────────────────────────────
console.log('\n[1/4] RPC provisionar_empresa como ANÓNIMO:')
{
  const anon = createClient(URL_SB, ANON, { auth: { persistSession: false } })
  const { error } = await llamarRpc(anon)
  if (!error) fail('el RPC RESPONDIÓ a un anónimo — el REVOKE no está aplicado')
  else if (error.code === 'PGRST202') fail('el RPC no existe: falta aplicar la migración 20260710130200')
  else ok(`denegado (${error.code ?? error.message})`)
}

// ── 2. RPC como usuario autenticado común (org B) ─────────────────────────────
console.log('\n[2/4] RPC provisionar_empresa como AUTENTICADO no-superadmin (org B):')
let tokenOrgB = null
let sbOrgB = null // el signOut recién al final: revoca la sesión y el paso 4 usa este token
if (!env.TEST_ORG_B_EMAIL || !env.TEST_ORG_B_PASSWORD) {
  fail('faltan TEST_ORG_B_EMAIL / TEST_ORG_B_PASSWORD en .env (ver aislamiento_rls.mjs --provision)')
} else {
  sbOrgB = createClient(URL_SB, ANON, { auth: { persistSession: false } })
  const { data: ses, error: eIn } = await sbOrgB.auth.signInWithPassword({
    email: env.TEST_ORG_B_EMAIL,
    password: env.TEST_ORG_B_PASSWORD,
  })
  if (eIn) fail(`login org B falló: ${eIn.message}`)
  else {
    tokenOrgB = ses.session.access_token
    const { error } = await llamarRpc(sbOrgB)
    if (!error) fail('el RPC RESPONDIÓ a un authenticated — solo service_role debería poder')
    else if (error.code === 'PGRST202') fail('el RPC no existe: falta aplicar la migración 20260710130200')
    else ok(`denegado (${error.code ?? error.message})`)
  }
}

// ── 3. Edge Function sin token ────────────────────────────────────────────────
console.log('\n[3/4] Edge Function sin token:')
{
  const { status, body } = await llamarFuncion(null)
  if (status === 404) fail('la Edge Function no está deployada (404)')
  else if (status === 401) ok('401 sin token, como corresponde')
  else fail(`respondió ${status} sin token (se esperaba 401): ${body.slice(0, 120)}`)
}

// ── 4. Edge Function con token de no-superadmin ───────────────────────────────
console.log('\n[4/4] Edge Function con sesión de org B (no-superadmin):')
if (!tokenOrgB) {
  fail('sin token de org B (falló el paso 2), no se puede probar')
} else {
  const { status, body } = await llamarFuncion(tokenOrgB)
  if (status === 404) fail('la Edge Function no está deployada (404)')
  else if (status === 403) ok('403 para un no-superadmin, como corresponde')
  else fail(`respondió ${status} (se esperaba 403): ${body.slice(0, 120)}`)
}

if (sbOrgB) await sbOrgB.auth.signOut()

console.log(fallas === 0
  ? '\nTODO OK: provisionar-empresa deployada y cerrada a quien no corresponde.'
  : `\n${fallas} FALLA(S) — revisar arriba.`)
process.exit(fallas === 0 ? 0 : 1)
