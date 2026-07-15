// supabase/checks/importar_backup_check.mjs
//
// Verificación del import de backup transaccional (Fase 3, punto 13):
// migración 20260715120000 (función SQL importar_backup).
//
// Qué asierta:
//   1. La RPC existe pero está denegada para anon
//      (si devuelve PGRST202 → la migración no está aplicada).
//   2. Como org B: un import válido reemplaza TODO (counts correctos,
//      organization_id spoofeado en el archivo se fuerza a la org propia,
//      id/created_at ausentes se completan con defaults).
//   3. ATOMICIDAD: un payload con id duplicado en la ÚLTIMA tabla (viajes)
//      falla DESPUÉS de que la función ya procesó las demás tablas — y al
//      releer, los datos previos siguen intactos (rollback total).
//   4. Un payload malformado (tabla que no es lista) se rechaza sin tocar nada.
//   5. Al final restaura el contenido original de la org B con la misma RPC.
//
// Solo escribe en la org B de prueba; deja todo como estaba.
//
// Uso: node supabase/checks/importar_backup_check.mjs
// Credenciales: lee .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
// TEST_ORG_B_EMAIL / TEST_ORG_B_PASSWORD).
//
// Sale con código 1 si algo falla o falta deployar.

import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
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
if (!env.TEST_ORG_B_EMAIL || !env.TEST_ORG_B_PASSWORD) {
  console.error('Faltan TEST_ORG_B_EMAIL / TEST_ORG_B_PASSWORD en .env (ver aislamiento_rls.mjs).')
  process.exit(1)
}

let fallas = 0
const ok   = (msg) => console.log(`  ✓ ${msg}`)
const fail = (msg) => { fallas++; console.log(`  ✗ ${msg}`) }

const TABLAS = ['vehiculos', 'combustible', 'mantenimiento', 'contactos',
  'nomina', 'ingresos', 'gastos', 'marketing', 'viajes']

async function leerTodo(sb) {
  const out = {}
  for (const t of TABLAS) {
    const { data, error } = await sb.from(t).select('*')
    if (error) throw new Error(`leyendo ${t}: ${error.message}`)
    out[t] = data ?? []
  }
  return out
}

const idsPorTabla = (snap) =>
  Object.fromEntries(TABLAS.map(t => [t, snap[t].map(r => r.id).sort()]))

console.log(`Check de importar_backup — ${URL_SB}`)

// ── 1. RPC como anon ──────────────────────────────────────────────────────────
console.log('\n[1/5] RPC importar_backup como ANÓNIMO:')
{
  const anon = createClient(URL_SB, ANON, { auth: { persistSession: false } })
  const { error } = await anon.rpc('importar_backup', { p_data: {} })
  if (!error) fail('la RPC RESPONDIÓ a un anónimo — el REVOKE no está aplicado')
  else if (error.code === 'PGRST202') fail('la RPC no existe: falta aplicar la migración 20260715120000')
  else ok(`denegada (${error.code ?? error.message})`)
}

// ── Login org B + snapshot para restaurar al final ────────────────────────────
const sbB = createClient(URL_SB, ANON, { auth: { persistSession: false } })
{
  const { error } = await sbB.auth.signInWithPassword({
    email: env.TEST_ORG_B_EMAIL,
    password: env.TEST_ORG_B_PASSWORD,
  })
  if (error) { console.error(`Login org B falló: ${error.message}`); process.exit(1) }
}
const snapshot = await leerTodo(sbB)
const totalSnap = TABLAS.reduce((n, t) => n + snapshot[t].length, 0)
console.log(`\n(snapshot org B para restaurar al final: ${totalSnap} filas)`)

