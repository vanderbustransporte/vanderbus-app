# Estado del proyecto

Documento vivo. **Actualizarlo es parte de terminar una tarea**, no un extra.
Última actualización: 2026-08-25.

> **El producto se llama TransAllInOne** (antes "Vanderbus App"), renombrado en
> agosto 2026. *Vanderbus Transporte* sigue siendo el nombre de la **empresa**
> piloto, no del producto — cuando algún doc dice "Vanderbus Transporte" habla del
> cliente. El repo de GitHub y la carpeta local mantienen el slug viejo
> (`vanderbus-app`) a propósito: renombrarlos rompe remotes, rutas y permisos.
> Las claves de localStorage con prefijo `vanderbus_` **también se dejan** — ver
> "Deuda conocida".

---

## Quién está en qué

| Persona | Área que está tocando | Rama | Desde |
|---|---|---|---|
| Diego | Simplificación UX de la ficha de consumo (Flota) | `ux/estimador-ficha-simplificada` | 2026-08-25 |
| Diego | Catálogo de referencia — TANDA 6 (datos, sin sembrar) | `datos/catalogo-referencia-tanda6` | 2026-08-25 |
| Nico | — | — | — |

> Completar antes de empezar a trabajar. Es el mecanismo barato para no pisarnos
> (ver sección 7 de `CONTRIBUTING.md`).

---

## Dónde está el código

- `main` es el tronco. El 2026-07-24 se mergeó `redesign/fase-1` completa (13
  commits: router + deep links, command palette, Finanzas, despacho, choferes,
  estados vacíos, tracking público, vales de combustible).
- La rama `redesign/fase-1` quedó igual que `main`. **No trabajar más sobre ella:**
  ramas nuevas salen de `main`.
- **2026-08-14:** `rebranding/transallinone` (rebranding a TransAllInOne +
  notificaciones centralizadas en la campana) y `combustible/estimador-consumo`
  (13 commits: estimador, ficha extendida, calibración, docs por vehículo,
  catálogo de referencia) **ya están mergeadas** a `main`.
- **2026-08-17: no queda trabajo fuera de `main`.** Se cerraron las dos últimas
  ramas colgadas, las dos ramificadas de `6d209cb` y mergeadas sin conflicto,
  con `npm run build` verde entre medio:
  - `ux/limpieza-1` (3 commits, merge `9bb04d7`) — un solo nombre para el panel
    de control (el menú decía "Dashboard" y la topbar "Panel de control", que
    para alguien no técnico son dos pantallas), los atajos de "Acceso rápido"
    del Dashboard abren el formulario en vez de dejarte mirando la pantalla
    (viajan por `location.state.nuevo`, mismo canal que el `{ q }` de la
    palette), y **Marketing pasa a nacer apagado** como el GPS: un módulo
    visible y vacío para siempre se lee como "la app está rota". Prenderlo
    sigue siendo un click del superadmin en el panel Empresas.
  - `notificaciones/centro-campana-v2` (1 commit, merge `fbcb126`) — la mitad
    que faltaba de la centralización en la campana: filtros y agrupación por
    severidad, y `src/utils/notifDestino.js`, que hace que el click anuncie a
    dónde va ("Revisar en Flota") y **oculte la acción si el usuario no tiene
    acceso a ese módulo**, en vez de llevarlo a "Sin acceso". La baja de la
    sección dedicada ya estaba en `main` desde el rebranding; esto es el panel.
  - `notificaciones/centro-campana` (v1) quedó **superada por completo**: su
    contenido es la baja de la sección (ya en `main`) más una versión anterior
    del panel. Verificado que no aporta nada: se puede borrar. Lo único que
    dejó sin barrer son dos reglas CSS muertas en `src/index.css`
    (`.sb-badge`, `.sb-badge-dot`), sin ningún uso en JSX.

  > **Pendiente de verificación en navegador.** Los dos merges tienen build
  > verde y el contenido de cada rama se había probado en runtime en su sesión
  > original, pero **el merge en sí no se abrió en el navegador** (la extensión
  > de Chrome no estaba conectada el 2026-08-17). Lo que conviene mirar una vez:
  > los 4 botones de "Acceso rápido" del Dashboard y el panel de la campana.

