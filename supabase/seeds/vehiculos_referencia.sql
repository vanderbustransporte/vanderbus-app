-- Siembra del catálogo de referencia global `vehiculos_referencia`.
--
-- ⚠️ ESTE ARCHIVO ARRANCA VACÍO A PROPÓSITO. No trae ni una spec real.
-- Se llena a mano, cruzando cada fila contra la FICHA TÉCNICA REAL de la
-- terminal (o el manual del fabricante). Nada de "rango de mercado": si un dato
-- no está en la ficha, va NULL, no se estima.
--
-- ── Cómo se corre ────────────────────────────────────────────────────────────
-- La tabla es de escritura SÓLO para service_role (ver la migración
-- 20260727120000_vehiculos_referencia.sql). Entonces:
--   • SQL editor del dashboard de Supabase (corre como `postgres`, bypassea RLS), o
--   • psql / script con la service_role key.
-- Desde el cliente con la anon key NO se puede insertar (es justamente el punto).
--
-- Es idempotente por diseño: el ON CONFLICT infiere el MISMO índice único de la
-- migración por sus columnas (las normalizadas). marca_norm / modelo_norm /
-- version_norm son GENERATED, así que no se listan en el INSERT, pero SÍ se usan
-- como conflict target (son columnas del índice). Reejecutar actualiza, no duplica.
-- (Se infiere por columnas y no `on constraint`: es un índice único, no una
-- constraint con nombre.)
--
-- ── Reglas de las columnas ───────────────────────────────────────────────────
--   marca, modelo, anio, version → OBLIGATORIAS (son la clave). `version` no
--       puede faltar: si la ficha no distingue versión, poné la que figure en la
--       ficha ('Base', el código de chasis, etc.), nunca ''.
--   consumo_*_l100 → L/100km CON LA UNIDAD VACÍA (a tara). NO km/L.
--   fuente_consumo → cómo se obtuvo el L/100km (dispara la corrección del
--       estimador): 'homologado' (livianos con ciclo oficial), 'fabricante',
--       'benchmark_flota' (pesados, no hay homologación publicada), 'estimado_clase'.
--       OJO: es distinto de `fuente` (de qué documento salió la ficha entera).
--   clase → auto|pickup|furgon|chasis_liviano|chasis_mediano|camion_pesado|tractor_semi
--   carroceria → playo|con_lona|furgon_cerrado|tanque|portacontenedor|volcador|n_a
--       REGLA: en `tractor_semi` va SIEMPRE **NULL**, nunca el string 'n_a'. El
--       tractor no tiene carrocería propia: la aporta el semirremolque, que
--       cambia por cliente y por viaje. El estimador ya resuelve el faltante solo
--       (consumo.js hace `v.carroceria || 'n_a'`, y en clases.js 'n_a' es factor
--       1.00), así que NULL da el MISMO número que 'n_a' — pero NULL dice "no se
--       sabe" y 'n_a' afirma "no aplica" como si fuera dato curado.
--   verificado → false hasta que una segunda persona haga el doble check contra
--       la ficha. Recién ahí pasa a true + verificado_por.
--
-- ── De dónde salen los primeros datos ────────────────────────────────────────
-- src/data/motores.js tiene 27 configuraciones ya cargadas en la app, PERO no
-- tienen `anio` ni `version` (la mitad de la clave) y sus consumos/pesos son de
-- rango genérico, no de ficha. Sirven como pista para saber qué modelos cargar
-- primero, NO para copiar y pegar. Cada fila que venga de ahí entra
-- extraido_por='humano', verificado=false, y se completa anio+version+specs
-- reales desde la ficha de la terminal antes de darla por buena.

-- ─────────────────────────────────────────────────────────────────────────────
-- PLANTILLA — descomentar, duplicar y completar con datos de ficha real.
-- (Ejemplo ilustrativo con specs FICTICIAS; NO usar estos números.)
-- ─────────────────────────────────────────────────────────────────────────────

