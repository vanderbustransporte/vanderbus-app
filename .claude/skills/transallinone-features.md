---
name: transallinone-features
description: Detalle operativo de las features grandes de TransAllInOne (despacho, choferes, estimador de consumo): cómo funcionan, qué migración les falta y las trampas al tocarlas. Leer ANTES de modificar Viajes, Combustible, Flota o el estimador.
---

# Features grandes — detalle y trampas

> Esto salió del roadmap de `transallinone-app.md` para no cargarlo en cada
> sesión. El contenido está intacto.

13. **Despacho completo (Fase B del plan de producto)** — código **hecho** (2026-07-18),
   falta SOLO aplicar la migración `20260718120000_viajes_despacho.sql` (17 columnas text
   nullable en `viajes`: carga tipo/bultos/peso/volumen/valor, chofer nombre/dni/cel,
   patente_semi, custodia, satelital, precintos, referencia, destinatario). El análisis
   competitivo que originó esto vive en `docs/plan-producto-tms.md`.
   **Cómo funciona:** `src/utils/despacho.js` detecta en runtime si la migración está
   aplicada (select de `carga_tipo`, promesa cacheada; error 42703 = no aplicada) — hasta
   entonces Viajes oculta la sección "Datos de despacho" y `handleSave` SACA esos campos
   del payload (mandarlos contra columnas inexistentes haría fallar el guardado entero,
   mismo patrón que el bug del uuid ''). La **ficha de despacho** (botón FileText en cada
   fila, visible también para solo-lectura) arma texto plano con solo las líneas con datos
   (`armarFichaDespacho`) y ofrece Copiar + link wa.me. Fase D (tracking público) sigue
   pendiente en el plan.
14. **Choferes (Fase C)** — código **hecho** (2026-07-18), falta SOLO aplicar la migración
   `20260718130000_choferes.sql`: tabla `choferes` (id TEXT genId, fechas TEXT ISO, soft
   delete `activo`) + `tenant_isolation` + policies restrictivas sección **'choferes'**
   (nueva: está en `SECCIONES` de Usuarios.jsx y en routes.jsx con `detalle: true`) +
   realtime + `importar_backup` reemplazada con choferes en su array.
   **Cómo funciona:** detección runtime en `src/utils/choferes.js` (error **42P01** = tabla
   inexistente); el store trata la tabla ausente como vacía, la EXCLUYE de la suscripción
   Realtime (`_tablasAusentes` — un binding a tabla fuera de la publicación pone el canal
   entero en error) y el export de backup tolera el 42P01 en vez de abortar. Vencimientos
   del legajo (licencia / habilitación LNH / psicofísico, `CAMPOS_VENC_CHOFER`) entran a
   `chequeoVencimientos` con tipo **'vencimiento'** (reutilizado a propósito: NO hubo que
   tocar el CHECK de `notificaciones.tipo`) y link `choferes:<id>`. En Viajes, la sección
   de despacho tiene un select-acción "Elegir chofer del legajo" que copia nombre/DNI/cel
   a los campos de texto (siguen editables). La palette Ctrl+K también busca choferes.