- **2026-08-25: dos ramas nuevas sin mergear**, ambas ramificadas de `main`
  (7 commits locales sin pushear en ese momento — ver más abajo):
  - `ux/estimador-ficha-simplificada` — Bloque A de la simplificación del
    estimador (auditoría completa en la sesión: mapa de la estructura,
    diagnóstico de sobrecarga de config, propuesta de flujo en 3 niveles).
    Reescribe "Consumo y pesos" en `Vehiculo.jsx` de una pantalla con ~20 campos
    siempre visibles a: **Nivel 1** un buscador único (reemplaza la cascada
    marca→modelo→año→versión de `PrecargaReferencia` y el select con optgroups
    de `motores.js` por un `<input list>` + `<datalist>`, filtrado 100%
    client-side), **Nivel 2** sólo los dos datos que mueven el cálculo (consumo
    urbano/ruta + tara, en lenguaje llano) más la fuente del consumo cuando hay
    algo cargado, **Nivel 3** "Ficha técnica completa (opcional)" colapsado por
    defecto (potencia, torque, norma de emisión, PBT, carrocería, etc. — nada
    de ahí entra al cálculo o tiene fallback por clase), auto-expandido si la
    ficha ya trae datos ahí adentro. `vehiculosRef.js` cambió `listarMarcas` /
    `listarModelos` / `listarAnios` / `listarVersiones` / `obtenerFicha` (3
    round trips encadenados por selección) por `listarFichas()` (una sola
    consulta, cacheada) + `etiquetaFicha()`. **Verificado en navegador** contra
    la Master 2.5 real: precarga desde el buscador, badges de verificación,
    tres números, auto-expand de Nivel 3, sin tocar el campo `tara_kg` ya
    cargado cuando la fila de referencia no trae ese dato (NULL no pisa).
    Bloques B (modal de Viajes) y el buscador con "año más cercano" quedan para
    después. Sin pushear.
  - `datos/catalogo-referencia-tanda6` — 8 filas nuevas para el seed de
    `vehiculos_referencia` (livianos, semi-pesados, tractores; detalle en la
    sección del catálogo más abajo). **Escritas, sin sembrar.**

---

## Migraciones — estado de aplicación

La base es productiva y única. El código puede estar mergeado antes de que la
migración esté aplicada: por eso el código tiene que tolerar el esquema viejo
(ver `CONTRIBUTING.md` §5).

Al 2026-07-24 estaban todas aplicadas (despacho, choferes, tracking público,
tracking público org fix, vales de combustible). Después de eso se sumaron las tres
del estimador de consumo, **aplicadas por Diego el 2026-07-27** en orden en el SQL editor:

| Migración | ¿Aplicada? | Qué prende |
|---|---|---|
| `20260724120000_consumo_estimado.sql` | ✅ **SÍ** (2026-07-27) | Estimador base: consumo urbano/ruta, tara, carga útil, distancia y tipo de recorrido del viaje |
| `20260724130000_consumo_ficha_extendida.sql` | ✅ **SÍ** (2026-07-27) | Ficha técnica completa (clase, motor, fuente del consumo, PBT, carrocería, tanque, ralentí), topografía y horas de ralentí del viaje, y `combustible.tanque_lleno` (el insumo del motor de calibración) |
| `20260724140000_vehiculo_docs.sql` | ✅ **SÍ** (2026-07-27) | Tabla `vehiculo_docs` + bucket privado `vehiculo-docs`: subir y consultar el manual / ficha técnica de cada unidad |
| `20260727120000_vehiculos_referencia.sql` | ✅ **SÍ** (2026-07-28) | Catálogo de referencia GLOBAL `vehiculos_referencia`: el usuario elige marca → modelo → año → versión y prellena la ficha de su unidad, gratis y sin llamar a ninguna API |

