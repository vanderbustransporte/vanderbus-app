-- Fase D — Link público de seguimiento por viaje.
--
-- Objetivo: que el dador/cliente pueda ver el estado y la última posición de UN
-- viaje sin loguearse, con un link que se le comparte (capability URL con token
-- aleatorio de 128 bits). NO reabre el leak histórico de `ubicaciones_gps`: la
-- página pública NO lee tablas con la anon key (RLS le devuelve []). Todo pasa
-- por una única función `tracking_publico(token)` security definer que devuelve
-- SÓLO campos curados de ese viaje: estado, ruta, fecha y la última posición del
-- dispositivo asignado. Nunca montos, ni cliente, ni chofer, ni datos de otra org.
--
-- El owner activa/desactiva el link desde el módulo Viajes (columna tracking_activo).
-- Desactivar corta el acceso al instante aunque el link ya esté compartido.
--
-- La UI se auto-habilita al detectar la columna `tracking_token` (mismo patrón de
-- runtime-detection que despacho y choferes: 42703 = migración sin aplicar).
--
-- Es idempotente.

-- ── 1. Columnas en viajes ────────────────────────────────────────────────────
-- tracking_token: secreto del link, nullable (un viaje sin link no tiene token).
-- tracking_activo: interruptor. El token puede seguir existiendo pero apagado.

alter table public.viajes
  add column if not exists tracking_token  text,
  add column if not exists tracking_activo boolean not null default false;

-- Un token identifica UN viaje. Índice único parcial (sólo filas con token) —
-- así los miles de viajes sin link no comparten un único NULL bajo un unique común.
create unique index if not exists viajes_tracking_token_uniq
  on public.viajes (tracking_token)
  where tracking_token is not null;

-- ── 2. Función pública de seguimiento ────────────────────────────────────────
-- security definer para saltear RLS, pero acotada: filtra por token + activo y
-- devuelve un jsonb curado. search_path vacío + nombres calificados con schema
-- para que no se pueda secuestrar la resolución de nombres.

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
  select d.alias into ali
    from public.dispositivos_gps d
   where d.vehiculo_id = v.vehiculo_id
   order by d.activo desc, d.ultimo_ping desc nulls last
   limit 1;

  if ali is not null then
    select to_jsonb(u) into pos
      from (
        select lat, lon, velocidad, capturado_en
          from public.ubicaciones_gps
         where dispositivo = ali
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

-- La página pública corre sin sesión (rol anon). authenticated también la usa
-- para la vista previa desde la app. public queda sin acceso directo por prolijidad.
revoke all on function public.tracking_publico(text) from public;
grant execute on function public.tracking_publico(text) to anon, authenticated;
