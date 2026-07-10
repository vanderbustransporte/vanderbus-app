-- Fase 1 — Función transaccional de alta de empresa (para la Edge Function
-- `provisionar-empresa`).
--
-- Problema (auditoría 2026-07-10, Área 2): el alta de un cliente nuevo es
-- artesanal (SQL Editor a mano): crear org, crear auth.user, crear profile,
-- crear org_settings. Cualquier paso olvidado deja un cliente a medias.
--
-- División de responsabilidades:
--   - La Edge Function (supabase/functions/provisionar-empresa/) crea el
--     auth.user del owner con la Admin API y valida que quien invoca sea
--     superadmin. Si esta función SQL falla, borra el auth.user (compensación).
--   - Esta función hace el resto en UNA transacción: organizations + profiles
--     (rol owner) + org_settings. O entra todo, o no entra nada.
--
-- Es la prima administrada de crear_empresa() (self-service): aquella usa
-- auth.uid() (el propio usuario logueado se crea su empresa); esta recibe el
-- owner por parámetro porque la llama service_role en nombre de un usuario
-- recién creado que todavía no tiene sesión.
--
-- Solo service_role puede ejecutarla (REVOKE de todo lo demás).
--
-- Es idempotente (create or replace + revoke/grant re-ejecutables).

create or replace function public.provisionar_empresa(
  p_nombre_empresa text,
  p_owner_id uuid,
  p_nombre_owner text default ''
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if p_owner_id is null then
    raise exception 'provisionar_empresa: falta p_owner_id';
  end if;
  if coalesce(trim(p_nombre_empresa), '') = '' then
    raise exception 'provisionar_empresa: falta p_nombre_empresa';
  end if;

  -- Mismo invariante que crear_empresa(): un usuario con profile ya pertenece
  -- a una empresa y no puede mudarse ni re-promoverse.
  if exists (select 1 from public.profiles where id = p_owner_id) then
    raise exception 'provisionar_empresa: el usuario ya pertenece a una empresa';
  end if;

  insert into public.organizations (nombre)
    values (trim(p_nombre_empresa))
    returning id into v_org;

  insert into public.profiles (id, organization_id, nombre, rol)
    values (p_owner_id, v_org, coalesce(p_nombre_owner, ''), 'owner');

  insert into public.org_settings (organization_id)
    values (v_org)
    on conflict (organization_id) do nothing;

  return v_org;
end
$$;

revoke all on function public.provisionar_empresa(text, uuid, text) from public;
revoke all on function public.provisionar_empresa(text, uuid, text) from anon;
revoke all on function public.provisionar_empresa(text, uuid, text) from authenticated;
grant execute on function public.provisionar_empresa(text, uuid, text) to service_role;
