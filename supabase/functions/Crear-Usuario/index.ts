import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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

    // Cliente admin (llave de servicio, solo vive en el servidor)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

    // Crear el usuario, ya confirmado (sin mail de confirmacion)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createErr) return json({ error: createErr.message }, 400)

    // Crear su perfil en la MISMA empresa que el owner
    const { error: profErr } = await admin.from('profiles').insert({
      id: created.user.id,
      organization_id: caller.organization_id,
      nombre: nombre ?? '',
      rol: rol ?? 'staff',
      permisos: permisos ?? {},
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
