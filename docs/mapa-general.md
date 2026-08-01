# Mapa general — Vanderbus

Foto de alto nivel del proyecto: qué módulos tiene, cómo está construido y en qué
estado está cada parte. **Es un mapa, no documentación fina**: acá no van columnas,
props ni lógica interna de ningún módulo.

Escrito el **2026-08-01** leyendo el repo (árbol de archivos, `package.json`,
`src/`, `supabase/migrations/`, `supabase/functions/`, `docs/`).

> ## Cómo leer este documento
>
> Separa **dos cosas distintas** y nunca las mezcla:
>
> - **Existe en el repo** — verificado leyendo archivos. Es un hecho comprobable.
> - **Funciona / está terminado** — **NO verificable leyendo código.** Que un
>   archivo exista no dice que ande, ni que esté completo, ni que esté en producción.
>
> Por eso la tabla de estado usa **⚠️ estado por confirmar** en casi todo. No es
> pesimismo: es que desde el código no se puede afirmar otra cosa. Donde hay una
> verificación real, está **atribuida a quién y cuándo la hizo** (sale de
> `docs/estado-proyecto.md`, no de esta lectura).

---

## 1. Qué es Vanderbus

App de gestión para **empresas de transporte**. Nació como herramienta interna de
Vanderbus Transporte (Lomas de Zamora, AMBA) y está en conversión a **SaaS
multi-tenant**, donde cada empresa cliente tiene sus datos aislados de las demás.

A quién apunta: flotas de camiones y operaciones logísticas — el producto cubre el
ciclo de viajes, flota, combustible, mantenimiento, choferes y la administración
(finanzas, nómina, contactos). Es un producto **genérico de transporte**: no es una
app de fletes ni de mudanzas.

Roles que conviven en la app: **owner** de la empresa, **usuarios con permisos por
sección**, y **superadmin de plataforma** (nosotros, no el cliente).

---

## 2. Stack y arquitectura general

| Capa | Qué es |
|---|---|
| **Frontend** | React 19 + Vite 8 + Tailwind CSS 4. SPA web que corre en el navegador |
| **Router** | `react-router-dom` 7 en modo **HashRouter** (`/#/viajes`); build con `base: './'` |
| **Estado global** | Singleton propio en `src/store/useStore.js` (no Redux ni Zustand) |
| **Base de datos** | Supabase — PostgreSQL + Auth + RLS + Realtime + Storage + Edge Functions |
| **Backend propio** | **Ninguno.** El frontend habla directo a Supabase |
| **Auth** | Supabase Auth (email + password). Solo la **anon key** en el frontend |
| **UI** | Lucide React (iconos), Recharts (gráficos), Leaflet + react-leaflet (mapas) |
| **CI** | GitHub Actions: `npm ci` + `npm run build` en PR y push a `main` |
| **Scripts** | `dev`, `build`, `preview` — no hay script de test ni de lint |

**Arquitectura en una línea:** SPA React → Supabase directo, con RLS como la única
frontera de seguridad real, y Edge Functions para lo que necesita privilegios.

Decisiones que conviene conocer antes de tocar algo:

- **Hubo un backend Express y está JUBILADO.** No está versionado en este repo. No
  reintroducirlo.
- **No hay Electron acá.** El repo es el frontend web; si existe un wrapper de
  escritorio, vive fuera.
- **La service_role key nunca va al frontend.** Solo la usan las Edge Functions.
- **Hosting:** no hay configuración de deploy versionada en el repo (ni Vercel, ni
  Netlify, ni Dockerfile). El CI solo compila. ⚠️ **Dónde está publicada la app hoy
  es un dato que no surge del código.**

### Registro único de módulos

`src/routes.jsx` es la pieza central de navegación: **una fila por módulo** con su
path, label, grupo del menú, icono, regla de acceso, feature flag opcional y su
componente lazy. Sidebar y guard de ruta leen la misma función `puedeAcceder()`, así
que el menú y los permisos no pueden desincronizarse.

---

## 3. Módulos

16 módulos registrados en `src/routes.jsx`, agrupados en 5 grupos de menú.

### Operación

- **Dashboard** (`/dashboard`) — panel de control con los indicadores de la empresa.
  Agrega del lado del servidor vía la RPC `dashboard_resumen()`.
- **Notificaciones** (`/notificaciones`) — bandeja de avisos. Acceso libre para
  cualquier usuario con sesión. Convive con el centro de notificaciones de la campana
  (`NotifCenter.jsx`).