-- insert into public.vehiculos_referencia (
--   marca, modelo, anio, version,
--   clase, motor, cilindrada_l, potencia_cv, tipo_combustible,
--   consumo_urbano_l100, consumo_ruta_l100, consumo_mixto_l100,
--   fuente_consumo, capacidad_tanque_l, carroceria,
--   pbt_kg, tara_kg, carga_util_kg,
--   fuente, fuente_url, pagina, fecha_extraccion,
--   extraido_por, verificado, verificado_por, notas
-- ) values (
--   'Marca',            -- marca            (obligatorio)
--   'Modelo',           -- modelo           (obligatorio)
--   2023,               -- anio             (obligatorio)
--   'Versión',          -- version          (obligatorio, nunca '')
--   NULL,               -- clase            (← estimador)
--   NULL,               -- motor            (ej '2.3 dCi 130 cv')
--   NULL,               -- cilindrada_l     (← estimador)
--   NULL,               -- potencia_cv
--   NULL,               -- tipo_combustible (diesel|nafta|gnc|hibrido)
--   NULL,               -- consumo_urbano_l100  (L/100km vacío)
--   NULL,               -- consumo_ruta_l100    (L/100km vacío)
--   NULL,               -- consumo_mixto_l100   (L/100km vacío)
--   NULL,               -- fuente_consumo   (homologado|fabricante|benchmark_flota|estimado_clase)
--   NULL,               -- capacidad_tanque_l
--   NULL,               -- carroceria
--   NULL,               -- pbt_kg           (de la ficha; NO calcular tara+carga)
--   NULL,               -- tara_kg          (← estimador)
--   NULL,               -- carga_util_kg    (← estimador)
--   NULL,               -- fuente           (de qué documento salió, ej 'Manual 2023')
--   NULL,               -- fuente_url
--   NULL,               -- pagina
--   current_date,       -- fecha_extraccion
--   'humano',           -- extraido_por     (humano|ia)
--   false,              -- verificado       (true sólo tras el doble check)
--   NULL,               -- verificado_por
--   NULL                -- notas
-- )
-- on conflict (marca_norm, modelo_norm, anio, version_norm) do update set
--   clase = excluded.clase,
--   motor = excluded.motor,
--   cilindrada_l = excluded.cilindrada_l,
--   potencia_cv = excluded.potencia_cv,
--   tipo_combustible = excluded.tipo_combustible,
--   consumo_urbano_l100 = excluded.consumo_urbano_l100,
--   consumo_ruta_l100 = excluded.consumo_ruta_l100,
--   consumo_mixto_l100 = excluded.consumo_mixto_l100,
--   fuente_consumo = excluded.fuente_consumo,
--   capacidad_tanque_l = excluded.capacidad_tanque_l,
--   carroceria = excluded.carroceria,
--   pbt_kg = excluded.pbt_kg,
--   tara_kg = excluded.tara_kg,
--   carga_util_kg = excluded.carga_util_kg,
--   fuente = excluded.fuente,
--   fuente_url = excluded.fuente_url,
--   pagina = excluded.pagina,
--   fecha_extraccion = excluded.fecha_extraccion,
--   extraido_por = excluded.extraido_por,
--   verificado = excluded.verificado,
--   verificado_por = excluded.verificado_por,
--   notas = excluded.notas;


