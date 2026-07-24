-- Ficha técnica extendida por unidad + insumos de calibración del estimador.
--
-- Contexto: la migración 20260724120000 dejó lo mínimo para estimar (consumo
-- urbano/ruta vacío, tara, carga útil). Esta agrega lo que hace que el número
-- deje de ser una referencia de catálogo y pase a ser el de ESTA unidad:
--
--   1. De dónde salió el consumo declarado (`fuente_consumo`). No es un detalle
--      de UI: un consumo HOMOLOGADO de un liviano está sistemáticamente por
--      debajo del real (10–25% en uso urbano argentino) y hay que corregirlo;
--      un pesado directamente no tiene homologación publicada — Scania, Volvo,
--      Mercedes e Iveco no publican L/100km porque depende del diferencial, la
--      carrocería y el uso — así que ahí el valor siempre es benchmark o
--      declaración del transportista. El factor de corrección por fuente vive
--      en src/data/clases.js y se muestra en los supuestos del estimado.
--   2. Clase explícita (auto → tractor con semi). Antes se deducía de la tara,
--      que no distingue un auto de una pickup. La declarada gana.
--   3. Carrocería y topografía: entran como factor multiplicativo, NO por masa.
--      Un furgón cerrado y un playo vacío pesan igual y no consumen igual, pero
--      la diferencia es aerodinámica y sólo aparece arriba de ~70 km/h: por eso
--      el factor se aplica sobre el tramo de ruta y no sobre el urbano.
--   4. Ralentí: litros/hora con el motor detenido. Rara vez está en la ficha; si
--      falta se estima por clase y cilindrada y se declara como estimado.
--   5. `combustible.tanque_lleno`: SOLO las cargas de tanque lleno a tanque
--      lleno dan un consumo medible. Sin este flag, una carga parcial da un
--      L/100km absurdo y envenena el promedio de la unidad entera. Es el insumo
--      del motor de calibración (src/utils/calibracion.js).
--
-- Detección desde el frontend (src/utils/consumo.js → fichaExtDisponible()):
-- se consultan las columnas centinela `vehiculos.fuente_consumo` y
-- `combustible.tanque_lleno`. Hasta que esta migración esté aplicada la app
-- oculta los campos nuevos y NO los manda al guardar — un INSERT/UPDATE contra
-- una columna inexistente falla ENTERO en Postgres (mismo patrón que despacho,
-- vales y la migración de consumo anterior).
--
-- Todas TEXT y nullable (legado: montos y medidas como string, parseFloat al
-- leer). Sin defaults salvo donde hace falta. RLS: sin cambios — las policies de
-- `vehiculos`, `viajes` y `combustible` son por fila (organization_id) y cubren
-- las columnas nuevas automáticamente.
--
-- Es idempotente.

-- ── Ficha técnica de la unidad ──────────────────────────────────────────────
alter table public.vehiculos
  -- Identificación y clase
  add column if not exists clase                text,  -- auto | pickup | furgon | chasis_liviano | chasis_mediano | camion_pesado | tractor_semi
  -- Motor
  add column if not exists motor_cilindrada_l   text,  -- litros, ej '2.3'
  add column if not exists motor_potencia_cv    text,
  add column if not exists motor_torque_nm      text,
  add column if not exists motor_combustible    text,  -- diesel | nafta | gnc | hibrido
  add column if not exists norma_emision        text,  -- ej 'Euro V'
  add column if not exists transmision          text,  -- manual | automatica | automatizada
  add column if not exists relacion_diferencial text,  -- ej '3.42'
  -- Consumo declarado
  add column if not exists consumo_mixto_l100   text,
  add column if not exists fuente_consumo       text,  -- centinela de detección
                                                       -- homologado | fabricante | benchmark_flota | estimado_clase
  -- Pesos y carrocería
  add column if not exists pbt_kg               text,  -- peso bruto total admitido
  add column if not exists carroceria           text,  -- playo | con_lona | furgon_cerrado | tanque | portacontenedor | volcador | n_a
  add column if not exists tanque_l             text,  -- capacidad del tanque
  -- Ralentí
  add column if not exists consumo_ralenti_lh   text,  -- litros/hora con el motor detenido
  add column if not exists consumo_ralenti_est  text;  -- 'si' = lo estimó la app, no salió de la ficha

-- ── Datos del viaje ─────────────────────────────────────────────────────────
-- `horas_ralenti` se carga a mano. El hook para alimentarlo desde el GPS queda
-- preparado en el frontend, pero el módulo GPS está en pausa y no es confiable:
-- el estimador NO depende de él.
alter table public.viajes
  add column if not exists topografia    text,  -- llano | ondulado | montana
  add column if not exists horas_ralenti text;  -- horas de motor detenido previstas

-- ── Carga de combustible: ¿fue a tanque lleno? ──────────────────────────────
-- 'si' | 'no' | null (null = no se declaró; NO se usa para calibrar).
alter table public.combustible
  add column if not exists tanque_lleno text;
