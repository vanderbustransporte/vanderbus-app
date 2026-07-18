-- Fase B del plan de producto (docs/plan-producto-tms.md): datos de despacho
-- en viajes — la carga, el chofer/unidad y la custodia que se informan a la
-- otra empresa antes de empezar un viaje.
--
-- Todas las columnas son text y nullable: mismo criterio legado que los montos
-- (strings en la base, parseFloat al leer). Sin defaults: las filas viejas
-- quedan en NULL y el frontend normaliza null → '' al editar.
--
-- El frontend detecta si esta migración está aplicada consultando la columna
-- `carga_tipo` (src/utils/despacho.js). Hasta que se aplique, la app oculta la
-- sección de despacho y NO manda estos campos al guardar (mandarlos contra una
-- columna inexistente haría fallar el guardado entero del viaje).
--
-- RLS: sin cambios — las policies de viajes son por fila (organization_id) y
-- cubren las columnas nuevas automáticamente.

alter table public.viajes
  add column if not exists referencia        text,  -- nro de orden/OC del dador de carga
  add column if not exists destinatario      text,  -- quién recibe en destino
  add column if not exists carga_tipo        text,  -- sentinel de detección del frontend
  add column if not exists carga_bultos      text,
  add column if not exists carga_peso_kg     text,
  add column if not exists carga_volumen_m3  text,
  add column if not exists carga_valor       text,  -- valor declarado ($)
  add column if not exists chofer_nombre     text,
  add column if not exists chofer_dni        text,
  add column if not exists chofer_cel        text,
  add column if not exists patente_semi      text,
  add column if not exists custodia_tipo     text,  -- Satelital | Física | Satelital + física
  add column if not exists custodia_empresa  text,
  add column if not exists custodia_contacto text,
  add column if not exists satelital_empresa text,
  add column if not exists satelital_equipo  text,  -- ID del equipo satelital de la unidad
  add column if not exists precintos         text;  -- números, separados por coma
