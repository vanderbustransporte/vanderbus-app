-- Fase 0 — Cerrar el leak de `ubicaciones` (la v1 abandonada del tracker GPS).
--
-- OJO: esta tabla NO es `ubicaciones_gps` (esa se cerró en 20260710120100).
-- Es la iteración anterior del tracker, hoy abandonada.
--
-- Estado previo (verificado 2026-07-10 con GET anónimo a la REST API):
--   - 15 filas legibles SIN sesión: posiciones GPS reales (chofer "Nico",
--     patente GOT170, lat/lng con precisión de 20 m).
--   - Columnas: id, chofer, patente, lat, lng, velocidad, precision_m, created_at.
--     Sin organization_id.
--   - Policies de SELECT e INSERT abiertas a `public` sin condición
--     (using/with_check = true): eran para que el GPSLogger posteara sin sesión.
--
-- ¿Rompe algo cerrarla? No:
--   - Último insert: 2026-05-29 → el tracker fue migrado a `ubicaciones_gps`
--     (es el destino documentado en ARQUITECTURA.md) y esta tabla quedó muerta.
--   - Cero referencias en src/ (el módulo lee ubicaciones_gps) y el código que
--     la usaba se eliminó del repo (ver git log -S "from('ubicaciones')").
--   - Si alguna Zebra siguiera con el perfil viejo de GPSLogger apuntando a
--     /rest/v1/ubicaciones, sus POST van a empezar a fallar: correcto — debe
--     apuntar a la ingesta nueva (ver opciones a/b en la migración de
--     ubicaciones_gps), no a una tabla abierta.
--
-- Sin default current_org_id(): nada de la app escribe acá (mismo criterio que
-- ubicaciones_gps: si se reactivara una ingesta, pasa organization_id explícito).
--
-- Es idempotente.

-- ── 1. Columna organization_id ───────────────────────────────────────────────
alter table public.ubicaciones
  add column if not exists organization_id uuid references public.organizations(id);

-- ── 2. Backfill (mismo criterio que las anteriores: 1 sola org → se asigna) ───
do $$
declare
  v_org   uuid;
  v_count int;
begin
  select count(*) into v_count from public.organizations;

  if v_count = 1 then
    select id into v_org from public.organizations;
    update public.ubicaciones
       set organization_id = v_org
     where organization_id is null;

  elsif v_count = 0 then
    raise exception 'No hay filas en organizations.';

  else
    if exists (select 1 from public.ubicaciones where organization_id is null) then
      raise exception
        'Hay % organizations y ubicaciones sin organization_id. Asigná el UUID a mano y volvé a correr.',
        v_count;
    end if;
  end if;
end $$;

-- ── 3. NOT NULL ──────────────────────────────────────────────────────────────
alter table public.ubicaciones
  alter column organization_id set not null;

-- ── 4. Registrar y droppear TODAS las policies abiertas ──────────────────────
-- Los nombres exactos no están en control de versiones; se droppean todas las
-- que existan (menos tenant_isolation, por idempotencia), dejando su definición
-- asentada en el output del SQL Editor con RAISE NOTICE.
do $$
declare
  r record;
begin
  for r in
    select policyname, cmd, roles, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename  = 'ubicaciones'
      and policyname <> 'tenant_isolation'
  loop
    raise notice 'droppeando policy % -> cmd: %, roles: %, using: %, with check: %',
      r.policyname, r.cmd, r.roles, r.qual, r.with_check;
    execute format('drop policy %I on public.ubicaciones', r.policyname);
  end loop;
end $$;

-- ── 5. RLS + policy de aislamiento por empresa ───────────────────────────────
alter table public.ubicaciones enable row level security;

drop policy if exists tenant_isolation on public.ubicaciones;
create policy tenant_isolation on public.ubicaciones
  for all
  using       (organization_id = public.current_org_id())
  with check  (organization_id = public.current_org_id());
