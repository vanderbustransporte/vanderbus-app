-- Fase 0 — Cerrar el leak de `ubicaciones_gps`.
--
-- Estado previo (verificado 2026-07-10 con GET anónimo):
--   - 185 filas de posiciones GPS reales de choferes legibles SIN sesión.
--   - Sin organization_id: SeguimientoGPS lee toda la tabla sin filtrar por org.
--
-- ⚠️  IMPORTANTE — ROMPE LA INGESTA DEL TRACKER:
-- El GPSLogger de la Zebra hace POST directo a /rest/v1/ubicaciones_gps con la
-- anon key y SIN usuario logueado. Al activar RLS por organización, ese POST
-- anónimo deja de poder escribir (su org resuelve a null → falla el WITH CHECK).
-- Esto es aceptable AHORA porque el módulo GPS está inactivo/oculto y la tabla
-- está filtrando datos. La ingesta se re-habilita al reactivar el módulo con una
-- de estas dos opciones (Fase 2), NO reabriendo la tabla:
--   a) Edge Function de ingesta (corre con service_role) que valida el
--      dispositivo, le resuelve la empresa y hace el insert. El tracker apunta
--      ahí en vez de a /rest/v1 directo.
--   b) Autenticación por dispositivo (un token/usuario por Zebra) para que RLS
--      pueda resolver su organización.
--
-- Si HOY hubiera un cliente usando GPS en vivo, NO corras esta migración todavía:
-- primero montá la opción (a). Según la auditoría, el módulo está inactivo.
--
-- Es idempotente.

-- ── 1. Columna organization_id ───────────────────────────────────────────────
alter table public.ubicaciones_gps
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
    update public.ubicaciones_gps
       set organization_id = v_org
     where organization_id is null;

  elsif v_count = 0 then
    raise exception 'No hay filas en organizations.';

  else
    if exists (select 1 from public.ubicaciones_gps where organization_id is null) then
      raise exception
        'Hay % organizations y ubicaciones_gps sin organization_id. Asigná el UUID a mano y volvé a correr.',
        v_count;
    end if;
  end if;
end $$;

-- ── 3. NOT NULL ──────────────────────────────────────────────────────────────
-- Sin default con current_org_id(): la escritura futura la hará una Edge Function
-- con service_role (opción a de arriba), que pasa organization_id explícito.
alter table public.ubicaciones_gps
  alter column organization_id set not null;

-- ── 4. RLS + policy de aislamiento por empresa ───────────────────────────────
alter table public.ubicaciones_gps enable row level security;

drop policy if exists tenant_isolation on public.ubicaciones_gps;
create policy tenant_isolation on public.ubicaciones_gps
  for all
  using       (organization_id = public.current_org_id())
  with check  (organization_id = public.current_org_id());