**`vehiculos_referencia` es la EXCEPCIÓN al modelo por empresa:** no tiene
`organization_id`. Un Scania R450 2019 es el mismo camión para todos los clientes.
Lectura para cualquier `authenticated`, escritura SÓLO `service_role` — un dato malo
de un tenant no lo ven todos. **Verificado en vivo el 2026-07-28**: como anónimo la
consulta devuelve 0 filas, como autenticado devuelve las sembradas.

El **seed** (`supabase/seeds/vehiculos_referencia.sql`) está corrido **entero, hasta la
TANDA 5: 11 filas en la base, verificadas con un `select` real el 2026-08-13** (incluida
la TANDA 5: Ford Cargo 1723 2016 y VW Delivery 11.180 2019). Es idempotente: reejecutarlo actualiza, no duplica. Se corre desde el SQL
editor del dashboard o con la service_role key — desde el cliente con la anon key no se
puede insertar, que es justamente el punto.

> **Trampa que ya costó una vuelta:** escribir un bloque en `supabase/seeds/` **no lo
> aplica**. El 2026-07-28 la TANDA 3 quedó escrita y sin correr, y al día siguiente la
> base seguía en 7 filas mientras el archivo aparentaba 8. **Antes de dar una fila por
> sembrada, verificar con un `select`.** Atajo: desde la consola de la app,
> `const { supabase } = await import('/src/lib/supabase.js')` — en dev Vite sirve el
> módulo y devuelve el cliente ya autenticado.

Cada una se detecta por separado y la app tolera cualquier combinación: sin
ninguna funciona exactamente como hoy, con la primera sola estima igual que
antes, y así. Lo que falta se oculta solo y **no se manda al guardar** — mandar
una columna inexistente haría fallar el guardado entero (`consumoDisponible()` /
`fichaExtDisponible()` en `src/utils/consumo.js`, `docsDisponible()` en
`src/utils/docsVehiculo.js`). Aplicarlas es lo único que hace falta: no hay que
tocar código.

