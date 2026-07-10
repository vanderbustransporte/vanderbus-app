// Edge Function: provisionar-empresa
//
// Alta atómica de un cliente nuevo (Fase 1 de la auditoría, Área 2): crea el
// auth.user del owner + organizations + profiles (rol owner) + org_settings,
// reemplazando el ritual manual del SQL Editor.
//
// Seguridad:
//   - Corre con service_role (solo en los servidores de Supabase, NUNCA en el
//     frontend), igual que Crear-Usuario.
//   - Solo puede invocarla un usuario cuyo auth.user tenga
//     app_metadata.superadmin = true. Ese flag NO lo puede tocar el usuario
//     (app_metadata solo se edita con service_role o desde el dashboard).
//     Para marcarse superadmin (una vez, en el SQL Editor):
//       update auth.users
//          set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb)
//                                  || '{"superadmin": true}'::jsonb
//        where email = 'EMAIL-DEL-ADMIN';
//
// Atomicidad: organizations + profiles + org_settings van en UNA transacción
// (función SQL provisionar_empresa, migración 20260710130200). El auth.user se
// crea antes por la Admin API; si la transacción falla, se borra (compensación)
// para no dejar clientes a medias.
//
// Invocación (desde una sesión superadmin):
//   const { data, error } = await supabase.functions.invoke('provisionar-empresa', {
//     body: { empresa: 'Transportes X', email: 'owner@x.com', nombre: 'Juan' }
//   })
//   → { organization_id, user_id, email, password }  (password solo si se generó)
//
// Deploy: dashboard → Edge Functions → Deploy new function → nombre
// "provisionar-empresa" → pegar este archivo. O con CLI:
//   supabase functions deploy provisionar-empresa --project-ref <ref>

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// Contraseña inicial del owner si no se pasa una (CSPRNG, como genPassword del front).
function genPassword(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    // ── 1. Autenticación: solo superadmins ────────────────────────────────────
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return json(401, { error: 'Falta el token de sesión' })

    // getUser(jwt) valida el token y trae el registro FRESCO del auth server,
    // así el flag superadmin se lee de la base, no del claim viejo del JWT.
    const { data: caller, error: eCaller } = await admin.auth.getUser(jwt)
    if (eCaller || !caller?.user) return json(401, { error: 'Token inválido' })
    if (caller.user.app_metadata?.superadmin !== true) {
      return json(403, { error: 'Solo un superadmin puede provisionar empresas' })
    }

    // ── 2. Input ──────────────────────────────────────────────────────────────
    const { empresa, email, nombre, password } = await req.json()
    if (!empresa?.trim() || !email?.trim()) {
      return json(400, { error: 'Campos obligatorios: empresa, email' })
    }

    // ── 3. Crear el auth.user del owner ───────────────────────────────────────
    const pass = password ?? genPassword()
    const { data: nuevo, error: eUser } = await admin.auth.admin.createUser({
      email: email.trim(),
      password: pass,
      email_confirm: true, // alta administrada: sin mail de confirmación
    })
    if (eUser) return json(409, { error: `No se pudo crear el usuario: ${eUser.message}` })

    // ── 4. Org + profile + settings en una transacción ────────────────────────
    const { data: orgId, error: eProv } = await admin.rpc('provisionar_empresa', {
      p_nombre_empresa: empresa.trim(),
      p_owner_id: nuevo.user.id,
      p_nombre_owner: nombre ?? '',
    })
    if (eProv) {
      // Compensación: no dejar un auth.user huérfano sin empresa.
      await admin.auth.admin.deleteUser(nuevo.user.id)
      return json(500, { error: `Alta revertida: ${eProv.message}` })
    }

    return json(200, {
      organization_id: orgId,
      user_id: nuevo.user.id,
      email: email.trim(),
      // Solo se devuelve si la generamos acá (para entregársela al cliente).
      ...(password ? {} : { password: pass }),
    })
  } catch (e) {
    return json(500, { error: `Error inesperado: ${e instanceof Error ? e.message : String(e)}` })
  }
})