- **Viajes** (`/viajes`) — alta y seguimiento de viajes, con datos de despacho y
  generación del link público de seguimiento. Acepta deep link a un registro.
- **Flota** (`/vehiculo`) — gestión de los vehículos de la empresa: ficha técnica,
  documentación adjunta y prellenado desde el catálogo global. Acepta deep link.
- **Choferes** (`/choferes`) — legajo de choferes y vencimientos de documentación
  (licencia, habilitación, psicofísico). Acepta deep link.
- **Combustible** (`/combustible`) — cargas de combustible, vales y consumo por unidad.
- **Mantenimiento** (`/mantenimiento`) — services y reparaciones, con próximo
  vencimiento por fecha o kilometraje. Acepta deep link.
- **GPS** (`/seguimiento`) — seguimiento de unidades en mapa (Leaflet + OSM),
  dispositivos y segmentos de viaje detectados. **Detrás del feature flag `seguimiento`.**

### Administración

- **Finanzas** (`/finanzas`) — resumen, movimientos, clientes y rentabilidad por
  vehículo, derivado de las tablas existentes.
- **Nómina** (`/nomina`) — pagos y liquidaciones al personal.
- **Contactos** (`/contactos`) — agenda de clientes y proveedores. Acepta deep link.

### Crecimiento

- **Marketing** (`/marketing`) — campañas con presupuesto, gastado y resultado.
  **Detrás del feature flag `marketing`.**

### Sistema (solo owner)

- **Configuración** (`/configuracion`) — datos y ajustes de la empresa (`org_settings`),
  incluido el branding.
- **Usuarios** (`/usuarios`) — alta de usuarios de la empresa y permisos por sección.
  Crea usuarios vía Edge Function.
- **Backup / Datos** (`/backup`) — export completo a JSON e import transaccional.

### Plataforma (nosotros, no el cliente)

- **Empresas** (`/superadmin`) — alta de empresas clientes y feature flags por
  organización. Requiere `app_metadata.superadmin`.

### Piezas transversales que no son módulos

`CommandPalette` (Ctrl+K), `NotifCenter` (campana), `TrackPublico` (página pública de
seguimiento, sin sesión), `ConsumoEstimado`, `DocsVehiculo`, `ExtraerFicha`,
`PrecargaReferencia`, `CuentaSuspendida`, `ThemeToggle` y los compartidos de
`components/shared/` (Field, Modal, SearchBar, Table, EmptyState).

---

## 4. Modelo de datos — tablas que existen

Solo nombres y para qué es cada una. **El detalle de columnas no va acá**: está en
`.claude/skills/vanderbus-app.md` y en las migraciones.

> **Ojo con el origen del dato.** Las tablas marcadas **(migración)** las verifiqué en
> `supabase/migrations/`. Las marcadas **(código)** las verifiqué por uso real en
> `src/`. Las tablas más viejas fueron creadas **fuera de este repo** (a mano en
> Supabase): las migraciones versionadas solo les agregan RLS o columnas. La lista
> completa y autoritativa de columnas está en la base, no en el repo.

### Identidad y multi-tenancy

| Tabla | Para qué |
|---|---|
| `organizations` | La empresa cliente: nombre, plan, estado de suscripción, feature flags (código + migración) |
| `profiles` | El usuario: a qué organización pertenece, su rol y sus permisos por sección (código) |
| `org_settings` | Configuración y branding de cada empresa, una fila por org (código) |

### Operativas (con `organization_id` + RLS)

| Tabla | Para qué |
|---|---|
| `vehiculos` | La flota. Ficha técnica de cada unidad (código + migración) |
| `viajes` | Los viajes: ruta, cliente, montos, estado, datos de despacho y token de tracking (código + migración) |
| `combustible` | Cargas de combustible y vales por unidad (código + migración) |
| `mantenimiento` | Services y reparaciones, con próximo vencimiento (código) |
| `choferes` | Legajo de choferes y vencimientos de su documentación (migración `20260718130000`) |
| `contactos` | Agenda de clientes y proveedores (código) |
| `nomina` | Pagos al personal (código) |
| `ingresos` | Ingresos de la empresa; incluye el ingreso espejo de un viaje (código) |
| `gastos` | Gastos de la empresa (código) |
| `marketing` | Campañas de marketing (código) |
| `notificaciones` | Avisos de la app: vencimientos y eventos (código + migración) |
| `vehiculo_docs` | Metadatos de los documentos adjuntos de cada unidad (migración `20260724140000`) |