**Edge Function `extraer-ficha-tecnica`** (lectura asistida del PDF): además de
la migración `...140000`, hay que
1. cargar el secreto: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref <ref>`
2. desplegarla: `supabase functions deploy extraer-ficha-tecnica --project-ref <ref>`

Sin eso el botón “Leer datos” devuelve un error legible y todo lo demás anda
igual. La lógica pura (qué páginas se mandan al modelo, qué valores se aceptan)
se prueba sin desplegar nada y sin gastar una llamada a la API:
`node --experimental-strip-types supabase/checks/extraccion_ficha_check.mjs`.

---

## Pendientes que no dependen del código

1. **Repo público → privado.** `vanderbustransporte/vanderbus-app` es público hoy.
   Solo lo puede cambiar la cuenta owner (`vanderbustransporte`), cuyo mail
   administra Nico. La cuenta de Diego (`montanarodiego`) tiene push pero no admin.
2. **Rotar la anon key de Supabase.** Estuvo expuesta en un repo público. Rotarla
   implica actualizar el `.env` de cada persona y cualquier automatización de n8n
   que la use. Hacerlo *después* de pasar el repo a privado.
3. **Dar acceso de colaborador a la otra persona** en el repo (Settings →
   Collaborators), también desde la cuenta owner.
4. ~~**Redeployar `Crear-Usuario` en el dashboard de Supabase.**~~ **HECHO el
   2026-08-01: la Edge Function `Crear-Usuario` está desplegada en producción en
   la versión 3, con el fix de escalada de rol activo y verificado.** Esa función
   se versionó por primera vez en `supabase/functions/Crear-Usuario/index.ts`
   (antes vivía SOLO en el dashboard) y se le cerró una escalada de privilegios:
   tomaba el `rol` crudo del body, así que un owner podía crear un segundo owner
   armando el request a mano. Diego pegó la versión nueva en el editor del
   dashboard ese mismo día. **No queda nada pendiente de este punto.**
   **Ojo para la próxima:** hasta el 2026-08-05 esta función NO tenía deploy por
   CLI: había que pegarla a mano en el dashboard o el repo y lo desplegado se
   desincronizaban en silencio. Ver el punto 5.
5. **Primer deploy por CLI (pendiente de correr).** El 2026-08-05 se versionó
   `supabase/config.toml` con el `project_id` y el `verify_jwt` de las cuatro
   Edge Functions, así que ya se pueden deployar desde el repo. **Todavía no se
   corrió ningún deploy por CLI.** Estado actual:
   - El repo tiene `Crear-Usuario` importando `npm:@supabase/supabase-js@2`;
     **producción sigue con el import viejo de `esm.sh`.** Es la única diferencia
     esperada, y es cosmética (misma librería, misma versión).
   - Antes de deployar hay que **comparar el código del dashboard contra el del
     repo**: el CLI pisa producción con el repo, así que cualquier diferencia que
     no sea esa línea de import hay que reconciliarla primero.
   - No hay Docker en la máquina de Diego: el deploy necesita `--use-api`.
   - `supabase login` sigue pendiente. El link al proyecto ya existe localmente
     (`supabase/.temp/linked-project.json`), pero ese archivo es por máquina.
6. **Desactivar el workflow de n8n que scrapea oportunidades de flete.** El
   negocio ya no hace fletes. El repo NO tiene la fuente: las filas de
   `oportunidades` las insertaba un scraper `google_cse` vía **n8n local**
   (documentado en `supabase/migrations/20260710120200_oportunidades_org_rls.sql`).
   Está inactivo desde 2026-06-04 — probablemente porque la migración de RLS del
   2026-07-10 le rompió el insert (`organization_id` NOT NULL + `tenant_isolation`).
   **Hay que borrar/apagar el workflow en n8n para que no reviva.** Del lado del
   código ya se retiró el tipo `'oportunidad'` de `src/utils/tipoNotif.js`.
7. **Limpiar las filas viejas de flete** (opcional, cosmético). Queries en la
   sección "Deuda conocida".
8. **Renombrar el tenant en Supabase** (último paso del rebranding). El nombre de
   la empresa que se ve en la app NO sale del código: sale de
   `organizations.nombre` → `AuthContext.orgNombre`. Y `organizations` es de solo
   lectura desde el cliente (`20260710130100_organizations_solo_lectura.sql`), así
   que va **por SQL editor**, mirando antes:
   ```sql
   -- 1. VER primero: qué orgs hay y cuál es la del tenant original
   select id, nombre, created_at from public.organizations order by created_at;

   -- 2. Recién con el id a la vista, renombrar SOLO esa fila
   -- update public.organizations set nombre = '<nombre nuevo>' where id = '<uuid>';
   ```
   Ojo con no tocar las orgs de prueba (`Empresa Demo RLS`, `Prueba Panel
   Superadmin`, y la org B que usa la suite RLS).
9. **Cargar la ficha de consumo de las unidades REALES de la flota.** Las 4
   migraciones están aplicadas y el cálculo funciona, pero las **2 unidades
   activas tienen todas las columnas del estimador en NULL** (la más completa,
   `got 170` / Renault Master 2007, sólo tiene `capacidad`). Con eso
   `estimarConsumo()` devuelve `ok: false` con "falta el consumo de la unidad" —
   el comportamiento correcto, pero significa que **en producción el estimador
   todavía no muestra ningún número**. Lo desbloquea cargar consumo urbano/ruta
   (o mixto) + tara en Flota → editar unidad, a mano o con la precarga desde
   `vehiculos_referencia`. No hace falta tocar código.

---

## Catálogo de referencia: cómo se carga y qué falta

El estimador **no calcula** el consumo desde la mecánica: el consumo es una
**ENTRADA** (`consumo_urbano/ruta/mixto_l100`). Si falta, el estimador cae al
historial de cargas reales de esa unidad. De ahí las dos velocidades de carga:

- **Camionetas y utilitarios** (Hilux, Amarok, Ranger, Master, Ducato, Sprinter,
  Daily, Kangoo, Partner): ficha COMPLETA con `consumo_*` + `fuente_consumo` y su
  fuente. **Es la prioridad**: es lo único que mueve el estimador. **En curso.**
- **Pesados y medianos** (Tector, Atego, Accelo, Actros, Scania, Volvo): sólo
  ESQUELETO — `tara_kg`, clase declarada explícita, carrocería. `consumo_* = NULL`,
  porque no hay homologación publicada y **no se inventa**. El número lo aprenden
  del historial. Las 7 primeras filas sembradas son todas de esta clase.

### Estado de la carga al 2026-08-13 (verificado por `select`)

**Sembrado y commiteado (11 filas en la base):**

| Tanda | Filas | Consumo |
|---|---|---|
| 1 y 2 | Sprinter 2020, Tector 2021 / 2019 ×2, Stralis 2013, Scania R450 2019, R410 2019 | NULL (esqueleto) |
| 3 | **Toyota Hilux 2021 2.8 TDI 4x4 DC AT** | 12.5 urbano / 7.5 ruta, `benchmark_flota` |
| 4 | **Renault Master 2021 Furgón L2H2 2.3 dCi 135** | 8.9 / 7.0 / 7.7, `homologado` (ECE) → ×1.18 |

**TANDA 5, camiones — sembrada (escrita 2026-07-31, aplicada y verificada 2026-08-13):**

Dos esqueletos, ambos con fuente argentina (pruebas de MotorMagazine), ambos con
`consumo_* = NULL`:

- **Ford Cargo 2016 `1723 4x2 tractor AT`** — `tractor_semi`, Cummins ISBe6 6.7 / 230 cv,
  tara 6357, PBT 16800, tanque 275 L, `carroceria` NULL. El PBTC 32000 va sólo en las
  notas: `pbt_kg` es el peso propio de la unidad, no el del conjunto.
- **Volkswagen Delivery 2019 `11.180 4x2 chasis cabina`** — `chasis_mediano`, Cummins
  ISF 3.8 / 177 cv, tara 3400, PBT 10700, carga útil 7300, tanque 150 L, `carroceria`
  NULL (sale como chasis pelado; **la tara sube al carrozarlo** y hay que corregirla en
  la ficha de la unidad, o el factor de carga miente).

**Buscados en la misma vuelta y NO cargados** — el motivo está escrito al pie del seed,
porque es la parte que se olvida:

- **Fiat Ducato** — la ficha argentina no publica consumo/tara/PBT en HTML legible (el
  PDF oficial da 403). Lo único homologado que apareció es del Ducato **Panorama**
  (minibús), no del furgón: atribuírselo al furgón sería inventar. Falta la ficha del
  Furgón L2H2 / Maxicargo. Si de ahí sale **sólo el mixto, igual sirve**: con urbano y
  ruta en NULL el estimador los deriva y lo dice en los supuestos (`consumo.js:207`).
- **Iveco Daily** — lo indexado es de la generación EURO III, y las cifras que circulan
  (9.64 / 8.20) no tienen año ni versión atribuibles. Sin `anio` + `version` no hay fila:
  son parte de la clave única y NOT NULL.
- **MB Sprinter 515** — probablemente se quede sin consumo para siempre: con 5 t de PBT
  está por encima del límite de 3.5 t de la homologación de livianos. Lo que hay son
  registros de spritmonitor (consumo real de dos usuarios) → `benchmark_flota`, jamás
  `homologado`.

Foco declarado: reparto y camiones, **no más pickups**.

### Reglas de carga — decididas, no se re-discuten

- **El consumo es una ENTRADA, no se calcula.** Y de los tres campos, **sólo urbano y
  ruta entran al cálculo**: `specsVehiculo()` usa `consumo_mixto_l100` únicamente como
  respaldo cuando faltan los otros dos. Cargar el mixto sirve de trazabilidad, no
  mueve el número.
- Falta un dato → **NULL**. Consumo inventado en el campo portante es el peor error
  posible: el estimador lo toma como verdad y deja de aprender del historial.
- **`fuente_consumo` válidos: `homologado` | `fabricante` | `benchmark_flota` |
  `estimado_clase`.** Cualquier otro string **no da error en ningún lado** — ni la
  tabla tiene CHECK ni la app valida: `fuenteInfo()` lo cae en silencio a
  `estimado_clase` y la pantalla describe mal la calidad del dato. Se chequea a mano.
- **`homologado` dispara ×1.18** (`fabricante` ×1.10; los otros dos no corrigen).
  Usarlo **sólo con ciclo oficial**: el ciclo es optimista y el factor lo compensa.
  Un número de prueba de revista o de experiencia de flota ya es de uso real — ahí va
  `benchmark_flota`, o el castigo se cuenta dos veces.
- **Los utilitarios livianos SÍ tienen homologación publicada; los pesados NO.** Para
  pesados el consumo es benchmark o declaración del transportista, o directamente NULL.
- En `tractor_semi`, `carroceria` va **NULL**, nunca el string `'n_a'`: el tractor no
  tiene carrocería propia, la aporta el semi. Da el mismo número (`n_a` es factor
  1.00) pero NULL dice "no se sabe" en vez de afirmar "no aplica".
- `anio` y `version` son parte de la clave única y **NOT NULL**: una fila por año y
  versión, no por modelo.
- `verificado = false` hasta que una segunda persona cruce la fila contra la ficha
  oficial. **Todas las sembradas están en `false`.**

`src/data/motores.js` sigue como fallback cuando la tabla no responde, pero sus
consumos son de rango genérico, no de ficha: es lo que este catálogo viene a
reemplazar, no una fuente para copiar.

### Loop verificado en la app (2026-07-28)

Probado en el navegador contra la base real: Flota → editar unidad → **Scania →
R450 → 2019 → "R450 A6x2 tractor"**. La cascada encadena bien y prellena clase,
motorización, cilindrada, combustible, tanque, PBT y tara. Cada spec muestra su
chip **`sin verificar`** y la tarjeta trae fuente con link y las `notas` de la fila.
Lo importante: **los tres campos de consumo quedan VACÍOS** y `fuente_consumo` en
"sin declarar" — la fila esqueleto no inyecta un consumo inventado.

### Loop verificado en la app (2026-07-29) — la otra rama, la que SÍ trae consumo

Con la Hilux ya sembrada se probó el camino que faltaba: **Toyota → Hilux → 2021 →
"2.8 TDI 4x4 DC AT"**. Prellena 12.5 / 7.5 con los chips `sin verificar` y la fuente
con link, y el panel muestra **"Usado por el estimador 10.0 L/100km · todavía es el
teórico"**. Los 10.0 son el promedio de 12.5 y 7.5 **sin** el ×1.18: `benchmark_flota`
no corrige, que es exactamente el punto de la distinción.

`estimarConsumo()` sobre esa fila, 300 km mixto y sin peso, da **`ok: true`** → 30.0 L,
rango **21.0–39.0 L (±30%)**. La banda es la más ancha porque la ficha está incompleta
(sin tara) y no hay ninguna carga medida; se angosta sola cuando entren cargas a tanque
lleno. Contraste con la fila esqueleto: el **R450 da `ok: false`** con
`faltan: ["el consumo de la unidad (ficha de flota)"]` — nombra lo que falta en vez de
inventar un número.

> El cálculo con distancia **no se puede probar desde el form de Flota**: vive por viaje
> y exigiría guardar la unidad. Se corrió el mismo código de la app importado del bundle
> de dev, alimentado con la fila real traída de Supabase.

Sin probar todavía, porque necesita datos que aún no existen:
- El banner de `fuente === 'historico'` en `ConsumoEstimado.jsx`: necesita una unidad
  con ≥2 cargas a tanque lleno. La org de prueba sigue sin filas en `combustible`.
- El ×1.18 de `homologado` **en la app**: la aritmética está verificada contra el código
  (8.9 → 10.50, 7.0 → 8.26, `factorFuente` 1.18). Desde el 2026-07-31 la fila del Master
  **sí está en la base**, así que la cascada Renault → Master → 2021 ya la ofrece: falta
  abrir el form de Flota y confirmar el número corregido en pantalla.

---

## Próximo en el roadmap de producto

Plan completo en `docs/plan-producto-tms.md`. Lo inmediato:

- **Documentos adjuntos (Supabase Storage)** — la mitad pendiente de la Fase D:
  adjuntar remitos/fotos a un **viaje**. El patrón de Storage ya está resuelto y
  probado en `vehiculo-docs` (bucket privado particionado por empresa + RLS sobre
  `storage.objects`, migración `20260724140000`): copiarlo.
- Tarifas por empresa desde `org_settings` (hoy hay valores hardcodeados).
- Onboarding self-service para empresas nuevas.

Roadmap técnico detallado y lo ya hecho: `.claude/skills/transallinone-app.md`.

---

## Deuda conocida

- `vite.config.js` todavía define `apiPlugin()` (un `/api/viajes` en memoria del
  dev server), vestigio del Express jubilado. No lo usa nadie. Confirmar y borrar.
- Restos de la plantilla Vite sin usar en `src/` (`counter.ts`, `main.ts`, `style.css`).
- **Claves de localStorage con prefijo `vanderbus_`** (6 usos): `App.jsx` (sidebar
  colapsado), `ThemeContext.jsx` + `index.html` (tema) y `chequeoVencimientos.js`
  (firma de vencimientos ya notificados). **Se dejan a propósito:** renombrar la
  firma de vencimientos **redispararía todas las alertas** a todos los usuarios.
  Si algún día se renombran, va con fallback de lectura de la clave vieja.
- ~~`vanderbus-skill.md` (raíz) y `prompt-setup-diego-claude-code (1).md`~~ —
  **borrados el 2026-08-12.** Eran restos del setup inicial que describían un
  monorepo Electron con `server/` Express que no existe en este repo ni en su
  historial; un colaborador nuevo razonaba sobre un build inexistente. La versión
  buena y única del skill es `.claude/skills/transallinone-app.md`.
  (`docs/auditoria-saas-2026-07.md` §Doc los sigue nombrando: es un doc histórico,
  no se reescribe.)
- Tabla `vehiculo` (singular) y `ubicaciones` / `geofences` / `oportunidades` son
  vestigiales. Están cerradas con RLS. No usarlas.
- **Restos del flete en la base** (2026-08-06). El código ya no habla de fletes,
  pero quedan filas. Correr a mano en el SQL editor, en este orden:
  ```sql
  -- 1. Ver qué hay antes de borrar
  select tipo, count(*) from public.notificaciones where tipo = 'oportunidad' group by tipo;
  select count(*) from public.oportunidades;

  -- 2. Borrar los avisos de flete ya emitidos
  delete from public.notificaciones where tipo = 'oportunidad';

  -- 3. Vaciar los leads scrapeados
  delete from public.oportunidades;
  ```
  El CHECK `notificaciones_tipo_check` **se deja como está**: sigue aceptando
  `'oportunidad'`. Sacarlo del CHECK no aporta (ya no hay emisor) y tocar el
  constraint es más riesgoso que dejarlo. **No** dropear la tabla
  `oportunidades`: está cerrada con RLS y no molesta.
- Datos legacy: montos como string, fechas en formatos mezclados, horas en 12h y
  24h conviviendo, viajes con `tipo: 'Mudanza'`/`'Flete'`. **Se normalizan al leer,
  no se migran.** Ver convenciones en `.claude/skills/transallinone-app.md`.
