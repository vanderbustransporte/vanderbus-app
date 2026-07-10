-- Fase 0 — Alinear el CHECK de `notificaciones.tipo` con los tipos de la app.
--
-- Bug encontrado 2026-07-10 verificando los flujos post-RLS con usuario real:
--   - chequeoVencimientos inserta notificaciones tipo 'accion' ("datos
--     obligatorios sin cargar") vía crearNotificacion, que es fire-and-forget.
--   - El constraint notificaciones_tipo_check NO incluye 'accion' → el insert
--     falla con 23514 y el error solo se ve como '[notif]' en la consola.
--     El resto de los tipos de TIPO_CONFIG pasan (verificado insertando los 9).
--
-- Este CHECK quedó viejo respecto de src/utils/tipoNotif.js (TIPO_CONFIG), que
-- es la fuente de verdad de los tipos. Si se agrega un tipo nuevo a TIPO_CONFIG,
-- hay que sumarlo acá también.
--
-- Es idempotente.

alter table public.notificaciones
  drop constraint if exists notificaciones_tipo_check;

alter table public.notificaciones
  add constraint notificaciones_tipo_check
  check (tipo in (
    'accion',        -- ← el que faltaba (datos obligatorios / acción requerida)
    'oportunidad',
    'nomina',
    'vencimiento',
    'viaje',
    'gps',
    'finanzas',
    'mantenimiento',
    'sistema'
  ));
