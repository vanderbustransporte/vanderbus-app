# Auditoría técnica — Vanderbus como producto SaaS multi-tenant

**Fecha:** 2026-07-10
**Alcance:** due diligence técnico previo a vender Vanderbus a múltiples clientes de logística (algunos con hardware Zebra TC56).
**Método:** revisión de código del repo + verificación empírica contra la base productiva (lecturas, sin escrituras).
**Regla de esta pasada:** solo diagnóstico y plan. No se aplicó ningún cambio de código.

> **Stack real (no lo que dice la doc vieja):** SPA web pura — Vite 8 + React 19 + Tailwind 4 + Supabase (Postgres + Auth + RLS + Realtime + Edge Functions) + Leaflet + Recharts. **No hay Electron, ni server/ Express, ni monorepo.** El frontend habla directo a Supabase con la `anon key`. RLS es la **única** barrera de aislamiento entre empresas.

---

## 0. Resumen ejecutivo — lo que no puede esperar

Hice una prueba directa contra la base productiva: un `GET` a la REST API de Supabase usando **solo la anon key, sin sesión de usuario** (es decir, como cualquier persona anónima en internet). Resultado:

| Tabla | ¿Aislada? | Filas leídas sin login |
|---|---|---|
| `viajes`, `vehiculos`, `organizations`, `profiles`, `org_settings`, `viajes_gps` | ✅ Sí (RLS ok) | 0 (devuelve `[]`) |
| **`notificaciones`** | ❌ **NO** | **12 filas** (toda la tabla) |
| **`ubicaciones_gps`** | ❌ **NO** | **185 filas** — coordenadas GPS reales de choferes |

**Dos tablas están abiertas a internet sin autenticación.** No es teoría: cualquiera que tenga la URL del proyecto (que está en un repo de GitHub **público**) puede leer hoy mismo las notificaciones de negocio y el rastreo GPS en vivo de los choferes. La `notificaciones` además **no tiene columna `organization_id`**, así que ni siquiera separa entre empresas: es un pozo común. Esto invalida el supuesto central del pitch ("datos completamente aislados por cliente").

Antes de sumar el primer cliente nuevo hay que cerrar esto. Todo lo demás (onboarding, feature flags, performance) es real pero secundario frente a un leak activo.

**Nota de método:** confirmé lecturas. **No** probé escrituras contra producción para no alterar datos, pero como las lecturas anónimas pasan, lo más probable es que RLS esté **directamente desactivado** en esas dos tablas (no una policy de `select` permisiva), lo que implicaría que también son **escribibles y borrables** por cualquiera. Verificarlo es parte de la Fase 0.

---

## 1. Multi-tenancy y aislamiento de datos

### 🔴 CRÍTICO — `notificaciones` sin `organization_id` ni RLS (módulo activo, en uso)
La tabla que probé devuelve estas columnas y nada más: `id, tipo, titulo, mensaje, link, prioridad, leida, created_at`. **No hay `organization_id`.** Consecuencias, todas reales hoy:
- **Leak entre clientes:** cuando entre el cliente B, va a ver las notificaciones del cliente A (y de todos). Las notificaciones incluyen datos de negocio: "VTV del vehículo X vence", vencimientos de seguro, oportunidades comerciales, montos.
- **Leak a internet:** son legibles sin login (confirmado, 12 filas).
- **Contaminación cruzada de acciones:** `markAllRead()` hace `update({leida:true}).eq('leida', false)` sin filtro de empresa (`NotifCenter.jsx:141`, `Notificaciones.jsx:128`). Un usuario de una empresa marca como leídas las notificaciones de **todas** las empresas.
- **Inyección (si RLS está off, como parece):** `crearNotificacion.js` inserta sin `organization_id`; el campo `link` controla navegación dentro de la app y dispara toasts. Un atacante anónimo podría inyectar notificaciones de phishing a todos los tenants o borrar la tabla entera.

**Si no se corrige:** no se puede vender a un segundo cliente sin violar la confidencialidad del primero. Es el mismo patrón de `viajes_gps` que ya se corrigió, pero en un módulo que **sí está activo** (badge en el topbar, toasts en tiempo real).

