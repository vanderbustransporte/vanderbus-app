-- Fase 0 — Cerrar el leak de `oportunidades`.
--
-- Estado previo (verificado 2026-07-10 con GET anónimo a la REST API):
--   - 15 filas legibles SIN sesión (rls_activo = false). Son leads comerciales
--     scrapeados de grupos de Facebook (fuente: google_cse) con texto y links.
--   - Sin organization_id -> cero aislamiento entre empresas.
--   - Tiene una policy `op_auth_all`, pero está DORMIDA porque RLS está
--     desactivado a nivel tabla. Por el nombre es un "todo permitido para
--     authenticated" sin filtro por org: NO se preserva, se droppea (ver §4).
--     Las policies permisivas se combinan con OR; si quedara junto a
--     tenant_isolation, cualquier usuario logueado de cualquier empresa
--     seguiría viendo todas las filas.
--
-- Columnas reales (confirmadas contra la base, coinciden con la spec
-- docs/superpowers/specs/2026-05-29-oportunidades-design.md):
--   id, grupo, texto, zona, link, estado, fuente, notas, created_at, updated_at
--
-- ⚠️  INGESTA: las filas las insertaba un scraper automático (google_cse,
-- vía n8n). Último insert: 2026-06-04 → está INACTIVO hace más de un mes, así
-- que activar RLS hoy no corta nada en vivo. Si el scraper insertaba con la
-- anon key sin sesión, al reactivarlo va a fallar el WITH CHECK (igual que el
-- tracker GPS). Re-habilitarlo como en ubicaciones_gps, NO reabriendo la tabla:
--   a) Edge Function de ingesta (service_role) que resuelve la empresa y pasa
--      organization_id explícito, o
--   b) que n8n use un usuario autenticado de la empresa.
-- El módulo frontend Oportunidades quedó en spec (no existe src/modules/
-- Oportunidades.jsx), así que tampoco hay lecturas de la app que se rompan.
--
-- Es idempotente: se puede correr más de una vez sin romper.

-- ── 1. Columna organization_id ───────────────────────────────────────────────
alter table public.oportunidades
  add column if not exists organization_id uuid references public.organizations(id);

-- ── 2. Backfill (mismo criterio que notificaciones: 1 sola org → se asigna) ───
do $$
declare
  v_org   uuid;
  v_count int;
begin
  select count(*) into v_count from public.organizations;

  if v_count = 1 then
    select id into v_org from public.organizations;
    update public.oportunidades
       set organization_id = v_org
     where organization_id is null;

  elsif v_count = 0 then
    raise exception 'No hay filas en organizations. Creá la empresa antes de esta migración.';

  else
    -- Hay varias empresas: solo es seguro seguir si ya no quedan filas huérfanas.
    if exists (select 1 from public.oportunidades where organization_id is null) then
      raise exception
        'Hay % organizations y oportunidades sin organization_id. Asigná el UUID correcto a mano y volvé a correr.',
        v_count;
    end if;
  end if;
end $$;

-- ── 3. Default + NOT NULL ────────────────────────────────────────────────────
-- El default autocompleta la empresa del usuario logueado, para que el futuro
-- módulo Oportunidades pueda insertar/actualizar sin pasar organization_id.
-- La ingesta con service_role (opción a) resuelve current_org_id() a null:
-- debe pasar organization_id explícito.
alter table public.oportunidades
  alter column organization_id set default public.current_org_id();

alter table public.oportunidades
  alter column organization_id set not null;

-- ── 4. Registrar y droppear op_auth_all ──────────────────────────────────────
-- Antes de borrarla se imprime su definición con RAISE NOTICE, así queda
-- asentada en el output del SQL Editor por si hubiera que reconstruir algo.
-- (No se preserva: una policy sin filtro por organization_id es exactamente el
-- agujero que esta migración cierra.)
do $$
declare
  r record;
begin
  for r in
    select policyname, cmd, roles, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename  = 'oportunidades'
      and policyname = 'op_auth_all'
  loop
    raise notice 'op_auth_all antes de droppear -> cmd: %, roles: %, using: %, with check: %',
      r.cmd, r.roles, r.qual, r.with_check;
  end loop;
end $$;

drop policy if exists op_auth_all on public.oportunidades;

-- ── 5. RLS + policy de aislamiento por empresa ───────────────────────────────
alter table public.oportunidades enable row level security;

drop policy if exists tenant_isolation on public.oportunidades;
create policy tenant_isolation on public.oportunidades
  for all
  using       (organization_id = public.current_org_id())
  with check  (organization_id = public.current_org_id());