### GPS

| Tabla | Para qué |
|---|---|
| `ubicaciones_gps` | Posiciones reportadas por los dispositivos (código + migración) |
| `dispositivos_gps` | Dispositivos GPS y a qué vehículo está asignado cada uno (migración `20260712120000`) |
| `viajes_gps` | Segmentos de viaje detectados automáticamente a partir de las posiciones (código) |

### Catálogo global — la excepción al modelo por empresa

| Tabla | Para qué |
|---|---|
| `vehiculos_referencia` | Fichas técnicas de referencia por marca/modelo/año/versión, para prellenar la ficha de una unidad. **Sin `organization_id`**: es el mismo camión para todos los clientes. Lectura para cualquier `authenticated`, escritura solo `service_role` (migración `20260727120000`) |

### Storage

| Bucket | Para qué |
|---|---|
| `vehiculo-docs` | Bucket **privado** con el manual / ficha técnica de cada unidad, particionado por empresa y con RLS sobre `storage.objects` (migración `20260724140000`) |

### Vestigiales — existen pero no se usan

`vehiculo` (singular, la versión vieja de `vehiculos`), `ubicaciones` (v1 del tracker,
reemplazada por `ubicaciones_gps`), `geofences` (experimento de geocercas) y
`oportunidades` (leads; el módulo quedó en spec y nunca se implementó). Las cuatro
están cerradas con RLS. **No usarlas ni reabrirlas.**

---

## 5. Estado por módulo

**Esta tabla es una PLANTILLA a completar a mano.** El estado de un módulo **no se
puede leer del código**: que un archivo exista no dice que ande. Por eso las 16 filas
arrancan en `[PENDIENTE]` y las llena Diego, no una inferencia.

Cómo completarla:

- **Estado** — reemplazar `[PENDIENTE]` por lo que conste de verdad. Sugerencia de
  vocabulario: `funcionando` · `funcionando con salvedades` · `a medias` ·
  `no probado` · `roto` · `en pausa`.
- **Probado dónde** — dónde se comprobó: navegador contra la base real, check de
  `supabase/checks/`, solo lectura de código, o nada.
- **Notas** — lo que haga falta aclarar. Lo ya escrito son **referencias con fecha
  tomadas de `docs/estado-proyecto.md`**, no verificaciones mías: sirven de pista,
  pero el Estado sigue en `[PENDIENTE]` hasta que Diego lo confirme.

| Módulo | Estado | Probado dónde | Notas |
|---|---|---|---|
| Dashboard | `[PENDIENTE]` | | Código en el repo: `Dashboard.jsx` + RPC `dashboard_resumen` |
| Notificaciones | `[PENDIENTE]` | | `Notificaciones.jsx` + `NotifCenter.jsx`. La rama `notificaciones/centro-campana` (todo a la campana) está **sin pushear** según `estado-proyecto.md` |
| Viajes | `[PENDIENTE]` | | `Viajes.jsx` + despacho + tracking. **Tracking público verificado en navegador el 2026-07-22** según `estado-proyecto.md` (camino feliz + prueba anon + revocación) |
| Flota | `[PENDIENTE]` | | `Vehiculo.jsx` + docs + precarga + consumo. **Cascada del catálogo verificada en la app el 2026-07-28 (R450, fila esqueleto) y el 2026-07-29 (Hilux, fila con consumo)** según `estado-proyecto.md` |
| Choferes | `[PENDIENTE]` | | `Choferes.jsx` + migración `20260718130000` (dada por aplicada al 2026-07-24 en `estado-proyecto.md`) |
| Combustible | `[PENDIENTE]` | | `Combustible.jsx` + vales + estimador. El **estimador de consumo** vive en `combustible/estimador-consumo`, **12 commits sin pushear**; su Edge Function no está desplegada |
| Mantenimiento | `[PENDIENTE]` | | `Mantenimiento.jsx` + vencimientos |
| GPS | `[PENDIENTE]` | | `SeguimientoGPS.jsx` + Edge Functions `gps-ingesta` y `detectar-viajes-gps`. `estado-proyecto.md` y la memoria del proyecto registran TC56/GPSLogger **EN PAUSA por decisión del dueño** |
| Finanzas | `[PENDIENTE]` | | `Finanzas.jsx`, 4 vistas. Marcado "hecho" en el roadmap del skill el 2026-07-18 — **es una nota de roadmap, no una verificación** |
| Nómina | `[PENDIENTE]` | | `Nomina.jsx`. El roadmap del skill la lista como **mejorable** (sueldo fijo + extras, resumen día 26, WhatsApp vía n8n) |
| Contactos | `[PENDIENTE]` | | `Contactos.jsx` |
| Marketing | `[PENDIENTE]` | | `Marketing.jsx`, detrás del feature flag `marketing` |
| Configuración | `[PENDIENTE]` | | `Configuracion.jsx` + branding por org. Las **tarifas siguen hardcodeadas** en vez de salir de `org_settings` (roadmap) |
| Usuarios | `[PENDIENTE]` | | `Usuarios.jsx` + Edge Function `Crear-Usuario` (**no versionada en el repo**). Permisos por sección **cerrados a nivel RLS el 2026-07-15** según `estado-proyecto.md` |
| Backup / Datos | `[PENDIENTE]` | | `BackupPage.jsx` + RPC `importar_backup`. Import transaccional **hecho el 2026-07-15** según `estado-proyecto.md` |
| Empresas (superadmin) | `[PENDIENTE]` | | `Superadmin.jsx` + Edge Function `provisionar-empresa` |