**Propuesta:**
1. `alter table notificaciones add column organization_id uuid references organizations(id);` backfill con la org que corresponda.
2. Activar RLS + policy `tenant_isolation` (misma que el resto de tablas, con `using` y `with check` sobre `organization_id = current_org_id()`).
3. En código: `crearNotificacion` debe setear `organization_id` (o mejor, que lo ponga un `default` / trigger en la base). Las queries de lectura ya no necesitan filtro manual porque RLS las cubre, pero conviene que `markAllRead` sea explícito igual.

### 🔴 CRÍTICO — `ubicaciones_gps` expuesta y sin aislamiento (185 filas de GPS en vivo, públicas)
Documentada como "deuda técnica, módulo oculto". **El módulo estará oculto del sidebar, pero la tabla no lo está de internet.** 185 posiciones GPS reales (lat/lon/velocidad, `dispositivo: "zebra-chofer1"`) legibles sin login. Además:
- `SeguimientoGPS.jsx` (VistaRealtime, línea ~262) consulta `ubicaciones_gps` **sin filtrar por `organization_id`**, y se suscribe por Realtime a **todos** los INSERT de la tabla. Aún con un usuario logueado, una empresa vería los dispositivos de todas las empresas.
- El tracker (GPSLogger en la Zebra) hace POST directo a `/rest/v1/ubicaciones_gps`; si RLS está off, cualquiera puede inyectar posiciones falsas.

**Si no se corrige:** rastreo en tiempo real de vehículos de clientes accesible por cualquiera. Es un riesgo de seguridad física, no solo de datos, y es un argumento de venta que se cae ("nadie ve la flota de nadie más").

**Propuesta:** mismo tratamiento — `organization_id` + RLS + filtro de org en la query y en el canal Realtime. Si el módulo va a seguir inactivo un tiempo, **igual hay que activar RLS ya** (o vaciar/deshabilitar la tabla), porque hoy filtra datos reales.

### 🟡 El schema/RLS vive solo en el dashboard de Supabase, no en el repo
Esta es la causa raíz de por qué se filtraron `notificaciones` y `ubicaciones_gps`: **las policies no están en control de versiones**, entonces nadie las revisa en un PR. Un colaborador crea una tabla nueva desde el SQL Editor, se olvida el RLS, y nadie lo ve hasta que hay un leak. Ver Área 7 (migraciones como código) — lo cuento acá porque es un problema de aislamiento tanto como de proceso.

### 🟢 El modelo de un solo proyecto Supabase + aislamiento lógico por RLS: mantenerlo (por ahora)
Es el modelo correcto para N clientes chicos/medianos. No migres a schemas o proyectos separados todavía.

| | Un proyecto + RLS (actual) | Proyecto por cliente |
|---|---|---|
| Onboarding | Insert de 1 fila `organizations` | Provisionar proyecto entero |
| Costo | 1 plan | N planes |
| Deploy de features | 1 vez | N veces o automatizado |
| Riesgo de leak | Alto si una policy falla (como pasó) | Bajo (aislamiento físico) |
| Cliente enorme / compliance | Puede saturar el proyecto compartido | Aislable |

Recomendación: seguir con un proyecto + RLS, pero **blindar el proceso** (migraciones revisables, tests de RLS). Reservar "proyecto dedicado" como opción premium para un cliente grande puntual, no como arquitectura general.

---

## 2. Aprovisionamiento de clientes nuevos (onboarding)

### 🟡 No hay alta automatizada; el owner se crea a mano por SQL Editor
La doc menciona una función `crear_empresa('nombre','admin')`, pero **no pude verificar que exista** (no está en el repo; vive —si existe— en la base). Hoy, en la práctica, se crea a mano. Riesgos: error humano (olvidarse el `org_settings`, mal rol, olvidarse RLS en una tabla nueva), inconsistencia entre clientes, y que solo Diego sepa hacerlo.

**Si no se corrige:** cada alta es artesanal y frágil; no escala más allá de un puñado de clientes y no lo puede hacer nadie más del equipo.

**Propuesta:** una Edge Function `provisionar-empresa` (corre con `service_role`, nunca en el frontend) que en **una transacción** haga: crear `organizations` → crear `auth.users` del owner → crear `profiles` (rol owner) → crear `org_settings` con defaults → sembrar datos base si aplica. Idempotente y con validación de quién la invoca (solo un super-admin/vos). Esto vuelve el alta un botón, no un ritual de SQL.

