// supabase/checks/features_check.mjs
//
// Check de feature flags por org (Fase 2, punto 9 — migración 20260711120000).
// Verifica contra la base REAL, vía REST con la anon key:
//
//   1. ANÓNIMO: listar_empresas() y set_org_features() denegadas.
//   2. TENANT COMÚN (org B): las RPCs denegadas (42501), pero SÍ puede leer
//      los features de su propia org (los necesita el frontend).
//   3. SUPERADMIN: lista todas las orgs y cambia flags de otra org (se usa
//      una org de prueba y se restaura el valor original al final).
//
// Uso:  node supabase/checks/features_check.mjs
// Credenciales: lee .env (no versionado): VITE_SUPABASE_URL/ANON_KEY,
// TEST_ORG_B_EMAIL/PASSWORD y SUPERADMIN_EMAIL/PASSWORD.
// Sale con código 1 si algo falla.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

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
const cliente = () => createClient(URL_SB, ANON, { auth: { persistSession: false } })

// ── 1. Anónimo ────────────────────────────────────────────────────────────────
async function pasadaAnonima() {
  console.log('\n[1/3] ANÓNIMO — todo denegado:')
  const anon = cliente()
  const { data: lista, error: eLista } = await anon.rpc('listar_empresas')
  if (eLista || lista == null) ok(`listar_empresas: denegada (${eLista?.code ?? 'null'})`)
  else fail(`listar_empresas: devolvió ${lista.length} org(s) a un anónimo`)

  const { error: eSet } = await anon.rpc('set_org_features', {
    p_org: '00000000-0000-0000-0000-000000000000', p_features: {},
  })
  if (eSet) ok(`set_org_features: denegada (${eSet.code ?? eSet.message})`)
  else fail('set_org_features: PASÓ como anónimo')
}

// ── 2. Tenant común (org B) ───────────────────────────────────────────────────
async function pasadaOrgB() {
  console.log('\n[2/3] TENANT COMÚN (org B) — RPCs denegadas, lectura propia ok:')
  const email = env.TEST_ORG_B_EMAIL, password = env.TEST_ORG_B_PASSWORD
  if (!email || !password) { fail('faltan TEST_ORG_B_EMAIL / TEST_ORG_B_PASSWORD en .env'); return }

  const sb = cliente()
  const { error: eIn } = await sb.auth.signInWithPassword({ email, password })
  if (eIn) { fail(`login org B falló: ${eIn.message}`); return }

  const { data: propia, error: eProp } = await sb.from('organizations').select('id, features').maybeSingle()
  if (eProp) fail(`lectura de features propios falló: ${eProp.message} (¿columna sin crear?)`)
  else if (propia && typeof propia.features === 'object') ok(`lee sus propios features: ${JSON.stringify(propia.features)}`)
  else fail(`no pudo leer su propia org (${JSON.stringify(propia)})`)

  const { data: lista, error: eLista } = await sb.rpc('listar_empresas')
  if (eLista) ok(`listar_empresas: denegada (${eLista.code ?? eLista.message})`)
  else fail(`listar_empresas: un tenant común listó ${lista?.length} org(s)`)

  const { error: eSet } = await sb.rpc('set_org_features', {
    p_org: propia?.id ?? '00000000-0000-0000-0000-000000000000',
    p_features: { seguimiento: true },
  })
  if (eSet) ok(`set_org_features (a su propia org): denegada (${eSet.code ?? eSet.message})`)
  else fail('set_org_features: un tenant común se cambió sus propios flags')

  await sb.auth.signOut()
}

// ── 3. Superadmin ─────────────────────────────────────────────────────────────
async function pasadaSuperadmin() {
  console.log('\n[3/3] SUPERADMIN — lista y cambia flags:')
  const email = env.SUPERADMIN_EMAIL, password = env.SUPERADMIN_PASSWORD
  if (!email || !password) { fail('faltan SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD en .env'); return }

  const sb = cliente()
  const { error: eIn } = await sb.auth.signInWithPassword({ email, password })
  if (eIn) { fail(`login superadmin falló: ${eIn.message}`); return }

  const { data: lista, error: eLista } = await sb.rpc('listar_empresas')
  if (eLista) { fail(`listar_empresas falló: ${eLista.message}`); await sb.auth.signOut(); return }
  if ((lista?.length ?? 0) >= 2) ok(`listar_empresas: ${lista.length} org(s)`)
  else fail(`listar_empresas devolvió ${lista?.length} org(s), se esperaban ≥ 2`)

  // Toggle sobre una org que NO es la del superadmin, y restaurar al final.
  const { data: { user } } = await sb.auth.getUser()
  const { data: miProfile } = await sb.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
  const ajena = lista.find(o => o.id !== miProfile?.organization_id)
  if (!ajena) { fail('no hay una org ajena para probar el toggle'); await sb.auth.signOut(); return }

  const original = ajena.features ?? {}
  const { data: puesto, error: eSet } = await sb.rpc('set_org_features', {
    p_org: ajena.id, p_features: { ...original, seguimiento: true },
  })
  if (eSet) fail(`set_org_features falló: ${eSet.message}`)
  else if (puesto?.seguimiento === true) ok(`flag seteado en "${ajena.nombre}": ${JSON.stringify(puesto)}`)
  else fail(`set_org_features devolvió ${JSON.stringify(puesto)}, se esperaba seguimiento=true`)

  const { data: restaurado, error: eRest } = await sb.rpc('set_org_features', {
    p_org: ajena.id, p_features: original,
  })
  if (eRest) fail(`RESTAURAR falló: ${eRest.message} — dejar a mano ${JSON.stringify(original)} en ${ajena.id}`)
  else if (JSON.stringify(restaurado) === JSON.stringify(original)) ok('flags restaurados al valor original')
  else fail(`restauración devolvió ${JSON.stringify(restaurado)}, se esperaba ${JSON.stringify(original)}`)

  // p_features inválido (no-objeto) debe rechazarse.
  const { error: eInv } = await sb.rpc('set_org_features', { p_org: ajena.id, p_features: 'gato' })
  if (eInv) ok(`p_features no-objeto: rechazado (${eInv.code ?? eInv.message})`)
  else fail('p_features no-objeto: PASÓ — falta la validación de jsonb_typeof')

  await sb.auth.signOut()
}

console.log(`Check de feature flags por org — ${URL_SB}`)
await pasadaAnonima()
await pasadaOrgB()
await pasadaSuperadmin()
console.log(fallas === 0 ? '\nTODO OK: feature flags verificados.' : `\n${fallas} FALLA(S) — revisar arriba.`)
process.exit(fallas === 0 ? 0 : 1)
