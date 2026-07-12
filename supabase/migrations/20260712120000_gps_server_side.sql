-- Fase 2 — GPS server-side (último ítem): ingesta autenticada por dispositivo
-- y detección de viajes movida del browser a una Edge Function con cron.
--
-- Contexto: desde Fase 0 (migración 20260710120100) el POST anónimo del
-- GPSLogger está bloqueado por RLS. Este archivo crea la infraestructura para
-- la opción (a) que quedó anotada allá: Edge Function de ingesta con token por
-- dispositivo. Además, la detección de viajes que hoy corre en el browser de
-- quien abre el Historial (no determinística, con carreras entre visitantes)
-- pasa a una Edge Function `detectar-viajes-gps` agendada cada 10 minutos.
--
-- ⚠️ ORDEN DE DEPLOY (los pasos 2-4 son del dashboard, no de este archivo):
--   1. Correr esta migración en el SQL Editor. Genera el secret del cron en
--      Vault (nombre 'gps_cron_secret') y agenda el job.
--   2. Leer el secret:  select decrypted_secret from vault.decrypted_secrets
--      where name = 'gps_cron_secret';
--      y cargarlo como secret CRON_SECRET de Edge Functions (Settings →
--      Edge Functions → Secrets).
--   3. Deployar las funciones `gps-ingesta` y `detectar-viajes-gps`
--      (supabase/functions/). En AMBAS apagar el toggle "Verify JWT with
--      legacy secret" (el proyecto usa signing keys nuevas; con el toggle
--      prendido el gateway rechaza todo con 401).
--   4. Reconfigurar el GPSLogger de la Zebra: POST a
--      https://<proyecto>.supabase.co/functions/v1/gps-ingesta
--      con header `x-device-token: <token>` (el token se genera desde la
--      pestaña Dispositivos del módulo Seguimiento GPS, se muestra UNA vez).
--
-- Es idempotente.

-- ── 1. Tabla dispositivos_gps ────────────────────────────────────────────────
-- Un registro por tracker físico (ej: la Zebra TC21 del chofer). El token en
-- claro NO se guarda: solo su sha256 hex. La Edge Function de ingesta busca por
-- hash, y el `dispositivo` del ping sale del alias de esta tabla (un tracker
-- no puede hacerse pasar por otro mandando otro nombre en el body).

create table if not exists public.dispositivos_gps (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  alias           text not null,
  token_hash      text not null unique,
  activo          boolean not null default true,
  ultimo_ping     timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.dispositivos_gps enable row level security;

drop policy if exists tenant_isolation on public.dispositivos_gps;
create policy tenant_isolation on public.dispositivos_gps
  for all
  using       (organization_id = public.current_org_id())
  with check  (organization_id = public.current_org_id());

-- ── 2. Dedup determinístico en viajes_gps ────────────────────────────────────
-- La detección server-side es idempotente vía insert .. on conflict do nothing.
-- Antes de crear el unique index, limpiar duplicados exactos que pudiera haber
-- dejado la carrera del cliente (se conserva la fila más vieja).

delete from public.viajes_gps a
using public.viajes_gps b
where a.organization_id = b.organization_id
  and a.patente = b.patente
  and a.inicio  = b.inicio
  and a.created_at > b.created_at;

create unique index if not exists viajes_gps_org_patente_inicio_uniq
  on public.viajes_gps (organization_id, patente, inicio);

-- ── 3. Secret del cron en Vault ──────────────────────────────────────────────
-- Generado acá para que nunca pase por el repo. La Edge Function
-- detectar-viajes-gps exige el header x-cron-secret == CRON_SECRET (paso 2 del
-- deploy). Cualquiera puede conocer la URL de la función; sin el secret solo
-- recibe 401.

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'gps_cron_secret') then
    perform vault.create_secret(encode(gen_random_bytes(24), 'hex'), 'gps_cron_secret');
  end if;
end $$;

-- ── 4. Cron: detección cada 10 minutos ───────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'detectar-viajes-gps') then
    perform cron.unschedule('detectar-viajes-gps');
  end if;
end $$;

select cron.schedule(
  'detectar-viajes-gps',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := 'https://mrfwcfuddvexqixfjnuh.supabase.co/functions/v1/detectar-viajes-gps',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'gps_cron_secret')
    ),
    body    := '{}'::jsonb
  )
  $$
);