-- ═════════════════════════════════════════════════════════════════════════════
-- TANDA 1 — camiones + Sprinter. Datos de BÚSQUEDA WEB con fuente citada.
--
-- ⚠️ TODAS con verificado=false: hay que cruzar cada fila contra el MANUAL
--    OFICIAL de la terminal antes de pasarla a true + verificado_por.
-- ⚠️ consumo_* en NULL a propósito: no hay L/100km homologado publicado para
--    estos y NO se inventa. Como no hay consumo, fuente_consumo también va NULL.
-- Idempotente: ON CONFLICT infiere el índice único por columnas normalizadas.
-- ═════════════════════════════════════════════════════════════════════════════
insert into public.vehiculos_referencia (
  marca, modelo, anio, version,
  clase, motor, cilindrada_l, potencia_cv, tipo_combustible,
  consumo_urbano_l100, consumo_ruta_l100, consumo_mixto_l100,
  fuente_consumo, capacidad_tanque_l, carroceria,
  pbt_kg, tara_kg, carga_util_kg,
  fuente, fuente_url, pagina, fecha_extraccion,
  extraido_por, verificado, verificado_por, notas
) values

  -- OJO: dos fuentes dan carga útil distinta (2280 vs 5000). Cargué 2280
  --      (variante furgón). CONFIRMAR contra manual.
  ('Mercedes-Benz', 'Sprinter', 2020, '515 CDI Furgón 4325',
   'furgon', 'OM651', 2.1, 150, 'diesel',
   NULL, NULL, NULL,
   NULL, 71, NULL,
   NULL, 2380, 2280,
   'Autoblog/Scribd ficha 515', 'https://www.autoblog.com.uy/2020/05/lanzamiento-mercedes-benz-sprinter-515.html', NULL, current_date,
   'humano', false, NULL, NULL),

  -- (El Scania R450 vivía acá como 2020 / 'A6x2 tractor'. Se consolidó en la
  --  fila 2019 de la TANDA 2, que es el mismo camión y la misma fuente.)

  ('Iveco', 'Tector', 2021, '170E28 4x2 chasis',
   'chasis_mediano', 'FPT NEF6', 5.9, 280, 'diesel',
   NULL, NULL, NULL,
   NULL, 400, NULL,
   17000, 5250, 11429,
   'MotorMagazine + ficha oficial Iveco 17TN', 'https://www.iveco.com/argentina/-/media/IVECOdotcom/Argentina/Fichas-Tecnicas/Tector/Semipesados/Tector_17TN.pdf', NULL, current_date,
   'humano', false, NULL, NULL),

  ('Iveco', 'Tector', 2019, '90 (9tn) 4x2',
   'chasis_liviano', 'FPT NEF4', 4.5, 190, 'diesel',
   NULL, NULL, NULL,
   NULL, 150, NULL,
   8500, NULL, 5061,
   'MotorMagazine lanzamiento Tector 9/11tn', 'https://motormagazine.com.ar/lanzamiento-iveco-tector-9-y-11-toneladas-en-argentina/', NULL, current_date,
   'humano', false, NULL, NULL),

  ('Iveco', 'Tector', 2019, '110 (11tn) 4x2',
   'chasis_mediano', 'FPT NEF4', 4.5, 190, 'diesel',
   NULL, NULL, NULL,
   NULL, 150, NULL,
   10600, NULL, 6946,
   'MotorMagazine lanzamiento Tector 9/11tn', 'https://motormagazine.com.ar/lanzamiento-iveco-tector-9-y-11-toneladas-en-argentina/', NULL, current_date,
   'humano', false, NULL, NULL),

  ('Iveco', 'Stralis', 2013, 'NR 200S41 4x2',
   'tractor_semi', 'Cursor', 7.8, 410, 'diesel',
   NULL, NULL, NULL,
   NULL, NULL, NULL,
   20000, NULL, NULL,
   'Camión Argentino ficha Stralis 200S41', 'https://camionargentino.blogspot.com/2013/05/iveco-stralis-200s41.html', NULL, current_date,
   'humano', false, NULL, NULL)

on conflict (marca_norm, modelo_norm, anio, version_norm) do update set
  clase = excluded.clase,
  motor = excluded.motor,
  cilindrada_l = excluded.cilindrada_l,
  potencia_cv = excluded.potencia_cv,
  tipo_combustible = excluded.tipo_combustible,
  consumo_urbano_l100 = excluded.consumo_urbano_l100,
  consumo_ruta_l100 = excluded.consumo_ruta_l100,
  consumo_mixto_l100 = excluded.consumo_mixto_l100,
  fuente_consumo = excluded.fuente_consumo,
  capacidad_tanque_l = excluded.capacidad_tanque_l,
  carroceria = excluded.carroceria,
  pbt_kg = excluded.pbt_kg,
  tara_kg = excluded.tara_kg,
  carga_util_kg = excluded.carga_util_kg,
  fuente = excluded.fuente,
  fuente_url = excluded.fuente_url,
  pagina = excluded.pagina,
  fecha_extraccion = excluded.fecha_extraccion,
  extraido_por = excluded.extraido_por,
  verificado = excluded.verificado,
  verificado_por = excluded.verificado_por,
  notas = excluded.notas;