15. **Estimador de consumo de combustible por viaje** — código hecho (2026-07-24),
   faltan SOLO las tres migraciones (ninguna aplicada; se aplican en orden, y la
   app tolera cualquier combinación de las tres):
   `20260724120000_consumo_estimado.sql` (estimador base) →
   `20260724130000_consumo_ficha_extendida.sql` (ficha completa + calibración) →
   `20260724140000_vehiculo_docs.sql` (manual en PDF por unidad).
   Detección runtime en `src/utils/consumo.js` (`consumoDisponible()` /
   `fichaExtDisponible()`, sonda por columna centinela, 42703 = no aplicada) y
   `src/utils/docsVehiculo.js` (`docsDisponible()`, 42P01). Hasta entonces Flota,
   Viajes y Combustible ocultan las secciones y SACAN esos campos del payload al
   guardar, mismo patrón que despacho y vales.
   **Cómo funciona el cálculo:**
   `L/100km = base(tipoRuta) × factorCarga × factorCarrocería × factorTopografía`,
   más `ralentí(L/h) × horas de motor detenido` en litros. `base` es el consumo
   **en vacío** interpolado entre urbano y ruta y CORREGIDO por `fuente_consumo`;
   `factorCarga = (1−s) + s × (tara+peso)/tara`, con `s` = fracción del consumo
   que depende de la masa, partida por clase (`src/data/clases.js`) porque un semi
   que triplica su masa sube ~40% y un furgón que la duplica sube ~30%: a 90 km/h
   manda la aerodinámica, no el peso.
   **Ojo al tocarlo:**
   - Los consumos de la ficha son **en vacío**. Si alguien carga ahí el consumo
     "cargado", el peso se cuenta dos veces.
   - **`fuente_consumo` no es cosmético.** Un homologado de liviano es real pero
     optimista (10–25% por debajo del uso urbano argentino) y se corrige +18%; los
     pesados NO tienen homologación de L/100km publicada, así que ahí el valor es
     benchmark o declaración del transportista y no se corrige. La UI lo dice.
   - La **carrocería** entra como factor y SÓLO sobre el tramo de ruta (abajo de
     ~70 km/h la diferencia aerodinámica es ruido), no por masa. El **volumen** no
     entra en la fórmula a propósito: no cambia la sección frontal. Se muestra
     como aprovechamiento.
   - `src/data/motores.js` y `src/data/clases.js` son **valores de referencia**
     (el primero sólo PRECARGA la ficha; el segundo aporta coeficientes cuando
     falta el dato). No son la ficha del manual de cada unidad. Lo que manda es lo
     guardado en `vehiculos`.
   - **Calibración** (`src/utils/calibracion.js`): `usado = w×real + (1−w)×teórico`
     con `w = n/(n+5)` → con 1 carga el teórico pesa 83%, con 5 van 50/50, con 20
     el real pesa 80%. `real` sale SÓLO de cargas con `tanque_lleno='si'`
     (una carga parcial no dice cuántos litros se gastaron en esos km) ordenadas
     por **odómetro, no por fecha**. Outliers: rango duro por clase + más de 3σ
     del centro, con σ estimada por **MAD sobre la mediana** — la σ clásica la
     infla el propio outlier y no lo detecta (verificado: un odómetro mal tipeado
     movía el real de 14.00 a 12.63 L/100km; con MAD queda en 14.04). El medido se
     normaliza a "vacío" dividiéndolo por el factor de carga promedio de los
     viajes de esa unidad: sin eso el peso se contaría dos veces.
   - `consumoRealVehiculo()` (el viejo, sin flag de tanque lleno) sigue existiendo
     como respaldo para bases sin la migración `...130000`. El cálculo bueno es
     `consumoCalibrado`.
   - La salida es un **rango** (±30/20/12/8% según ficha y cargas medidas), no un
     número puntual, y va grande y arriba: si alguien cotiza un flete con esto y
     le erra, la diferencia la pone él.
   - `estimarConsumo()` devuelve `faltan` (qué datos hacen falta) y `supuestos`
     (qué se dio por sentado, incluido lo que NO se modela). La UI muestra las
     dos: un estimado sin sus supuestos a la vista es una mentira prolija.
   - **Extracción del PDF** (Edge Function `extraer-ficha-tecnica`): no manda el
     PDF entero — indexa por página, puntúa por palabras clave de
     especificaciones y manda sólo las 12 mejores recortadas. `null` es respuesta
     válida y esperada: el modelo no infiere ni completa con conocimiento general.
     Lo extraído se valida por rango contra la clase y **nada entra al cálculo sin
     confirmación humana** (va al form como propuesta, con página y cita a la
     vista). La lógica pura vive en `logica.ts` para poder probarla sin desplegar:
     `node --experimental-strip-types supabase/checks/extraccion_ficha_check.mjs`.
