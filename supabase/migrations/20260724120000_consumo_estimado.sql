-- Estimador de consumo de combustible por viaje.
--
-- Idea: con las specs de consumo de la unidad (las del manual del fabricante),
-- el peso de la carga y los km del viaje se puede estimar cuántos litros va a
-- gastar ANTES de salir, y con el precio del litro más reciente, cuánto cuesta.
-- El modelo vive en src/utils/consumo.js; acá sólo van las columnas que le dan
-- de comer.
--
-- Todas text y nullable, mismo criterio legado que el resto (montos como string
-- en la base, parseFloat al leer). Sin defaults: las filas viejas quedan en NULL
-- y el frontend normaliza null → '' al editar.
--
-- Detección desde el frontend (src/utils/consumo.js): se consultan las columnas
-- centinela `vehiculos.consumo_ruta_l100` y `viajes.distancia_km`. Hasta que la
-- migración esté aplicada, la app oculta la sección de consumo y NO manda estos
-- campos al guardar — mandarlos contra una columna inexistente haría fallar el
-- guardado ENTERO del viaje o del vehículo (mismo patrón que el bug del uuid '').
--
-- RLS: sin cambios. Las policies de `vehiculos` y `viajes` son por fila
-- (organization_id) y cubren las columnas nuevas automáticamente.

-- ── Specs de consumo de la unidad ───────────────────────────────────────────
-- consumo_*_l100 son L/100km CON LA UNIDAD VACÍA (a tara). El peso de la carga
-- lo suma el modelo; si acá se cargara el consumo "cargado" se contaría dos
-- veces. `capacidad` (text libre, ej "2000 kg") ya existía y se sigue usando
-- como fallback de carga_max_kg.
alter table public.vehiculos
  add column if not exists consumo_ruta_l100   text,  -- centinela de detección
  add column if not exists consumo_urbano_l100 text,
  add column if not exists tara_kg             text,  -- peso de la unidad vacía
  add column if not exists carga_max_kg        text,  -- carga útil máxima
  add column if not exists motor_desc          text;  -- ej "2.3 dCi G9U 130 cv"

-- ── Datos del viaje que entran al cálculo ───────────────────────────────────
-- `distancia_km` es la distancia del recorrido. Hoy se carga a mano; el día que
-- haya geocoder origen→destino o cierre de viaje por GPS, se autocompleta acá.
alter table public.viajes
  add column if not exists distancia_km text,  -- centinela de detección
  add column if not exists ruta_tipo    text;  -- Urbano | Mixto | Ruta
