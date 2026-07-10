-- Fase 1 — Cerrar la escalada de rol en `crear_empresa()`.
--
-- Hallazgo 2026-07-10 (inspeccionando pg_proc antes de escribir el onboarding):
--
--   crear_empresa(p_nombre text, p_nombre_usuario text) es SECURITY DEFINER
--   (corre como postgres → saltea RLS) y tanto `anon` como `authenticated`
--   tenían EXECUTE. Su cuerpo hacía:
--
--     insert into profiles (id, organization_id, nombre, rol)
--     values (auth.uid(), v_org, ..., 'owner')
--     on conflict (id) do update
--       set organization_id = excluded.organization_id, rol = 'owner';
--
--   El `on conflict do update` es el agujero: un usuario YA existente (por
--   ejemplo un empleado con permisos de solo lectura) podía invocarla y
--   reescribir su propio organization_id y ponerse rol='owner'.
--
--   Eso esquiva por SECURITY DEFINER el mismo invariante que RLS sí protege:
--   un UPDATE directo a profiles.organization_id devuelve 42501 (verificado).
--   No es fuga entre tenants —la org creada es nueva y vacía, no se puede
--   elegir una existente— pero es escalada de rol y salida de la empresa.
--
--   Nada en src/ llama a esta función: estaba dormida y expuesta.
--
-- Fix, en dos partes:
--   1. Revocar EXECUTE de `anon` y de PUBLIC. Un usuario sin sesión no tiene
--      nada que hacer acá (hoy auth.uid() es null y el insert a profiles falla
--      por NOT NULL, así que la transacción aborta — pero no hay razón para
--      dejar la superficie expuesta).
--   2. Reescribir el cuerpo sacando el upsert y agregando dos guardas. Se
--      mantiene EXECUTE para `authenticated` a propósito: es la pieza del
--      onboarding self-service del roadmap, donde un usuario recién registrado
--      —que todavía NO tiene profile— crea su empresa y queda como owner.
--      Con la guarda, un usuario que ya pertenece a una empresa recibe error.
--
-- Es idempotente.

-- ── 1. Cuerpo endurecido ─────────────────────────────────────────────────────
-- El `default null` de p_nombre_usuario se preserva tal cual: sin él, Postgres
-- rechaza el reemplazo con 42P13 ("cannot remove parameter defaults").
create or replace function public.crear_empresa(p_nombre text, p_nombre_usuario text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  -- Guarda 1: sin sesión no se crea nada.
  if auth.uid() is null then
    raise exception 'crear_empresa requiere un usuario autenticado';
  end if;

  -- Guarda 2: el que ya pertenece a una empresa no puede mudarse ni
  -- auto-promoverse. Esto reemplaza al `on conflict (id) do update`.
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'este usuario ya pertenece a una empresa';
  end if;

  insert into public.organizations (nombre) values (p_nombre)
    returning id into v_org;

  insert into public.profiles (id, organization_id, nombre, rol)
    values (auth.uid(), v_org, coalesce(p_nombre_usuario, ''), 'owner');

  insert into public.org_settings (organization_id) values (v_org)
    on conflict (organization_id) do nothing;

  return v_org;
end
$$;

-- ── 2. Permisos ──────────────────────────────────────────────────────────────
-- `create or replace` no resetea el ACL, así que hay que revocar explícito.
revoke execute on function public.crear_empresa(text, text) from public;
revoke execute on function public.crear_empresa(text, text) from anon;

-- authenticated lo conserva (onboarding self-service, protegido por la guarda 2).
grant execute on function public.crear_empresa(text, text) to authenticated;