### 🟡 Sin manejo de baja/suspensión por falta de pago
El schema documenta `organizations.estado_sub ('activa'|'suspendida'|'cancelada')`, pero **ningún código lo lee**. Un cliente que deja de pagar conserva acceso completo.

**Propuesta:** que RLS (o una Edge Function de gate en el login) chequee `estado_sub = 'activa'`. Definir política de retención: suspendido = sin acceso pero datos retenidos X días; cancelado = export final + purga a los N días. Escribirlo antes de tener el primer cliente que deje de pagar, no después.

---

## 3. Configuración y feature flags por cliente

### 🟡 Módulos habilitados/deshabilitados por código, no por dato
GPS está oculto editando el `Sidebar` y con un commit. No escala: cada cliente que quiera un set distinto de módulos implicaría ramas o flags hardcodeados.

**Propuesta:** una columna `features jsonb` (o usar `org_settings.extra`) tipo `{ gps: false, marketing: true, ... }`. El sidebar y el guard de `App.jsx` leen de ahí. Habilitar/deshabilitar un módulo para un cliente pasa a ser un update, no un deploy.

### 🟡 Branding por empresa: la infra existe pero no se usa
`org_settings` ya tiene `logo_url`, `color_primario`, `moneda`, pero la app usa el accent hardcodeado (`#38bdf8` en el CSS) y no aplica logo ni color del cliente. Para vender como producto con la marca del cliente (o al menos neutral), hay que leer estos campos y aplicarlos como CSS variables al montar.

---

## 4. Seguridad más allá de RLS

### 🔴 CRÍTICO — anon key hardcodeada en el código y en un repo público
`src/lib/supabase.js` tiene la URL y la anon key hardcodeadas, y el repo `vanderbustransporte/vanderbus-app` es **público** en GitHub. La anon key es "pública por diseño" (va al browser igual), **pero**:
- Debería estar en variable de entorno (`.env` / `import.meta.env.VITE_*`) para poder **rotarla** sin tocar código, y para no publicar la URL del proyecto en un repo abierto.
- El repo público expone todo el schema, los nombres de tablas y la lógica → le da a cualquier atacante el mapa exacto para encontrar las tablas con RLS roto (que es justo lo que encontré yo). Anon key pública + RLS roto = explotable por cualquiera, hoy.

**Propuesta:** mover credenciales a env vars; evaluar volver el repo privado (o al menos, no tener la URL de prod en un repo abierto); rotar la anon key después de cerrar los leaks.

### 🟡 Generación de contraseñas con `Math.random()`
`Usuarios.jsx` (`genPassword`) usa `Math.random()`, no `crypto`. Son contraseñas iniciales que setea el owner, así que el impacto es acotado, pero es trivial cambiarlo a `crypto.getRandomValues`.

### 🟡 Lógica sensible en el cliente que debería estar en el servidor
- **Detección de viajes GPS** (`detectarViajes` + INSERT a `viajes_gps`) corre en el **browser de cada usuario** que abre el Historial (`SeguimientoGPS.jsx:520-557`). Varios usuarios lo recomputan y hay carrera al insertar (el dedup es best-effort). Debería ser un job server-side (Edge Function con cron), no algo que dispara cada cliente.
- **Cálculo de tarifas** vive en el cliente (`tarifas.js`). Es aceptable para mostrar, pero si en el futuro hay facturación real, el número que se cobra debe calcularse/validarse en el servidor.

### 🟢 Manejo de errores/logs
Los `console.error` incluyen el objeto de error, en la consola del navegador del propio usuario (no hay logs server-side compartidos). Riesgo de filtrar datos de otro cliente en logs: bajo. La Edge Function `Crear-Usuario` valida que quien llama sea owner (según doc) — no pude verificar el código; **confirmar** que además valida que no se pueda crear un usuario en otra empresa ni auto-escalar a owner.

---

## 5. Escalabilidad de arquitectura y performance

### 🟡 `useStore` carga TODO, de TODAS las tablas, cada 30s, sin paginación
`loadFromSupabase()` trae la tabla completa de `vehiculos, combustible, mantenimiento, contactos, nomina, ingresos, gastos, marketing, viajes` de la org, y lo repite con `setInterval(..., 30000)`. Para un cliente con años de operación (miles de registros de combustible/gastos/viajes), esto crece sin techo: memory bloat en el cliente y una descarga completa cada 30 segundos.

