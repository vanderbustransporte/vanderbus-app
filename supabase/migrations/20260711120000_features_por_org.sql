-- Fase 2 (auditoría, punto 9) — feature flags por organización.
--
-- Qué habilita: prender/apagar módulos por cliente sin tocar código, en
-- reemplazo del ocultar-por-código (ej. el GPS comentado en el Sidebar).
-- El registro de features y sus defaults vive en src/utils/features.js;
-- acá solo se guarda el override por org: {"seguimiento": true, ...}.
--
-- Dónde viven los flags: en `organizations`, que es SOLO-LECTURA para los
-- tenants (migración 130100). Un cliente puede LEER sus flags (los necesita
-- el frontend para armar el menú) pero no dárselos a sí mismo: los cambia
-- únicamente un superadmin vía las RPCs de abajo.
--
-- Guarda de superadmin: es_superadmin() lee app_metadata.superadmin del JWT.
-- El claim viene firmado por Supabase y app_metadata solo se edita con
-- service_role/SQL, así que no es falsificable desde el cliente. (Mismo flag
-- que valida la Edge Function provisionar-empresa, que lo lee fresco de la
-- base; acá el claim del token alcanza porque revocar un superadmin es un
-- evento rarísimo y el token expira en una hora.)
--
-- Verificación de salida (supabase/checks/features_check.mjs):
--   - anon y un owner común: listar_empresas() y set_org_features() → 42501.
--   - un owner común: SELECT features de su propia org → OK (solo lectura).
--   - superadmin: lista todas las orgs y cambia flags de cualquiera.
--
-- Es idempotente.

alter table public.organizations
  add column if not exists features jsonb not null default '{}'::jsonb;

-- true si el JWT del llamador trae app_metadata.superadmin = true.
create or replace function public.es_superadmin()
returns boolean
language sql
stable
as $$
  select coalesce(((auth.jwt() -> 'app_metadata') ->> 'superadmin')::boolean, false);
$$;

revoke all on function public.es_superadmin() from public, anon;
grant execute on function public.es_superadmin() to authenticated;

-- Listado de todas las orgs para el panel superadmin. RLS solo deja ver la
-- propia org; esta función lo esquiva a propósito (security definer corre
-- como el dueño de la tabla), por eso la guarda explícita es obligatoria.
create or replace function public.listar_empresas()
returns setof public.organizations
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_superadmin() then
    raise exception 'Solo un superadmin puede listar empresas'
      using errcode = '42501';
  end if;
  return query
    select * from public.organizations order by created_at desc;
end;
$$;

revoke all on function public.listar_empresas() from public, anon;
grant execute on function public.listar_empresas() to authenticated;

-- Reemplaza el jsonb completo de flags de una org y devuelve cómo quedó.
create or replace function public.set_org_features(p_org uuid, p_features jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_features jsonb;
begin
  if not public.es_superadmin() then
    raise exception 'Solo un superadmin puede cambiar feature flags'
      using errcode = '42501';
  end if;
  if p_features is null or jsonb_typeof(p_features) <> 'object' then
    raise exception 'p_features debe ser un objeto jsonb';
  end if;
  update public.organizations
     set features = p_features
   where id = p_org
   returning features into v_features;
  if v_features is null then
    raise exception 'No existe la organización %', p_org;
  end if;
  return v_features;
end;
$$;

revoke all on function public.set_org_features(uuid, jsonb) from public, anon;
grant execute on function public.set_org_features(uuid, jsonb) to authenticated;
