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
--       REGLA: esos cuatro strings son los ÚNICOS válidos (src/data/clases.js:122).
--       Escribir cualquier otro NO da error en ningún lado — ni la tabla tiene
--       CHECK ni la app valida: `fuenteInfo()` lo cae en silencio a
--       'estimado_clase' y la pantalla termina describiendo mal el dato. Se
--       chequea a mano al cargar cada fila.
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


-- ═════════════════════════════════════════════════════════════════════════════
-- TANDA 3 — CAMIONETAS. Primera fila del catálogo CON consumo cargado.
--
-- ⚠️ fuente_consumo = 'benchmark_flota', NO 'homologado'. Toyota no publica
--    homologación de L/100km para la Hilux 2.8 en Argentina: estos números salen
--    de pruebas de revista, que ya son de uso real. 'homologado' les aplicaría el
--    factor 1.18 de corrección del ciclo oficial (src/data/clases.js:123) y
--    contaría el castigo dos veces.
-- ⚠️ Los únicos strings válidos de fuente_consumo son los CUATRO de
--    src/data/clases.js:122 — homologado | fabricante | benchmark_flota |
--    estimado_clase. Cualquier otro NO da error: fuenteInfo() lo cae en silencio
--    a 'estimado_clase' y la pantalla miente sobre la calidad del dato. Ni la
--    tabla ni la app validan este campo, así que se chequea a mano.
-- ⚠️ tara_kg y carga_util_kg van NULL a propósito. Los valores que circulaban
--    (2100 / 1000) son idénticos a los de src/data/motores.js:45, o sea el
--    redondeado genérico del catálogo legacy, no la ficha de Toyota. NULL hasta
--    tener la ficha real: el estimador resuelve el faltante por clase.
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

  ('Toyota', 'Hilux', 2021, '2.8 TDI 4x4 DC AT',
   'pickup', '1GD 2.8 TDI', 2.8, 204, 'diesel',
   12.5, 7.5, NULL,
   'benchmark_flota', 80, NULL,
   NULL, NULL, NULL,
   'AutoTest/AutoEnAccion pruebas consumo Hilux 2.8', 'https://autotest.com.ar/noticias/toyota-hilux-prueba-de-consumo/', NULL, current_date,
   'humano', false, NULL,
   'consumo_urbano 12.5 / ruta 7.5 = mediana de pruebas de revista argentinas (ciudad 11,5-12,7 / ruta 6,9-7,5 según la fuente), NO homologado de fábrica: Toyota no lo publica. Por eso benchmark_flota y no homologado. PBT, tara y carga útil en NULL: ninguna fuente los dio limpios y los que circulaban eran los genéricos de motores.js, no de ficha. Confirmar contra la ficha de Toyota.')

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
-- TANDA 4 — UTILITARIOS DE REPARTO. Primera fila con consumo HOMOLOGADO.
--
-- ✅ SEMBRADA el 2026-07-31 (confirmado por Diego). La base queda en 9 filas.
--
-- ⚠️ Acá fuente_consumo = 'homologado', y NO es el mismo caso que la Hilux. La
--    Hilux salió de pruebas de revista, que ya son de uso real → benchmark_flota
--    y sin corrección. Ésta sale del ciclo oficial ECE, que es optimista, así
--    que lleva 'homologado' y el estimador le aplica el ×1.18 de clases.js. Esa
--    distinción es lo único que decide si el número se corrige: livianos con
--    ciclo oficial SÍ, pesados NO (no tienen homologación publicada).
--    Verificado en runtime: 8.9 → 10.50 y 7.0 → 8.26, factorFuente 1.18.
--
-- ⚠️ El consumo mixto NO entra al cálculo cuando están cargados urbano y ruta:
--    specsVehiculo() lo usa sólo de respaldo si faltan los otros dos. Se carga
--    igual, como trazabilidad de la ficha.
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

  ('Renault', 'Master', 2021, 'Furgón L2H2 2.3 dCi 135',
   'furgon', 'M9T 2.3 dCi', 2.3, 135, 'diesel',
   8.9, 7.0, 7.7,
   'homologado', 80, 'furgon_cerrado',
   NULL, NULL, NULL,
   'Coches.net/Renault ficha ECE Master L2H2',
   'https://www.coches.net/fichas_tecnicas/renault/master/industriales/4-puertas/furgon_t_l2h2_3500_bl_dci_100kw_135cv/95845/',
   NULL, current_date,
   'humano', false, NULL,
   'consumo urbano 8.9 / ruta 7.0 / mixto 7.7 = ciclo homologado ECE 99/100 (europeo). Por eso fuente_consumo=homologado, que dispara la correccion x1.18. OJO: es homologado EUROPEO; el consumo real argentino tiende a ser mayor (usuarios reportan 11-12 en ruta cargado). El x1.18 lo acerca pero no lo iguala. Confirmar contra ficha Renault Argentina. tara/pbt/carga util en NULL: la ficha europea da peso con conductor (2066 kg), que no es tara limpia; carga util hasta 1593 kg segun Renault pero varia por version. Tanque 80 L tambien sale de la ficha europea. Carroceria furgon_cerrado: es furgon de fabrica, +3% aerodinamico sobre el tramo de ruta.')

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
-- TANDA 5 — CAMIONES DE REPARTO Y DISTANCIA. ESQUELETO, como la TANDA 2.
--
-- ⚠️ TODAVÍA SIN SEMBRAR (al 2026-07-31). Escribir el bloque acá NO lo aplica:
--    la tabla es de escritura sólo para service_role. Verificar con un select
--    antes de dar estas filas por sembradas.
--
-- ⚠️ consumo_* = NULL y fuente_consumo = NULL en las DOS. No es que falte
--    buscarlo: para pesados NO hay L/100km homologado publicado, y las únicas
--    cifras que circulan son comentarios de usuarios (a un Cargo 1723 se le
--    atribuyen 3,3 km/L en un comentario de lector, ≈30 L/100km, sin condiciones
--    ni carga declaradas). Eso no es una fuente. El número lo aprende el
--    historial de cargas a tanque lleno de cada unidad, que es más honesto.
--    Lo que sí aportan estas filas: clase declarada, tara, PBT y specs de motor,
--    que es justo lo que el estimador tiene que deducir mal cuando no están.
--
-- ⚠️ Las dos fuentes son pruebas de MotorMagazine sobre unidades del mercado
--    ARGENTINO — no fichas europeas. Igual van verificado=false: falta cruzarlas
--    contra la ficha oficial de Ford y de VW Camiones.
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

  -- carroceria NULL y no 'n_a': es tractor, la carrocería la aporta el semi.
  ('Ford', 'Cargo', 2016, '1723 4x2 tractor AT',
   'tractor_semi', 'Cummins ISBe6 6.7', 6.7, 230, 'diesel',
   NULL, NULL, NULL,
   NULL, 275, NULL,
   16800, 6357, NULL,
   'MotorMagazine prueba Ford Cargo 1723 4x2 tractor AT',
   'https://motormagazine.com.ar/prueba-ford-cargo-1723-4x2-tractor-at/', NULL, current_date,
   'humano', false, NULL,
   'Tara 6357 y PBT 16800 son del TRACTOR SOLO. El PBTC (capacidad de traccion del conjunto) es 32000 kg y NO se carga en pbt_kg: el estimador toma pbt_kg como el peso propio de la unidad. Carga util en NULL a proposito: en un tractor la aporta el semi. Tanque 275 L = el principal; la prueba menciona un segundo tanque de 275 L (550 total) que es adicional y no viene en toda configuracion, asi que se carga el piso. Transmision automatizada Eaton Torqshift 10 vel. Consumo NO cargado: no hay medicion publicada, la prueba fue sin carga y en autodromo.'),

  ('Volkswagen', 'Delivery', 2019, '11.180 4x2 chasis cabina',
   'chasis_mediano', 'Cummins ISF 3.8', 3.8, 177, 'diesel',
   NULL, NULL, NULL,
   NULL, 150, NULL,
   10700, 3400, 7300,
   'MotorMagazine analisis VW Delivery 11.180',
   'https://motormagazine.com.ar/al-volante-nuevo-volkswagen-delivery-11-180/', NULL, current_date,
   'humano', false, NULL,
   'Chasis con cabina simple 4x2, Euro 5 con SCR (tanque de urea 23 L, no se modela). Carroceria en NULL: sale de fabrica como chasis pelado y la carroceria la monta el cliente, asi que ese dato es de la UNIDAD, no del modelo. Tara 3400 = chasis sin carrozar; una vez carrozada la tara real sube y hay que corregirla en la ficha de la unidad, o el factor de carga miente. Carga util 7300 es tecnica + carroceria por la misma razon. Transmision Eaton manual 6 vel. Consumo NO cargado: la nota no lo declara ni lo mide.')

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
-- TANDA 6 — LIVIANOS + SEMI-PESADOS + TRACTORES (pedido 2026-08-25: completar el
-- catálogo por tipo para el mercado argentino). Datos de BÚSQUEDA WEB con fuente
-- citada, mismas reglas que las tandas 1-5.
--
-- ⚠️ TODAVÍA SIN SEMBRAR. Escribir este bloque NO lo aplica: la tabla es de
--    escritura sólo para service_role. Correr en el SQL editor y verificar con
--    un select.
-- ⚠️ TODAS con verificado=false: falta el doble check contra la ficha oficial.
-- ⚠️ Consumo: SÓLO la Kangoo trae L/100km (homologado europeo, sólo mixto —
--    estimarConsumo() deriva urbano/ruta y lo declara en los supuestos). Para el
--    resto NO apareció homologación publicada y NO se inventa: consumo_* NULL y
--    fuente_consumo NULL. El estimador ya lo dice solo en la UI ("estimado por
--    clase" / se afina con el historial de cargas), que es exactamente el
--    "marcado explícito como estimado" que pide la regla: el número estimado lo
--    pone el modelo por clase, no una fila del catálogo disfrazada de ficha.
-- ⚠️ Lo que SÍ aporta cada fila: clase declarada, motor, pesos y tanque con
--    fuente — justo lo que el estimador deduce mal cuando falta.
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

  -- ── Livianos / utilitarios ──────────────────────────────────────────────────
  ('Fiat', 'Fiorino', 2021, 'Endurance 1.4 Fire EVO',
   'auto', '1.4 Fire EVO 8v', 1.4, 85, 'nafta',
   NULL, NULL, NULL,
   NULL, NULL, 'furgon_cerrado',
   NULL, NULL, 650,
   'fichastecnicas.org ficha Fiorino AR', 'https://fichastecnicas.org/ficha-tecnica-fiat-fiorino-argentina/', NULL, current_date,
   'humano', false, NULL,
   'La ficha argentina da motor 1368cc / 85cv pero NO publica consumo, tara ni tanque: van NULL, no se estima. Carga util 650 = folleto Fiat AR ("hasta 650 kg", caja 3.1 m3) — confirmar contra ficha oficial (fiat.com.ar MY20, PDF responde 403). OJO: circulan consumos 9.0/6.0/7.0 del Fiorino 1.4 Fire 77cv EUROPEO (motoreu), que es OTRO vehiculo — no atribuirselos a este, mismo criterio que el Ducato Panorama de la seccion NO CARGADOS.'),

  ('Renault', 'Kangoo', 2022, 'Express Furgón 1.5 dCi',
   'auto', '1.5 dCi K9K', 1.5, 90, 'diesel',
   NULL, NULL, 5.1,
   'homologado', NULL, 'furgon_cerrado',
   NULL, NULL, NULL,
   'espaciofurgo.com ficha Kangoo Furgón', 'https://www.espaciofurgo.com/ficha/renault-kangoo-furgon/', NULL, current_date,
   'humano', false, NULL,
   'Consumo mixto 5.1 = homologado EUROPEO (la generacion II se vende igual aca, fabricada en Santa Isabel, pero la homologacion citada es de la ficha europea). Solo mixto: urbano/ruta en NULL, estimarConsumo() los deriva y lo declara en los supuestos. fuente_consumo=homologado dispara el x1.18. Carga util en NULL a proposito: la ficha europea dice hasta 800 kg y el folleto argentino 650 kg — hasta no ver la ficha AR no se elige. Potencia 90cv segun espaciofurgo; la version AR puede diferir.'),

  ('Volkswagen', 'Saveiro', 2023, '1.6 MSI Cabina Simple Trendline',
   'auto', '1.6 MSI', 1.6, 110, 'nafta',
   NULL, NULL, NULL,
   NULL, NULL, 'playo',
   NULL, 1119, 668,
   'Autocosmos catálogo Saveiro CS Trendline 2023', 'https://www.autocosmos.com.ar/catalogo/2023/volkswagen/saveiro/16-cabina-simple-trendline/167458', NULL, current_date,
   'humano', false, NULL,
   'Pickup chica: clase declarada "auto" a proposito — la clase "pickup" de clases.js modela medianas tipo Hilux (tara ~2100) y esta tara 1119 se comporta como auto. Tara 1119 = "en orden de marcha" (con fluidos), no tara seca. Carga util 668 kg, caja 924 L. Consumo NO publicado en el catalogo consultado: NULL, lo aprende el historial.'),

  -- ── Semi-pesados ────────────────────────────────────────────────────────────
  -- carroceria NULL: sale de fabrica como chasis pelado (mismo criterio que el
  -- Delivery 11.180 de la TANDA 5).
  ('Iveco', 'Daily', 2024, '35-150 chasis cabina',
   'furgon', 'F1C 3.0', 3.0, NULL, 'diesel',
   NULL, NULL, NULL,
   NULL, NULL, NULL,
   3500, NULL, NULL,
   'Ficha oficial Iveco AR Daily chasis 35-150/55-170/70-170', 'https://www.iveco.com/argentina/-/media/IVECOdotcom/Argentina/Fichas-Tecnicas/Daily/FT_DAILY_CHASIS_35-150_55-170_70-170.pdf', NULL, current_date,
   'humano', false, NULL,
   'Fila minima a proposito: la ficha oficial existe (URL) pero es PDF no legible en esta pasada — completar tara/carga/tanque/potencia leyendola (o subirla a Docs de la unidad y usar la extraccion asistida). PBT 3500 por denominacion 35-. Clase "furgon" por tara tipica <2800 del Daily 3.5t; es chasis, la carroceria la monta el cliente (NULL). Esto REEMPLAZA al pendiente Daily de NO CARGADOS: la generacion vieja 35S14 sigue solo en motores.js.'),

  ('Mercedes-Benz', 'Atego', 2021, '1726 4x2 chasis',
   'chasis_mediano', 'OM 926 LA', 7.2, 256, 'diesel',
   NULL, NULL, NULL,
   NULL, 300, NULL,
   17100, NULL, NULL,
   'MotorMagazine — Mercedes ya fabrica el Atego 1726 Euro 5 en Argentina', 'https://motormagazine.com.ar/mercedes-ya-fabrica-el-atego-1726-euro-5-en-argentina/', NULL, current_date,
   'humano', false, NULL,
   'Sucesor del Atego 1725 Euro 3. Tara en NULL a proposito: la fuente da un rango 5260-5845 segun configuracion y no se elige uno sin ficha; carga util tampoco (depende de esa tara). Tanque 300 L (315 opcional: se carga el piso, mismo criterio que el Cargo 1723). Torque 900 Nm. Tanque de urea 35 L, no se modela. Consumo NULL: pesado, sin homologacion publicada.'),

  -- ── Tractores ───────────────────────────────────────────────────────────────
  -- carroceria NULL en los tres: la aporta el semirremolque (regla de la tabla).
  ('Volkswagen', 'Constellation', 2016, '17.280 Tractor 4x2 MT',
   'tractor_semi', 'MAN D08', 6.9, 275, 'diesel',
   NULL, NULL, NULL,
   NULL, 275, NULL,
   17100, 5958, NULL,
   'MotorMagazine prueba Constellation 17.280 Tractor 4x2 MT (12/2016)', 'https://motormagazine.com.ar/prueba-volkswagen-constellation-17-280-tractor-4x2-mt/', NULL, current_date,
   'humano', false, NULL,
   'Tara 5958 y PBT 17100 son del TRACTOR SOLO; CMT 35000 NO se carga en pbt_kg (pbt_kg es el peso propio de la unidad, mismo criterio que el Cargo 1723). Tanques 275+275 en la unidad evaluada: se carga el piso 275, el segundo no viene en toda configuracion. Caja ZF manual 9 vel. La prueba midio 28/29 L/100km a 80 km/h CON 30 TONELADAS: consumo cargado, NO va en consumo_* (que es en vacio) — el peso lo suma el modelo. Potencia real 275cv a pesar del "280" comercial.'),

  ('Volvo', 'FH 500', 2022, '6x2T Evolution Plus tractor',
   'tractor_semi', 'D13C', 12.8, 500, 'diesel',
   NULL, NULL, NULL,
   NULL, 855, NULL,
   28000, 8500, NULL,
   'MotorMagazine análisis Volvo FH 6x2T Evolution Plus', 'https://motormagazine.com.ar/analisis-nuevo-volvo-fh-6x2t-evolution-plus/', NULL, current_date,
   'humano', false, NULL,
   'Tara 8500 = tractor con 100 L de gasoil y sin chofer. PBT 28000 del tractor 6x2; CMT 65000 NO va en pbt_kg. Tanque 855 L de aluminio. Torque 2500 Nm. Caja I-Shift AT2612F 12+4. Consumo NULL: pesado, lo aprende el historial de cargas.'),

  ('Mercedes-Benz', 'Actros', 2021, '2045 LS/36 4x2 tractor',
   'tractor_semi', 'OM 460 BlueTec 5', 12.8, 449, 'diesel',
   NULL, NULL, NULL,
   NULL, NULL, NULL,
   NULL, 9282, NULL,
   'MotorMagazine lanzamiento Actros 2045, 2548 y 2651', 'https://motormagazine.com.ar/lanzamiento-mercedes-benz-actros-2045-2548-y-2651/', NULL, current_date,
   'humano', false, NULL,
   'Motor OM 460 (no OM 471, que es el de otras plazas). Tara declarada 9282. Apto conjuntos de hasta 45 tn (eso es CMT, no va en pbt_kg; PBT del tractor no aparecio limpio en la fuente → NULL). Tanque en NULL: los 730 L (410+320) citados en la misma cobertura son del 2545 6x2, no de este. Caja PowerShift 3 de 12.')

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
-- NO CARGADOS TODAVÍA — y por qué. (Al 2026-07-31.)
--
-- Estos tres se buscaron en esta misma vuelta y NO entraron. El motivo importa:
-- no es que falte tiempo, es que la fuente que apareció no alcanza para la regla
-- de "si el dato no está en la ficha, va NULL".
--
--  • FIAT DUCATO — la ficha argentina (fiat.com.ar MY20, fichastecnicas.org) da
--    motor 2.3 Multijet 130 cv / 2287 cc pero NO publica consumo, ni tara, ni
--    PBT en HTML legible; el PDF oficial responde 403 y los espejos son PDF
--    binario ilegible sin poppler. Lo único con consumo homologado que apareció
--    es km77 del Ducato **Panorama** Corto 2.3 Multijet 130 (7,0 L/100km mixto
--    NEDC, tanque 90 L, tara 2290 kg): ése es el MINIBÚS de pasajeros, no el
--    furgón. Cargarlo como furgón sería atribuirle a una versión un consumo que
--    se midió en otra. Falta la ficha del Furgón L2H2 / Maxicargo.
--    Nota útil: si de esa ficha sale SÓLO el mixto, igual es cargable. Con
--    urbano y ruta en NULL, estimarConsumo() deriva los dos a partir del mixto
--    y lo declara en los supuestos (src/utils/consumo.js:207).
--
--  • IVECO DAILY — mismo problema y peor. Lo indexado es de la generación
--    EURO III (35S14 de 116 cv, tara 2070 / PBT 3500 / tanque 70 L, truck1.es),
--    que no es el Daily que se vende hoy acá; y las cifras de consumo que
--    circulan (9,64 urbano / 8,20 ruta) salen de una prueba de ruta —o sea
--    benchmark_flota— sin año ni versión atribuibles. `anio` y `version` son
--    parte de la clave única y NOT NULL: sin eso no hay fila que cargar.
--
--  • MERCEDES-BENZ SPRINTER 515 — la fila 2020 ya existe (TANDA 1) y sigue sin
--    consumo, y es probable que se quede así: el 515 es de 5 t de PBT, arriba
--    de los 3,5 t donde termina la homologación de L/100km para livianos. No
--    hay ciclo oficial que citar. Lo que hay son registros de spritmonitor
--    (12,77 y 13,15 L/100km) que son consumo REAL de dos usuarios sueltos: si
--    algún día se cargan van 'benchmark_flota', NUNCA 'homologado', y con la
--    nota de que son dos unidades, no una muestra.
--
-- ── Agregados 2026-08-25 (búsqueda de la TANDA 6) ───────────────────────────
--
--  • IVECO DAILY — el pendiente de arriba quedó RESUELTO a medias: la TANDA 6
--    carga el 35-150 chasis actual con la ficha oficial linkeada, pero como fila
--    mínima (el PDF de Iveco no fue legible en esta pasada). Falta completarla.
--
--  • VW DELIVERY 9.170 y MB ACCELO 1016 — están en motores.js pero NO entraron:
--    no apareció ficha ni prueba citables con tara/PBT/tanque limpios, y sin eso
--    la fila sólo repetiría el redondeado genérico del catálogo legacy, que es
--    justo lo que esta tabla vino a reemplazar. El 11.180 de la TANDA 5 ya cubre
--    el segmento mientras tanto.
--
--  • FORD CARGO 2429 / ATEGO 2430 (pesados rígidos) — mismo caso: los números
--    que circulan son los de motores.js. Falta una prueba o ficha citable.
--
--  • CONSUMOS de Fiorino y Saveiro — las fichas argentinas consultadas NO
--    publican L/100km (sí motor y pesos, que se cargaron). Los consumos que
--    circulan para el Fiorino son del 1.4 de 77cv EUROPEO: otro vehículo.
-- ═════════════════════════════════════════════════════════════════════════════