**Propuesta:** paginar / ventana temporal (ej. últimos N meses) en los módulos de alto volumen; mover las agregaciones del Dashboard a RPC/vistas server-side en vez de sumar arrays completos en el browser (`Dashboard.jsx` recorre todos los arrays por mes). Reemplazar el poll de 30s por Realtime selectivo + refetch bajo demanda; el `setInterval` actual además nunca se limpia y corre con la pestaña en background.

### 🟡 GPS Realtime no escala con muchas orgs
VistaRealtime carga 24h de pings de **todos** los dispositivos y se suscribe a **todos** los INSERT de `ubicaciones_gps`. Con aislamiento por org arreglado, Realtime respeta RLS, pero igual conviene filtrar el canal por org y limitar la ventana. Hoy, sin filtro, cada cliente recibiría los pings de todos.

### 🟢 IDs inconsistentes
`genId()` usa `Date.now()+random` (colisión improbable pero posible) mientras `vehiculos` usa `crypto.randomUUID()`. Unificar en UUID.

---

## 6. Calidad de código y mantenibilidad

### 🟡 Cero tests
No hay tests. Priorizar, en orden de riesgo: (1) **RLS** — tests de integración que verifiquen que la org A no puede leer/escribir datos de la org B (habría atajado los dos leaks); (2) cálculo de tarifas (`calcularTarifa`); (3) agregaciones del Dashboard; (4) resolución de permisos (`puedeVer/puedeEditar`).

### 🟡 Import de backup destructivo sin transacción
`useStore.importData` hace, por tabla, `delete().eq('organization_id', orgId)` y después `insert`. Si el insert falla a mitad (RLS, red, columna), **los datos viejos ya se borraron** y los nuevos no entraron: pérdida de datos. Debería ser transaccional (una RPC/Edge Function que haga todo o nada) y advertir/backupear antes.

### 🟡 Montos guardados como strings (legado)
Se parsea con `parseFloat(...) || 0` en todos lados. Frágil (un string vacío o mal formado se vuelve 0 silenciosamente). El bug `total` vs `importe` ya se corrigió, pero queda un rastro: `Combustible.jsx:66` todavía referencia `r.total || r.importe` como fallback. Plan a futuro: columnas `numeric` reales.

### 🟡 La documentación miente sobre el stack
`README.md`, y sobre todo `.claude/skills/vanderbus-app.md` / `vanderbus-skill.md`, describen una app Electron con `server/` Express y monorepo que **no existe**. `ARQUITECTURA.md` sí refleja la realidad (SPA + Supabase). Un colaborador nuevo que lea el skill va a razonar sobre un build/release que no existe. Corregir la doc para que diga "SPA web sobre Supabase".

### 🟢 TypeScript configurado pero sin usar
`tsconfig.json` presente, `tsc` ya sacado del build, todo el código es `.jsx/.js`. Decidir: adoptar TS de a poco (ayuda con el naming `importe/total`) o borrar la config para no confundir.

---

## 7. Deploy, ambientes y operación

### 🟡 No hay staging, ni CI/CD, ni migraciones versionadas
- Un solo proyecto Supabase = **producción es el único ambiente**. Los cambios de schema/RLS se aplican a mano en el SQL Editor de prod.
- No hay `.github/` (sin CI).
- **No hay rollback:** si una migración manual rompe algo, no hay forma sistemática de volver atrás.
- El schema y las policies **no están en el repo**, así que no se revisan (causa raíz de los leaks, ver Área 1).

**Si no se corrige:** cada cambio de base es un acto de fe sobre producción, sin revisión ni vuelta atrás, para todos los clientes a la vez.

**Propuesta (mínima y de alto impacto):**
1. Adoptar **Supabase CLI con migraciones en el repo** (`supabase/migrations/*.sql`). Las policies RLS pasan a ser código revisable en PR.
2. Un segundo proyecto Supabase de **staging** para probar migraciones antes de prod.
3. Un GitHub Actions básico: build + (a futuro) tests + deploy del frontend.

### 🟢 Deploy del frontend
Mecanismo actual no documentado (¿Vercel/Netlify?). Al mover credenciales a env vars (Área 4), configurar variables por ambiente ahí mismo.

---

## 8. Responsividad y UX en dispositivo real (Zebra TC56)

