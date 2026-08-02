import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// TODO(seguridad): restringir el origen al dominio de la app en vez de '*'.
// Con '*' cualquier pagina puede invocar la funcion desde el browser de un owner
// logueado. No es una via de escalada (el token va en el header Authorization, no
// en una cookie: el browser no lo adjunta solo), pero acota la superficie.
// Cuando el dominio este definido, setear el secret APP_ORIGIN en el dashboard
// (Edge Functions -> Secrets) y usar:
//   'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*'
// Sin hardcodear el dominio aca.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Lista blanca de roles que un owner PUEDE asignar ─────────────────────────
// `profiles.rol` es un binario 'owner' | 'staff' (Usuarios.jsx:293-294,
// AuthContext.jsx:54 `esOwner = rol === 'owner'`). Un owner solo puede crear
// STAFF: la promocion a owner va por el flujo de edicion de Usuarios.jsx, que
// esta cubierto a nivel RLS por 20260715130000_profiles_rol_lock.sql.
// Ojo: 'superadmin' NO es un valor de esta columna — es
// app_metadata.superadmin, que solo se setea con service_role/SQL.
const ROLES_ASIGNABLES = ['staff']

// ── Secciones y niveles validos de `profiles.permisos` ───────────────────────
// Espejo de SECCIONES en src/modules/Usuarios.jsx:9-21. Las lee tiene_permiso()
// (20260715140000_permisos_por_seccion.sql), que devuelve false para cualquier
// clave que no exista: una clave inventada no escala privilegios, solo ensucia
// la base. Por eso se sanea en silencio y no se rechaza el alta.
const SECCIONES = [
  'dashboard', 'viajes', 'combustible', 'mantenimiento', 'vehiculo', 'choferes',
  'nomina', 'finanzas', 'contactos', 'marketing', 'seguimiento',
]
const NIVELES = ['ninguno', 'ver', 'editar']

// Se queda SOLO con las claves de SECCIONES cuyo nivel este en NIVELES.
// Cualquier otra cosa (clave desconocida, nivel invalido, valor no-string,
// permisos que no sea un objeto) se descarta sin romper el alta.
function sanearPermisos(permisos: unknown): Record<string, string> {
  if (!permisos || typeof permisos !== 'object' || Array.isArray(permisos)) return {}
  const entrada = permisos as Record<string, unknown>
  const limpio: Record<string, string> = {}
  for (const seccion of SECCIONES) {
    const nivel = entrada[seccion]
    if (typeof nivel === 'string' && NIVELES.includes(nivel)) limpio[seccion] = nivel
  }
  return limpio
}

// Validacion de forma, no de existencia: algo@algo.tld sin espacios. El chequeo
// de verdad lo hace createUser() de Supabase, que rechaza el mail invalido.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN = 8

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Cliente con el token de quien llama (para saber quien es)
    const authHeader = req.headers.get('Authorization') ?? ''
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userErr } = await asUser.auth.getUser()
    if (userErr || !user) return json({ error: 'No autenticado' }, 401)

    // Quien llama tiene que ser owner de su empresa
    const { data: caller } = await asUser
      .from('profiles')
      .select('organization_id, rol')
      .eq('id', user.id)
      .single()

    if (!caller || caller.rol !== 'owner') {
      return json({ error: 'Solo el dueño puede crear usuarios' }, 403)
    }

    // Datos del nuevo usuario
    const { email, password, nombre, rol, permisos } = await req.json()
    if (!email || !password) return json({ error: 'Faltan email o contraseña' }, 400)

    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return json({ error: 'El email no tiene un formato valido' }, 400)
    }
    if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
      return json({ error: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres` }, 400)
    }

    // Escalada de privilegios: hasta acá el `rol` venia crudo del frontend
    // (`rol: rol ?? 'staff'`), asi que un owner podia crear un segundo owner
    // armando el request a mano. Se valida ANTES de crear nada: si el rol no
    // esta en la lista blanca no se toca auth.users ni profiles.
    const rolNuevo = rol ?? 'staff'
    if (!ROLES_ASIGNABLES.includes(rolNuevo)) {
      return json({
        error: `Rol no permitido: solo se pueden crear usuarios con rol ${ROLES_ASIGNABLES.join(', ')}. ` +
               'Para promover a otro dueño, editá el usuario ya creado.',
      }, 403)
    }

    const permisosNuevo = sanearPermisos(permisos)

    // Cliente admin (llave de servicio, solo vive en el servidor)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

    // Crear el usuario, ya confirmado (sin mail de confirmacion)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    })
    if (createErr) return json({ error: createErr.message }, 400)

    // Crear su perfil en la MISMA empresa que el owner
    const { error: profErr } = await admin.from('profiles').insert({
      id: created.user.id,
      organization_id: caller.organization_id,
      nombre: nombre ?? '',
      rol: rolNuevo,
      permisos: permisosNuevo,
    })

    if (profErr) {
      // si falla el perfil, deshacemos la creacion del usuario
      await admin.auth.admin.deleteUser(created.user.id)
      return json({ error: profErr.message }, 400)
    }

    return json({ ok: true, id: created.user.id }, 200)
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
