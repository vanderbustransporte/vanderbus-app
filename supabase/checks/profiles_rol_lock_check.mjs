// supabase/checks/profiles_rol_lock_check.mjs
//
// Verifica que un usuario NO-owner no puede auto-escalar su rol ni sus permisos
// (migración 20260715130000_profiles_rol_lock: policy restrictiva es_owner()).
//
// Qué asierta, contra la base REAL:
//   1. STAFF: update de su propio `rol` a 'owner'  -> 0 filas (bloqueado).
//   2. STAFF: update de su propio `permisos`        -> 0 filas (bloqueado).
//   3. STAFF: su rol real sigue siendo 'staff' después de intentarlo.
//   4. OWNER: sigue pudiendo editar el `permisos` del staff (flujo legítimo de
//      Usuarios.jsx no se rompió). Se restaura el valor original.
//
// Necesita una cuenta STAFF persistente en la org B, además del owner de la org B:
//   TEST_ORG_B_EMAIL / TEST_ORG_B_PASSWORD          (owner de la org B)
//   TEST_ORG_B_STAFF_EMAIL / TEST_ORG_B_STAFF_PASSWORD  (staff de la MISMA org B)
// Si faltan las de staff, el check avisa cómo crearla y sale 1.
//
// Uso: node supabase/checks/profiles_rol_lock_check.mjs

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function cargarEnv() {
  const env = { ...process.env }
  try {
    for (const l of readFileSync(new URL('../../.env', import.meta.url), 'utf8').split('\n')) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (m && !(m[1] in env)) env[m[1]] = m[2]
    }
  } catch { /* sin .env */ }
  return env
}

const env = cargarEnv()
const URL_SB = env.VITE_SUPABASE_URL
const ANON   = env.VITE_SUPABASE_ANON_KEY
if (!URL_SB || !ANON) { console.error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY'); process.exit(1) }
if (!env.TEST_ORG_B_EMAIL || !env.TEST_ORG_B_PASSWORD) { console.error('Faltan TEST_ORG_B_EMAIL / TEST_ORG_B_PASSWORD'); process.exit(1) }
if (!env.TEST_ORG_B_STAFF_EMAIL || !env.TEST_ORG_B_STAFF_PASSWORD) {
  console.error('Faltan TEST_ORG_B_STAFF_EMAIL / TEST_ORG_B_STAFF_PASSWORD (un staff de la org B).')
  console.error('Creá uno logueado como owner de la org B (Usuarios → Agregar) o vía la Edge Function')
  console.error('Crear-Usuario con rol "staff", y confirmá el email si hace falta.')
  process.exit(1)
}

let fallas = 0
const ok   = (m) => console.log(`  ✓ ${m}`)
const fail = (m) => { fallas++; console.log(`  ✗ ${m}`) }

const nuevo = () => createClient(URL_SB, ANON, { auth: { persistSession: false } })

console.log(`Check de bloqueo de auto-escalada de rol — ${URL_SB}`)

// ── Sesión STAFF ──────────────────────────────────────────────────────────────
console.log('\n[1/2] STAFF intenta auto-escalarse:')
const sbStaff = nuevo()
const { data: sesStaff, error: eStaff } = await sbStaff.auth.signInWithPassword({
  email: env.TEST_ORG_B_STAFF_EMAIL, password: env.TEST_ORG_B_STAFF_PASSWORD,
})
let staffId = null
if (eStaff) {
  fail(`login staff falló: ${eStaff.message}`)
} else {
  staffId = sesStaff.user.id
  const { data: pre } = await sbStaff.from('profiles').select('rol').eq('id', staffId).single()
  if (pre.rol !== 'staff') fail(`la cuenta de prueba no es staff (rol=${pre.rol}) — usá una staff real`)

  const { data: u1 } = await sbStaff.from('profiles').update({ rol: 'owner' }).eq('id', staffId).select()
  if ((u1?.length ?? 0) === 0) ok('update rol->owner: 0 filas (bloqueado)')
  else fail(`update rol->owner afectó ${u1.length} fila(s) — ESCALADA POSIBLE`)

  const { data: u2 } = await sbStaff.from('profiles').update({ permisos: { finanzas: 'editar' } }).eq('id', staffId).select()
  if ((u2?.length ?? 0) === 0) ok('update permisos (self): 0 filas (bloqueado)')
  else fail(`update permisos afectó ${u2.length} fila(s) — escalada de permisos posible`)

  const { data: post } = await sbStaff.from('profiles').select('rol').eq('id', staffId).single()
  if (post.rol === 'staff') ok('el rol real sigue siendo staff')
  else fail(`el rol quedó en '${post.rol}' — la escalada funcionó`)
}
await sbStaff.auth.signOut({ scope: 'local' })

// ── Sesión OWNER: el flujo legítimo sigue vivo ────────────────────────────────
console.log('\n[2/2] OWNER sigue pudiendo editar al staff (flujo legítimo):')
if (!staffId) {
  fail('sin staffId (falló el login staff), no se puede probar el flujo owner')
} else {
  const sbOwner = nuevo()
  const { error: eOwner } = await sbOwner.auth.signInWithPassword({
    email: env.TEST_ORG_B_EMAIL, password: env.TEST_ORG_B_PASSWORD,
  })
  if (eOwner) fail(`login owner falló: ${eOwner.message}`)
  else {
    const { data: antes } = await sbOwner.from('profiles').select('permisos').eq('id', staffId).single()
    const marca = { ...(antes?.permisos ?? {}), __check__: 'ok' }
    const { data: up, error: eUp } = await sbOwner.from('profiles').update({ permisos: marca }).eq('id', staffId).select()
    if (eUp || (up?.length ?? 0) === 0) fail(`el owner NO pudo editar al staff (${eUp?.message ?? '0 filas'}) — se rompió el flujo legítimo`)
    else {
      ok('el owner editó el permisos del staff')
      await sbOwner.from('profiles').update({ permisos: antes?.permisos ?? {} }).eq('id', staffId) // restaurar
      ok('permisos del staff restaurado')
    }
  }
  await sbOwner.auth.signOut({ scope: 'local' })
}

console.log(fallas === 0
  ? '\nTODO OK: la auto-escalada de rol está cerrada y el flujo owner sigue vivo.'
  : `\n${fallas} FALLA(S) — revisar arriba.`)
process.exit(fallas === 0 ? 0 : 1)