No pude validar en hardware real (requiere el dispositivo). Del código:
- Los **formularios** usan grids responsivos (`grid-cols-1 sm:grid-cols-2`), buena base para pantalla chica.
- **Punto de riesgo:** `SeguimientoGPS.jsx` usa un split fijo mapa (flex 7) + panel lateral (flex 3, `minWidth: 220`). En la TC56 (~480px de ancho, táctil) ese lado-a-lado va a quedar apretado o roto; debería colapsar a stack vertical.
- **Tablas** de los módulos (Combustible, Finanzas, etc.) pueden desbordar horizontalmente en pantalla angosta — revisar overflow/scroll.

**Propuesta:** test en TC56 real de los formularios clave y del GPS; priorizar el colapso responsive del split del mapa y el scroll horizontal de tablas. Clasificado 🟡: bloquea la venta combinada con hardware, pero no es riesgo de datos.

---

## Plan de fases sugerido

Pensado para **no romper** los módulos que ya están casi listos: la Fase 0 son cambios de base de datos y config, no de la UI que ya funciona.

### Fase 0 — Detener el leak (horas, antes de cualquier cliente nuevo) 🔴
1. `organization_id` + RLS en `notificaciones` (backfill + policy + setear org al insertar).
2. RLS en `ubicaciones_gps` (+ filtro por org en la query y el canal Realtime, o deshabilitar la tabla si el módulo sigue inactivo).
3. **Verificar** que ninguna otra tabla esté sin RLS repitiendo la prueba anónima sobre todas las tablas.
4. Mover credenciales a env vars; evaluar repo privado; rotar anon key al terminar.

*Verificación de salida: el `GET` anónimo a `notificaciones` y `ubicaciones_gps` debe devolver `[]`.*

### Fase 1 — Blindaje del proceso + onboarding (días) 🟡
5. Migraciones Supabase en el repo (RLS pasa a ser revisable). Proyecto de staging.
6. Edge Function `provisionar-empresa` (alta atómica: org + owner + settings + seed).
7. Enforcement de `estado_sub` (suspensión/baja) + política de retención de datos.
8. Tests de RLS de aislamiento entre orgs (el red-flag que faltó).

### Fase 2 — Escalar a 5+ clientes (semanas) 🟡
9. Feature flags por org (jsonb) — reemplaza el ocultar-por-código.
10. Branding por empresa (leer `logo_url`/`color_primario` de `org_settings`).
11. Paginación / ventana temporal en `useStore`; agregaciones del Dashboard server-side; reemplazar el poll de 30s.
12. Mover la detección de viajes GPS a un job server-side (Edge Function cron).

### Fase 3 — Robustez y mantenibilidad 🟢
13. Import de backup transaccional (no destructivo ante fallo).
14. Tests de tarifas, dashboard y permisos; CI en GitHub Actions.
15. Corregir la doc (README/skill) al stack real; decidir TS sí/no; unificar IDs a UUID.

### Fase 4 — Venta con hardware 🟡
16. Validación en TC56 real: colapso responsive del split del GPS, scroll de tablas, formularios táctiles.

---

## Decisiones de arquitectura previas que cuestiono

1. **Store singleton mutable que carga todo** (`useStore.js`). El patrón (variables de módulo `_data`, `notify()`, poll de 30s, refetch total) no escala a datasets grandes ni a datos por-cliente pesados. Alternativa: queries paginadas por módulo con una capa tipo React Query (cache, invalidación, estados de carga/error), y Realtime selectivo en lugar del poll global. Implica retrabajo, pero el modelo actual tiene techo bajo.

2. **RLS-only con el schema viviendo en el dashboard, no en el repo.** El *modelo* (aislamiento lógico por RLS en un proyecto) está bien; el *proceso* es lo que falló y causó los dos leaks: sin migraciones ni revisión, un olvido de RLS es invisible hasta que hay filtración. La corrección no es cambiar de modelo, es volver el RLS **código revisable**.

3. **Trabajo de backend corriendo en el browser del cliente** (detección de viajes que además escribe en la base). No es determinístico entre usuarios y tiene carreras. Debería ser server-side. Es deuda barata de pagar ahora y cara si se deja crecer.

---

*Informe de diagnóstico. No se modificó código ni datos. La única acción sobre producción fueron lecturas anónimas para verificar RLS; no se hicieron escrituras.*
