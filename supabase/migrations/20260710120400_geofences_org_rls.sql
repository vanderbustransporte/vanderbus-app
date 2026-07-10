-- Fase 0 — Cerrar `geofences` (tabla huérfana, nunca usada).
--
-- Estado previo (verificado 2026-07-10 con GET anónimo a la REST API):
--   - 0 filas, pero legible y ESCRIBIBLE sin sesión: una policy ALL abierta a
--     `public` sin condición. Cualquiera con la anon key podía insertar.
--   - Sin organization_id. Columnas detectadas por sondeo REST (parcial):
--     id, nombre, radio_m, activo, created_at.
--   - Cero referencias en src/, docs y todo el historial de git: es un
--     experimento de geocercas que nunca llegó al código.
--
-- Se cierra con el mismo patrón que el resto en vez de borrarla, para no perder
-- el schema si el módulo GPS la retoma en Fase 2. Si se decide que no va más,
-- `drop table public.geofences` es la alternativa simple.
--
-- Con default current_org_id(): si el futuro módulo GPS crea geocercas desde el
-- frontend, el insert autocompleta la empresa del usuario logueado.
--
-- Es idempotente.

-- ── 1. Columna organization_id ───────────────────────────────────────────────
alter table public.geofences
  add column if not exists organization_id uuid references public.organizations(id);

-- ── 2. Backfill ───────────────────────────────────────────────────────────────
-- Hoy es un no-op (0 filas); se deja la guarda estándar por idempotencia.
do $$
declare
  v_org   uuid;
  v_count int;
begin
  select count(*) into v_count from public.organizations;

  if v_count = 1 then
    select id into v_org from public.organizations;
    update public.geofences
       set organization_id = v_org
     where organization_id is null;

  elsif v_count = 0 then
    raise exception 'No hay filas en organizations.';

  else
    if exists (select 1 from public.geofences where organization_id is null) then
      raise exception
        'Hay % organizations y geofences sin organization_id. Asigná el UUID a mano y volvé a correr.',
        v_count;
    end if;
  end if;
end $$;

-- ── 3. Default + NOT NULL ────────────────────────────────────────────────────
alter table public.geofences
  alter column organization_id set default public.current_org_id();

alter table public.geofences
  alter column organization_id set not null;

-- ── 4. Registrar y droppear TODAS las policies abiertas ──────────────────────
-- (misma técnica que ubicaciones: nombres no versionados → se droppean todas
-- menos tenant_isolation, dejando su definición en el output con RAISE NOTICE)
do $$
declare
  r record;
begin
  for r in
    select policyname, cmd, roles, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename  = 'geofences'
      and policyname <> 'tenant_isolation'
  loop
    raise notice 'droppeando policy % -> cmd: %, roles: %, using: %, with check: %',
      r.policyname, r.cmd, r.roles, r.qual, r.with_check;
    execute format('drop policy %I on public.geofences', r.policyname);
  end loop;
end $$;

-- ── 5. RLS + policy de aislamiento por empresa ───────────────────────────────
alter table public.geofences enable row level security;

drop policy if exists tenant_isolation on public.geofences;
create policy tenant_isolation on public.geofences
  for all
  using       (organization_id = public.current_org_id())
  with check  (organization_id = public.current_org_id());
