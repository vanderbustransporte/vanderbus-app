-- Auditoría 2026-07-22 — dos fixes sobre la infra GPS/tracking.
--
-- 1. tracking_publico(): la versión de 20260722120000 buscaba la última
--    posición SOLO por alias (`where dispositivo = ali`) y el dispositivo solo
--    por vehiculo_id. `dispositivo` es texto libre: si dos empresas nombran
--    igual a un tracker (ej. "zebra-chofer1"), el link público de un viaje
--    podía devolver la posición del dispositivo de OTRA organización.
--    Fix: ambas subqueries se acotan a la organization_id del viaje.
--
-- 2. Índices para ubicaciones_gps: la tabla recibe ~1 ping cada 30 s por
--    dispositivo y crece sin techo, y NINGUNA query tenía índice:
--      - SeguimientoGPS (realtime): capturado_en >= now()-24h  (+ RLS por org)
--      - detectar-viajes-gps (cron cada 10 min): capturado_en >= now()-30h
--      - tracking_publico: dispositivo = X order by capturado_en desc limit 1
--    Sin índices, todas son seq scan sobre una tabla que solo engorda.
--
-- Es idempotente.

-- ── 1. tracking_publico con aislamiento por org ──────────────────────────────
create or replace function public.tracking_publico(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v   public.viajes%rowtype;
  ali text;
  pos jsonb;
begin
  if p_token is null or length(p_token) < 16 then
    return jsonb_build_object('ok', false);
  end if;

  select * into v
    from public.viajes
   where tracking_token = p_token
     and tracking_activo = true
   limit 1;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  -- Última posición del dispositivo asignado al vehículo del viaje (si hay).
  -- Acotado a la org del viaje: un alias repetido en otra empresa no matchea.
  select d.alias into ali
    from public.dispositivos_gps d
   where d.vehiculo_id = v.vehiculo_id
     and d.organization_id = v.organization_id
   order by d.activo desc, d.ultimo_ping desc nulls last
   limit 1;

  if ali is not null then
    select to_jsonb(u) into pos
      from (
        select lat, lon, velocidad, capturado_en
          from public.ubicaciones_gps
         where dispositivo = ali
           and organization_id = v.organization_id
         order by capturado_en desc
         limit 1
      ) u;
  end if;

  return jsonb_build_object(
    'ok',       true,
    'estado',   v.estado,
    'referencia', v.referencia,
    'origen',   v.origen,
    'destino',  v.destino,
    'fecha',    v.fecha,
    'hora',     v.hora,
    'pos',      pos               -- null si no hay señal reciente
  );
end;
$$;

revoke all on function public.tracking_publico(text) from public;
grant execute on function public.tracking_publico(text) to anon, authenticated;

-- ── 2. Índices de ubicaciones_gps ────────────────────────────────────────────
-- (org, capturado_en): sirve a la carga de 24 h del módulo GPS (RLS agrega el
-- filtro de org) y a la búsqueda de última posición del tracking público.
create index if not exists idx_ubicaciones_gps_org_capturado
  on public.ubicaciones_gps (organization_id, capturado_en);

-- (capturado_en): sirve al barrido global del cron detectar-viajes-gps, que
-- corre con service_role sin filtro de org.
create index if not exists idx_ubicaciones_gps_capturado
  on public.ubicaciones_gps (capturado_en);