### Edge Functions

| Función | Código versionado | Estado |
|---|---|---|
| `provisionar-empresa` | ✅ sí | ⚠️ por confirmar si está desplegada |
| `gps-ingesta` | ✅ sí | ⚠️ por confirmar si está desplegada |
| `detectar-viajes-gps` | ✅ sí | ⚠️ por confirmar si está desplegada |
| `extraer-ficha-tecnica` | ✅ sí | ❌ **NO desplegada** (`estado-proyecto.md`). Es el único punto que gasta plata por uso de API |
| `Crear-Usuario` | ❌ **no versionado acá** — se invoca desde `src/modules/Usuarios.jsx:224` pero su código no está en el repo, ni estuvo nunca (verificado en el historial de git al 2026-08-01). Vive solo en el dashboard de Supabase. Para bajarlo: crear `supabase/functions/Crear-Usuario/index.ts` (capitalización exacta) | ⚠️ por confirmar |

---

## 6. Temas transversales

### Multi-tenancy y RLS

Cada fila operativa lleva `organization_id` y **RLS está activo**. La pieza central es
la función `current_org_id()`, que devuelve la organización del usuario logueado
**solo si su empresa tiene la suscripción activa**. Todas las policies de aislamiento
(`tenant_isolation`) comparan contra ella.

Consecuencia de diseño: **una empresa suspendida pierde lectura y escritura a nivel
base**, sin tocar el frontend. La app además muestra `<CuentaSuspendida/>`.

La única excepción al modelo por empresa es `vehiculos_referencia`: catálogo global,
lectura para cualquier autenticado, escritura solo `service_role`.

### Permisos por sección

Dos niveles por sección (`ver` / `editar`) guardados en `profiles.permisos` (jsonb).
No son solo frontend: hay **policies restrictivas en la base** sobre la función
`tiene_permiso()`, y `profiles` tiene un lock para que un usuario no pueda escalarse
el rol. El owner ve todo; el superadmin de plataforma es un flag en `app_metadata`
que solo se setea con service_role.

### Feature flags por organización

`organizations.features` (jsonb) prende o apaga módulos por empresa. Un flag apagado
oculta el módulo para **toda la org, incluido el owner**, y se evalúa antes que los
permisos. Hoy los usan `seguimiento` y `marketing`. Se administran desde el módulo
Empresas vía la RPC `set_org_features`.

### Branding por organización

`src/utils/branding.js` aplica el color primario de la empresa pisando las variables
CSS del design system en `<html>`, de modo que el acento sea el mismo en tema claro y
oscuro. `org_settings` también guarda `logo_url`.

### Provisioning de empresas

Alta atómica de un cliente nuevo: la Edge Function `provisionar-empresa` crea el
usuario owner y la función SQL `provisionar_empresa()` crea organización, perfil y
settings **en una transacción**. Solo la puede invocar un superadmin.

### Datos en vivo y offline

Realtime de Supabase sobre las tablas de la org dispara refetch; hay un poll de
respaldo. El store **tolera migraciones sin aplicar**: si una tabla no existe la trata
como vacía y la excluye de Realtime, en vez de romper la app entera.

