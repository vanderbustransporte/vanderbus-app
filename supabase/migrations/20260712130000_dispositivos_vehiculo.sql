-- Vincular cada tracker GPS con el vehículo que lleva puesto.
--
-- Sin este vínculo el mapa no puede mostrar datos del camión al tocar una
-- ruta (viajes_gps.patente guarda el ALIAS del dispositivo, no un vehículo).
-- Se asigna desde la pestaña Dispositivos del módulo Seguimiento GPS.
-- Nullable a propósito: un tracker recién dado de alta todavía no tiene
-- vehículo asignado y la ingesta no debe romperse por eso.
--
-- Es idempotente.

alter table public.dispositivos_gps
  add column if not exists vehiculo_id uuid references public.vehiculos(id);