-- ═════════════════════════════════════════════════════════════════════════════
-- TANDA 2 — SCANIA pesados. ESQUELETO a propósito.
--
-- consumo_* = NULL y fuente_consumo = NULL: para pesados no hay L/100km
-- homologado publicado y NO se inventa. El estimador cae al historial de cargas
-- reales de cada unidad, que es más honesto que un número de catálogo.
-- Lo que sí aporta esta tanda: clase declarada explícita + tara + specs de motor.
-- Todas verificado=false: falta cruzarlas contra la ficha oficial de Scania.
--
-- ── R450: fila única, consolidada ───────────────────────────────────────────
-- Antes existía R450 / 2020 / 'A6x2 tractor' en la TANDA 1: mismo camión, misma
-- tara, mismo PBT y misma nota de MotorMagazine que ésta. Se consolidó en la
-- fila 2019 de acá abajo, que hereda su capacidad_tanque_l = 700. Como `anio` y
-- `version` son parte de la clave única, consolidar NO se puede hacer con UPDATE:
-- hay que borrar la vieja. El DELETE de abajo limpia la fila 2020 si el seed ya
-- se corrió antes; si nunca se sembró, no encuentra nada y no hace daño.
-- ═════════════════════════════════════════════════════════════════════════════
delete from public.vehiculos_referencia
 where marca_norm = 'scania' and modelo_norm = 'r450'
   and anio = 2020 and version_norm = 'a6x2 tractor';

insert into public.vehiculos_referencia (
  marca, modelo, anio, version,
  clase, motor, cilindrada_l, potencia_cv, tipo_combustible,
  consumo_urbano_l100, consumo_ruta_l100, consumo_mixto_l100,
  fuente_consumo, capacidad_tanque_l, carroceria,
  pbt_kg, tara_kg, carga_util_kg,
  fuente, fuente_url, pagina, fecha_extraccion,
  extraido_por, verificado, verificado_por, notas
) values

  ('Scania', 'R450', 2019, 'R450 A6x2 tractor',
   'tractor_semi', 'DC13 13L', 13.0, 450, 'diesel',
   NULL, NULL, NULL,
   NULL, 700, NULL,
   26100, 8411, NULL,
   'MotorMagazine análisis R450 6x2 Highline', 'https://motormagazine.com.ar/analisis-scania-r-450-6x2-highline-en-argentina/', NULL, current_date,
   'humano', false, NULL,
   'tara 8411 = tractor solo (6x2). PBT tractor 26100. En combinación real con semi el peso rodante es mayor; el consumo lo afina el historial. Tanque 700 = 400+300 L. Variante 6x4: PBT técnico 33500 (no cargada).'),

  ('Scania', 'R410', 2019, 'R410 A6x2 tractor',
   'tractor_semi', 'DC13 13L', 13.0, 410, 'diesel',
   NULL, NULL, NULL,
   NULL, NULL, NULL,
   NULL, 9380, NULL,
   'MotorMagazine análisis R410 6x2 tractor', 'https://motormagazine.com.ar/analisis-nuevo-scania-r-410-6x2-tractor/', NULL, current_date,
   'humano', false, NULL, NULL)

on conflict (marca_norm, modelo_norm, anio, version_norm) do update set
  clase = excluded.clase,
  motor = excluded.motor,
  cilindrada_l = excluded.cilindrada_l,
  potencia_cv = excluded.potencia_cv,
  tipo_combustible = excluded.tipo_combustible,
  consumo_urbano_l100 = excluded.consumo_urbano_l100,
  consumo_ruta_l100 = excluded.consumo_ruta_l100,
  consumo_mixto_l100 = excluded.consumo_mixto_l100,
  fuente_consumo = excluded.fuente_consumo,
  capacidad_tanque_l = excluded.capacidad_tanque_l,
  carroceria = excluded.carroceria,
  pbt_kg = excluded.pbt_kg,
  tara_kg = excluded.tara_kg,
  carga_util_kg = excluded.carga_util_kg,
  fuente = excluded.fuente,
  fuente_url = excluded.fuente_url,
  pagina = excluded.pagina,
  fecha_extraccion = excluded.fecha_extraccion,
  extraido_por = excluded.extraido_por,
  verificado = excluded.verificado,
  verificado_por = excluded.verificado_por,
  notas = excluded.notas;