### Acceso público sin sesión

El link de seguimiento por viaje (`TrackPublico`) expone, vía una RPC curada y un
token, solo el estado y la ruta de ese viaje — la tabla `viajes` sigue negada al
anónimo. Es el único camino de lectura sin login.

### Verificación

`supabase/checks/` tiene 8 scripts que corren contra la base **real** vía REST
(aislamiento RLS, permisos por sección, lock de rol, features, import de backup,
ingesta GPS, provisioning, extracción de ficha). No son tests unitarios: son checks
de seguridad end-to-end. ⚠️ **No los corrí para escribir este mapa.**

---

## 7. Pendientes y riesgos abiertos

### Riesgos de seguridad (los más urgentes, y no dependen del código)

1. **El repo es público y la anon key estuvo expuesta.** Hay que pasar el repo a
   privado y **después** rotar la key. **Bloqueado:** solo puede hacerlo la cuenta
   owner de GitHub, que administra Nico.
2. **`Crear-Usuario` no está versionada en este repo.** Una función con privilegios
   cuyo código no está bajo control de versiones no se puede revisar ni auditar acá.

### Trabajo sin integrar

3. **12 commits sin pushear** en `combustible/estimador-consumo` (todo el estimador de
   consumo: ficha extendida, calibración, docs por unidad, extracción asistida).
4. **La rama `notificaciones/centro-campana` también está sin pushear.**
5. **La Edge Function `extraer-ficha-tecnica` no está desplegada**: el botón "Leer
   datos" devuelve un error legible y el resto anda igual.

### Deuda y huecos de producto

6. **Tarifas hardcodeadas** en vez de leerse de `org_settings`.
7. **Sin onboarding self-service**: no hay pantalla de registro para empresas nuevas.
8. **Sin billing**: la suspensión por `estado_sub` ya se aplica a nivel RLS, pero falta
   lo que la dispara (cobro / webhook).
9. **Documentos adjuntos por viaje** — pendiente; el patrón de Storage ya está resuelto
   en `vehiculo-docs`.
10. **Catálogo `vehiculos_referencia` recién empezado**: 11 filas al 2026-08-01, la
    mayoría esqueletos sin consumo, **todas con `verificado = false`** (nadie las cruzó
    todavía contra la ficha oficial del fabricante).
11. **Sin tests ni linter**: `package.json` solo tiene `dev`, `build` y `preview`; el CI
    únicamente compila. La red de seguridad son los checks manuales de
    `supabase/checks/`.

### Trampas conocidas

12. **Escribir un archivo en `supabase/seeds/` NO lo aplica.** Ya costó una vuelta:
    verificar siempre con un `select` real antes de dar una fila por sembrada.
13. **`vite.config.js` todavía define `apiPlugin()`**, un `/api/viajes` en memoria del
    dev server: vestigio del Express jubilado. Nadie lo usa. Confirmar y borrar.
14. **Restos de la plantilla Vite** sin usar en `src/`.
15. **Datos legacy que no se migran, se normalizan al leer**: montos como string, fechas
    y horas en formatos mezclados, viajes con `tipo: 'Mudanza'`/`'Flete'`.
16. **La doc está desincronizada entre sí.** El roadmap de
    `.claude/skills/vanderbus-app.md` da las migraciones de despacho y choferes como
    "falta aplicar", mientras `docs/estado-proyecto.md` (más nuevo) las da por
    aplicadas desde el 2026-07-24. Ante una discrepancia, **`estado-proyecto.md` manda
    y la base manda sobre todo lo demás.**

---

## Dónde seguir leyendo

| Documento | Qué tiene |
|---|---|
| `.claude/skills/vanderbus-app.md` | Arquitectura fina, convenciones de código, modelo de datos con columnas. **Obligatorio antes de tocar código** |
| `docs/estado-proyecto.md` | Estado vivo: quién toca qué, migraciones aplicadas, carga del catálogo |
| `CONTRIBUTING.md` | Cómo se trabaja de a dos: ramas, PR, nunca commitear a `main` |
| `docs/plan-producto-tms.md` | Plan de producto y análisis competitivo |
| `docs/auditoria-produccion-2026-07-22.md`, `docs/auditoria-saas-2026-07.md` | Auditorías previas |
| `ARQUITECTURA.md`, `README.md` | Puerta de entrada al repo |
