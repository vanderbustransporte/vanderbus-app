// supabase/checks/permisos_seccion_check.mjs
//
// Verifica el enforcement de permisos por sección a nivel base
// (migración 20260715140000: tiene_permiso() + policies restrictivas).
//
// Con un OWNER y un STAFF reales de la org B, prueba los tres niveles sobre
// datos sembrados por el owner:
//   - staff sin permiso  -> no VE ni ESCRIBE (viajes, gastos, contactos).
//   - staff con 'ver'     -> VE pero NO escribe.
//   - staff con 'editar'  -> escribe.
//   - vehiculos (referencia): el staff SIEMPRE puede leer (SELECT abierto),
//     pero solo escribe con vehiculo:editar.
//   - owner: ve y escribe todo (regresión).
// Restaura el permisos original del staff y borra lo sembrado.
//
// Creds (.env): TEST_ORG_B_EMAIL/PASSWORD (owner) y
//               TEST_ORG_B_STAFF_EMAIL/PASSWORD (staff de la misma org).
//
// Uso: node supabase/checks/permisos_seccion_check.mjs

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
for (const k of ['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','TEST_ORG_B_EMAIL','TEST_ORG_B_PASSWORD','TEST_ORG_B_STAFF_EMAIL','TEST_ORG_B_STAFF_PASSWORD']) {
  if (!env[k]) { console.error(`Falta ${k} en .env`); process.exit(1) }
}

let fallas = 0
const ok   = (m) => console.log(`  ✓ ${m}`)
const fail = (m) => { fallas++; console.log(`  ✗ ${m}`) }
const nuevo = () => createClient(URL_SB, ANON, { auth: { persistSession: false } })

const sbOwner = nuevo()
const sbStaff = nuevo()
const marca = `permcheck-${Date.now()}`
let staffId = null
let orgId = null
let permisosOriginal = null
const sembrados = { viajes: null, gastos: null, contactos: null, vehiculos: null }

async function limpiar() {
  // Borra lo sembrado y restaura el permisos del staff (siempre, aunque falle algo).
  try {
    for (const [t, id] of Object.entries(sembrados)) {
      if (id) await sbOwner.from(t).delete().eq('id', id)
    }
    // filas que el staff haya podido insertar durante la prueba
    await sbOwner.from('viajes').delete().eq('cliente', marca)
    if (staffId && permisosOriginal !== null) {
      await sbOwner.from('profiles').update({ permisos: permisosOriginal }).eq('id', staffId)
    }
  } catch (e) { console.log('  (aviso: limpieza parcial:', e.message, ')') }
}

const setPermisos = (p) => sbOwner.from('profiles').update({ permisos: p }).eq('id', staffId)
const countStaff  = async (t) => {
  const { count, error } = await sbStaff.from(t).select('*', { count: 'exact', head: true })
  return error ? -1 : (count ?? 0)
}

