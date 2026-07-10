-- Fase 0 — Cerrar el leak de `notificaciones`.
--
-- Estado previo (verificado 2026-07-10 con GET anónimo a la REST API):
--   - La tabla NO tiene organization_id -> cero aislamiento entre empresas.
--   - Es legible sin sesión (RLS ausente) -> leak a internet.
--
-- Esta migración: agrega organization_id, hace backfill, y activa RLS con la
-- misma policy tenant_isolation que el resto de las tablas.
--
-- Es idempotente: se puede correr más de una vez sin romper.

-- ── 0. Helper current_org_id() (defensivo: ya debería existir) ────────────────
-- Otras tablas ya lo usan, así que normalmente esto no hace nada. Se incluye
-- para que la migración sea autocontenida si se aplica en un ambiente limpio
-- (ej. el proyecto de staging que crea la Fase 1).
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'current_org_id' and n.nspname = 'public'
  ) then
    create function public.current_org_id() returns uuid
      language sql stable security definer
      set search_path = public
    as $fn$ select organization_id from public.profiles where id = auth.uid() $fn$;
  end if;
end $$;

-- ── 1. Columna organization_id ───────────────────────────────────────────────
alter table public.notificaciones
  add column if not exists organization_id uuid references public.organizations(id);

-- ── 2. Backfill de las filas existentes ──────────────────────────────────────
-- Las notificaciones huérfanas no tienen forma de saber a qué empresa pertenecen.
-- Mientras haya UNA sola organización (Vanderbus, pre-multicliente) se asignan a
-- esa. Si hay 0 o varias, se aborta para NO adivinar: en ese caso, fijá el UUID
-- a mano abajo y volvé a correr.
do $$
declare
  v_org   uuid;
  v_count int;
begin
  select count(*) into v_count from public.organizations;

  if v_count = 1 then
    select id into v_org from public.organizations;
    update public.notificaciones
       set organization_id = v_org
     where organization_id is null;

  elsif v_count = 0 then
    raise exception 'No hay filas en organizations. Creá la empresa antes de esta migración.';

  else
    -- Hay varias empresas: solo es seguro seguir si ya no quedan filas huérfanas.
    if exists (select 1 from public.notificaciones where organization_id is null) then
      raise exception
        'Hay % organizations y notificaciones sin organization_id. Asigná el UUID correcto a mano y volvé a correr.',
        v_count;
    end if;
  end if;
end $$;

-- ── 3. Default + NOT NULL ────────────────────────────────────────────────────
-- El default autocompleta la empresa del usuario logueado, así los inserts del
-- frontend (crearNotificacion, que hoy NO manda organization_id) siguen andando
-- sin tocar el código en Fase 0.
--
-- Nota: un insert sin JWT (SQL Editor como postgres, o una Edge Function con
-- service_role) resuelve current_org_id() a null y viola el NOT NULL. Esos casos
-- deben pasar organization_id explícito.
alter table public.notificaciones
  alter column organization_id set default public.current_org_id();

alter table public.notificaciones
  alter column organization_id set not null;

-- ── 4. RLS + policy de aislamiento por empresa ───────────────────────────────
alter table public.notificaciones enable row level security;

drop policy if exists tenant_isolation on public.notificaciones;
create policy tenant_isolation on public.notificaciones
  for all
  using       (organization_id = public.current_org_id())
  with check  (organization_id = public.current_org_id());