// ── 2. Import válido: reemplazo total + spoof + defaults ─────────────────────
console.log('\n[2/5] Import válido (reemplazo total, org spoofeada, defaults):')
const ORG_FALSA = '11111111-1111-1111-1111-111111111111'
let idsTrasSeed = null // estado esperado tras el seed, para los pasos 3 y 4
const seed = {
  vehiculos: [
    { id: randomUUID(), alias: 'IMP-CHECK-1', marca: 'Renault', patente: 'AA000AA', organization_id: ORG_FALSA },
  ],
  viajes: [
    { id: 'imp-check-v1', fecha: '2026-01-10', cliente: 'Cliente Check', created_at: '2026-01-10 09:00:00' },
    { fecha: '2026-01-11', cliente: 'Sin id ni created_at' }, // defaults
  ],
  gastos: [
    { id: 'imp-check-g1', fecha: '2026-01-12', descripcion: 'Gasto check', importe: '1234.5' },
  ],
}
try {
  const { data: resumen, error } = await sbB.rpc('importar_backup', { p_data: seed })
  if (error) throw new Error(error.message)
  const esperado = Object.fromEntries(TABLAS.map(t => [t, (seed[t] ?? []).length]))
  const okCounts = TABLAS.every(t => resumen?.[t] === esperado[t])
  if (okCounts) ok(`resumen correcto: ${JSON.stringify(resumen)}`)
  else fail(`resumen inesperado: ${JSON.stringify(resumen)} (se esperaba ${JSON.stringify(esperado)})`)

  const post = await leerTodo(sbB)
  if (post.viajes.length === 2 && post.vehiculos.length === 1 && post.gastos.length === 1
      && TABLAS.every(t => post[t].length === esperado[t])) {
    ok('reemplazo total: solo quedan las filas del archivo (tablas ausentes vaciadas)')
  } else {
    fail(`quedaron filas inesperadas: ${JSON.stringify(idsPorTabla(post))}`)
  }

  const veh = post.vehiculos[0]
  if (veh && veh.organization_id !== ORG_FALSA) ok('organization_id spoofeado en el archivo fue forzado a la org propia')
  else fail('el organization_id del archivo NO fue pisado — spoof posible')

  const sinId = post.viajes.find(v => v.cliente === 'Sin id ni created_at')
  if (sinId && sinId.id && sinId.created_at) ok(`defaults completados: id=${sinId.id}, created_at=${sinId.created_at}`)
  else fail('la fila sin id/created_at no recibió defaults')

  idsTrasSeed = idsPorTabla(post)
} catch (e) {
  fail(`import válido falló: ${e.message}`)
}

// ── 3. Atomicidad: falla en la última tabla → rollback total ─────────────────
console.log('\n[3/5] Atomicidad (id duplicado en viajes, la última tabla que se inserta):')
{
  const malo = {
    vehiculos: [{ id: randomUUID(), alias: 'NO-DEBE-QUEDAR' }],
    gastos: [{ id: 'no-debe-quedar-g', fecha: '2026-02-01', descripcion: 'no debe quedar' }],
    viajes: [
      { id: 'dup-1', fecha: '2026-02-01', cliente: 'a' },
      { id: 'dup-1', fecha: '2026-02-02', cliente: 'b' }, // viola la PK
    ],
  }
  const { error } = await sbB.rpc('importar_backup', { p_data: malo })
  if (!error) fail('el import con id duplicado NO falló')
  else ok(`rechazado (${error.code ?? error.message})`)

  const post = await leerTodo(sbB)
  if (idsTrasSeed && JSON.stringify(idsPorTabla(post)) === JSON.stringify(idsTrasSeed)) {
    ok('rollback total: los datos previos siguen intactos')
  } else {
    fail(`los datos NO quedaron como antes del import fallido: ${JSON.stringify(idsPorTabla(post))}`)
  }
}

// ── 4. Payload malformado: rechazado sin tocar nada ──────────────────────────
console.log('\n[4/5] Payload malformado (viajes no es lista):')
{
  const { error } = await sbB.rpc('importar_backup', { p_data: { viajes: 'no-soy-lista' } })
  if (!error) fail('el payload malformado NO fue rechazado')
  else ok(`rechazado (${error.message.slice(0, 60)})`)

  const post = await leerTodo(sbB)
  if (idsTrasSeed && JSON.stringify(idsPorTabla(post)) === JSON.stringify(idsTrasSeed)) {
    ok('los datos siguen intactos')
  } else {
    fail('el payload malformado modificó datos')
  }
}

// ── 5. Restaurar el snapshot original de la org B ─────────────────────────────
console.log('\n[5/5] Restauración del snapshot original (con la misma RPC):')
{
  const { data: resumen, error } = await sbB.rpc('importar_backup', { p_data: snapshot })
  if (error) fail(`restore falló: ${error.message} — ¡la org B quedó con datos del check!`)
  else {
    const post = await leerTodo(sbB)
    const igual = JSON.stringify(idsPorTabla(post)) === JSON.stringify(idsPorTabla(snapshot))
    if (igual) ok(`org B restaurada (${totalSnap} filas): ${JSON.stringify(resumen)}`)
    else fail('la restauración no dejó los mismos ids que el snapshot')
  }
}

await sbB.auth.signOut({ scope: 'local' })

console.log(fallas === 0
  ? '\nTODO OK: importar_backup transaccional verificada.'
  : `\n${fallas} FALLA(S) — revisar arriba.`)
process.exit(fallas === 0 ? 0 : 1)