console.log(`Check de permisos por sección — ${URL_SB}`)
try {
  // ── Login owner + staff ──
  const { data: so, error: eo } = await sbOwner.auth.signInWithPassword({ email: env.TEST_ORG_B_EMAIL, password: env.TEST_ORG_B_PASSWORD })
  if (eo) { console.error('login owner falló:', eo.message); process.exit(1) }
  const { data: ss, error: es } = await sbStaff.auth.signInWithPassword({ email: env.TEST_ORG_B_STAFF_EMAIL, password: env.TEST_ORG_B_STAFF_PASSWORD })
  if (es) { console.error('login staff falló:', es.message); process.exit(1) }
  staffId = ss.user.id

  const { data: prof } = await sbOwner.from('profiles').select('organization_id').eq('id', so.user.id).single()
  orgId = prof.organization_id
  const { data: profStaff } = await sbOwner.from('profiles').select('permisos').eq('id', staffId).single()
  permisosOriginal = profStaff?.permisos ?? {}

  // ── Semilla (como owner: pasa todos los permisos) ──
  // vehiculos.id es UUID (los demás usan id de texto tipo genId)
  const idV = `${marca}-v`, idG = `${marca}-g`, idC = `${marca}-c`, idVeh = crypto.randomUUID()
  const semillas = [
    ['viajes',    { id: idV,   organization_id: orgId, fecha: '2026-07-01', cliente: marca, origen: 'A', destino: 'B', monto_total: '1000', estado: 'Pendiente' }],
    ['gastos',    { id: idG,   organization_id: orgId, fecha: '2026-07-01', descripcion: marca, importe: '500' }],
    ['contactos', { id: idC,   organization_id: orgId, nombre: marca, tipo: 'Cliente' }],
    ['vehiculos', { id: idVeh, organization_id: orgId, alias: marca, marca: 'X', patente: 'PERM001', activo: true }],
  ]
  for (const [t, row] of semillas) {
    const { error } = await sbOwner.from(t).insert(row)
    if (error) { fail(`semilla ${t} falló (owner debería poder): ${error.message}`); await limpiar(); process.exit(1) }
    sembrados[t] = row.id
  }
  ok('owner sembró viajes/gastos/contactos/vehiculos (owner escribe todo)')

  // ── [1] staff SIN permiso ──
  console.log('\n[1/4] STAFF sin permiso (permisos = {}):')
  await setPermisos({})
  const cv = await countStaff('viajes'), cg = await countStaff('gastos'), cc = await countStaff('contactos')
  if (cv === 0) ok('no ve viajes'); else fail(`ve ${cv} viaje(s) sin permiso`)
  if (cg === 0) ok('no ve gastos'); else fail(`ve ${cg} gasto(s) sin permiso`)
  if (cc === 0) ok('no ve contactos'); else fail(`ve ${cc} contacto(s) sin permiso`)
  const cveh = await countStaff('vehiculos')
  if (cveh === 1) ok('SÍ ve vehiculos (referencia, SELECT abierto)'); else fail(`ve ${cveh} vehiculos (esperaba 1: SELECT abierto)`)
  const { error: eInsV0 } = await sbStaff.from('viajes').insert({ id: `${marca}-x0`, organization_id: orgId, cliente: marca, estado: 'Pendiente' }).select()
  if (eInsV0) ok(`no puede insertar viajes (${eInsV0.code ?? 'bloqueado'})`); else fail('insertó un viaje sin permiso — FUGA de escritura')
  const { error: eInsVeh0 } = await sbStaff.from('vehiculos').insert({ id: crypto.randomUUID(), organization_id: orgId, alias: marca, patente: 'PERM002' }).select()
  if (eInsVeh0) ok(`no puede insertar vehiculos sin vehiculo:editar (${eInsVeh0.code ?? 'bloqueado'})`); else fail('insertó un vehiculo sin permiso — FUGA de escritura')

  // ── [2] staff con viajes:ver ──
  console.log('\n[2/4] STAFF con { viajes: "ver" }:')
  await setPermisos({ viajes: 'ver' })
  const cv2 = await countStaff('viajes')
  if (cv2 === 1) ok('ahora VE viajes (1)'); else fail(`ve ${cv2} viajes con viajes:ver (esperaba 1)`)
  if (await countStaff('gastos') === 0) ok('sigue sin ver gastos'); else fail('ve gastos sin permiso de finanzas')
  const { error: eInsV1 } = await sbStaff.from('viajes').insert({ id: `${marca}-x1`, organization_id: orgId, cliente: marca, estado: 'Pendiente' }).select()
  if (eInsV1) ok(`con solo 'ver' NO puede insertar (${eInsV1.code ?? 'bloqueado'})`); else fail("insertó con solo 'ver' — debería requerir editar")

  // ── [3] staff con viajes:editar ──
  console.log('\n[3/4] STAFF con { viajes: "editar" }:')
  await setPermisos({ viajes: 'editar' })
  const { data: insE, error: eInsV2 } = await sbStaff.from('viajes').insert({ id: `${marca}-x2`, organization_id: orgId, cliente: marca, estado: 'Pendiente' }).select()
  if (eInsV2) fail(`con 'editar' NO pudo insertar: ${eInsV2.message}`)
  else { ok('con \'editar\' insertó un viaje'); await sbOwner.from('viajes').delete().eq('id', `${marca}-x2`) }

  // ── [4] owner ve todo (regresión) ──
  console.log('\n[4/4] OWNER ve todo (regresión):')
  const { count: ov } = await sbOwner.from('viajes').select('*', { count: 'exact', head: true })
  const { count: og } = await sbOwner.from('gastos').select('*', { count: 'exact', head: true })
  if ((ov ?? 0) >= 1 && (og ?? 0) >= 1) ok(`owner ve viajes(${ov}) y gastos(${og})`)
  else fail(`owner no ve lo sembrado: viajes ${ov}, gastos ${og}`)
} finally {
  await limpiar()
  await sbOwner.auth.signOut({ scope: 'local' })
  await sbStaff.auth.signOut({ scope: 'local' })
}

console.log(fallas === 0
  ? '\nTODO OK: permisos por sección enforced a nivel base.'
  : `\n${fallas} FALLA(S) — revisar arriba.`)
process.exit(fallas === 0 ? 0 : 1)
