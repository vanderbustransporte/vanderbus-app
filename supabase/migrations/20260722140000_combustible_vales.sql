-- Vales de combustible / cuenta corriente con estaciones de servicio.
--
-- Escenario (pedido de un cliente): el chofer carga combustible con un "vale"
-- (papel) y NO paga en el momento; la empresa arregla el pago directamente con
-- la estación de servicio y lo rinde a fin de mes. Hasta ahora `combustible`
-- asumía siempre pago al contado. Esta migración agrega, de forma ADITIVA, la
-- forma de pago y el ciclo de vida del vale (pendiente de rendir -> pagado),
-- sin tocar las filas existentes (quedan como 'Contado').
--
-- IMPORTANTE — NO duplica gastos: una carga de combustible YA cuenta como costo
-- (el Dashboard y la Rentabilidad de Finanzas leen la tabla `combustible`
-- directo). Los vales son SOLO una capa de seguimiento de pago —cuánto se le
-- debe a cada estación y qué ya se pagó—; NO generan un "gasto espejo" en
-- `gastos`, justamente para no contar el mismo combustible dos veces.
--
-- El frontend detecta si esta migración está aplicada consultando `forma_pago`
-- (error 42703 = columna inexistente; src/utils/vales.js). Hasta entonces el
-- módulo Combustible oculta la UI de vales y NO manda estas columnas al guardar
-- (un INSERT/UPDATE contra una columna inexistente falla ENTERO en Postgres y
-- la carga se perdería — mismo patrón que despacho y el bug del uuid '').
--
-- Convenciones (ver .claude/skills/vanderbus-app.md): columnas TEXT (legado de
-- montos/fechas como string). No hace falta RLS nueva (heredan las policies de
-- `combustible`), ni tocar importar_backup (inserta por intersección de
-- columnas), ni Realtime (la tabla ya está en la publicación).
--
-- Es idempotente.

alter table public.combustible
  add column if not exists forma_pago             text default 'Contado', -- 'Contado' | 'Vale'
  add column if not exists vale_numero            text,                    -- nº del papel/vale
  add column if not exists vale_estado            text,                    -- 'Pendiente' | 'Pagado' (solo si forma_pago='Vale')
  add column if not exists rendicion_id           text,                    -- id del lote de rendición al pagarse
  add column if not exists rendicion_fecha        text,                    -- fecha de pago de la rendición 'YYYY-MM-DD'
  add column if not exists rendicion_comprobante  text;                    -- nº de resumen/factura de la estación

-- Filas existentes: si el default no las alcanzó, dejarlas como 'Contado'.
update public.combustible set forma_pago = 'Contado' where forma_pago is null;
