# Auditoría de producción — Vanderbus (gate de venta)

**Fecha:** 2026-07-22 · **Rama:** `redesign/fase-1`
**Método:** análisis estático completo del repo + verificación empírica contra la base productiva (solo lecturas: GETs anónimos con la anon key y POSTs sin credenciales a las Edge Functions; cero escrituras, cero cambios de config de prod).
**Referencia:** esta auditoría re-verifica y actualiza `docs/auditoria-saas-2026-07.md` (2026-07-10). Casi todo lo crítico de aquella pasada está cerrado y verificado en vivo.

---

## 1. Resumen ejecutivo

La app está **técnicamente lista para un primer cliente real** en su núcleo (multi-tenant, permisos, provisioning, módulos operativos): las 21 tablas devuelven `[]` a un anónimo, todas las RPCs sensibles dan 42501, las 4 Edge Functions dan 401 sin credenciales, y el alta de un cliente es un formulario en el panel Superadmin. Lo que **bloquea la venta** no es código: es (a) rotar la anon key que quedó en el historial público de GitHub y pasar el repo a privado (bloqueado por el acceso al mail de la cuenta), y (b) validar en el TC56 físico si el combo va con hardware. Encontré **un bug real no listado en el roadmap**: `tracking_publico()` podía filtrar la posición GPS de otra empresa si dos orgs nombran igual a un dispositivo — fix ya escrito en la migración `20260722130000_tracking_publico_org_fix.sql`, pendiente de que la apliques.

---

## 2. Findings por sección

### 2.1 Seguridad

**Verificado en vivo (2026-07-22):**
- GET anónimo (anon key, sin sesión) a las 21 tablas — `organizations, profiles, org_settings, vehiculos, vehiculo, combustible, mantenimiento, viajes, contactos, nomina, ingresos, gastos, marketing, ubicaciones_gps, viajes_gps, ubicaciones, geofences, oportunidades, notificaciones, choferes, dispositivos_gps` — devuelve `[]` en todas. Los dos leaks históricos (`notificaciones`, `ubicaciones_gps`) están cerrados.
- RPCs anónimas: `dashboard_resumen`, `estado_suscripcion`, `listar_empresas`, `importar_backup`, `crear_empresa` → 42501. `tracking_publico` responde `{ok:false}` con token inválido (sin enumeración) — es la única expuesta a `anon`, por diseño.
- Edge Functions sin credenciales: `gps-ingesta`, `detectar-viajes-gps`, `provisionar-empresa`, `Crear-Usuario` → HTTP 401 las cuatro.

**Secrets:**
- `src/lib/supabase.js` lee de env vars y aborta si faltan. Grep exhaustivo del árbol: el único JWT es la **anon key** (payload decodificado: `role: anon`, ref `mrfwcfuddvexqixfjnuh`) en `.env` (gitignoreado, no trackeado). `dist/` y `.claude/settings.local.json` también gitignoreados.
- **Historial de git:** la anon key ACTUAL aparece hardcodeada en ~10+ commits viejos (`src/lib/supabase.js` y `tracker.html`). Decodifiqué todos los tokens del historial: **ninguno es service_role** — solo la anon. Conclusión: la rotación pendiente sigue siendo necesaria (repo público + key vigente en historial), pero no hay nada peor enterrado.
- `.env` local además guarda `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` en texto plano (los usa `ver-pings.tmp.mjs`). No se versiona, pero cualquiera con acceso a la máquina tiene la cuenta superadmin. Sugerencia: borrarlas del `.env` cuando no se estén usando.
- `ver-pings.tmp.mjs` (raíz, untracked): script temporal de verificación. No contiene secretos pero lee el `.env`. Borrarlo o moverlo fuera del repo para que no termine commiteado.

**🔴 Hallazgo nuevo — leak cross-org en `tracking_publico()`** (`supabase/migrations/20260722120000_tracking_publico.sql:73-83`): la subquery de última posición filtra solo `where dispositivo = ali` (alias, texto libre) y la búsqueda del dispositivo solo por `vehiculo_id`. Si dos empresas nombran igual a un tracker (p. ej. el default "zebra-chofer1"), el link público de un viaje puede devolver la posición del dispositivo de **otra organización**. Probabilidad hoy (1 org): nula; con el segundo cliente: real. **Fix escrito:** `20260722130000_tracking_publico_org_fix.sql` acota ambas subqueries a `organization_id` del viaje. Aplicarla antes del segundo cliente.

**CORS/headers:** `provisionar-empresa` responde `Access-Control-Allow-Origin: *` — aceptable porque exige JWT superadmin re-validado con `getUser()` contra la base (no confía en el claim del token). `gps-ingesta` y `detectar-viajes-gps` no emiten CORS (no los llama un browser). Sin endpoints sin autenticación indebidos.

**Defensa en profundidad (verificada por código de migraciones):** aislamiento `tenant_isolation` en todas las tablas + gate de `estado_sub` dentro de `current_org_id()` (suspensión corta lectura y escritura a nivel base) + policies **restrictivas** de rol (`profiles_solo_owner_escribe`) y de permisos por sección (`perm_*` sobre 14 tablas, con los casos especiales `ingresos` y `vehiculos` razonados) + `organizations` solo-lectura para tenants. El modo de falla es cerrado en todos los casos.

### 2.2 Arquitectura y calidad de código

- **Electron/electron-builder: N/A.** Este repo es una SPA (Vite + React 19), sin rastro de Electron en árbol ni historial. El punto de `"releaseType"` no aplica a Vanderbus.
- **Dependencias:** todos los imports externos (`@supabase/supabase-js, leaflet, react-leaflet, lucide-react, recharts, react-router-dom, react, react-dom`) están en `dependencies` de `package.json`. **No existe el gap tipo "axios en devDependencies"** de OmaTech POS.
- **Manejo de errores:** bueno. `useStore.update` hace optimista + revert con refetch + toast global (`emitSaveError` → App); `syncArray` lanza ante cualquier error de Supabase; `importar_backup` es transaccional con validación previa; los dos `catch {}` vacíos del código (`Superadmin.jsx:28,215`) son intencionales y documentados. Logging: `console.error` con contexto en cada guardado fallido — suficiente para una SPA sin backend; no hay telemetría server-side (ver "vendible").
- **Código muerto:** los restos de plantilla Vite (`counter.ts`, `main.ts`, `style.css`) ya fueron borrados. Queda **`apiPlugin()` en `vite.config.js:6-32`** (un `/api/viajes` en memoria del dev server): nadie lo usa y contradice la regla "backend jubilado". Es el punto 10 del roadmap del skill — confirmar con Nico y borrarlo (5 min).
- **Store:** el singleton ya no es el de la auditoría anterior: ventana de 24 meses en tablas de movimiento (`MESES_VENTANA`), Realtime filtrado por org + poll de respaldo cada 5 min, Dashboard agregado server-side (`dashboard_resumen()` corre como el llamador, RLS filtra). Tolerancia a migraciones sin aplicar (42P01/42703) en choferes/despacho/tracking.
- **Tests:** siguen sin existir en el repo como suite corrible en CI, pero hay checks de verdad en `supabase/checks/` (aislamiento RLS, features, importar_backup, provisionar_empresa). No hay CI (`.github/` ausente). No bloquea la primera venta; sí conviene antes de la tercera.

### 2.3 Multi-tenant y provisioning

**Flujo `provisionar-empresa` trazado punta a punta:**
1. Frontend (Superadmin.jsx) → `functions.invoke` con sesión superadmin.
2. La función valida el flag `app_metadata.superadmin` **fresco de la base** (`getUser(jwt)`, no el claim del token) → 403 si no.
3. Crea `auth.user` del owner (Admin API, `email_confirm: true`, contraseña CSPRNG si no se pasa).
4. RPC `provisionar_empresa()` (solo service_role): `organizations` + `profiles` (owner) + `org_settings` en **una transacción** — o entra todo o nada. Guarda anti-reuso: un user con profile existente aborta.
5. Si la RPC falla → **compensación**: borra el auth.user creado. Devuelve `{organization_id, user_id, email, password?}` y la UI muestra la contraseña una sola vez.

**Fallas a mitad de camino:** el único residuo posible es que la compensación (`deleteUser`) falle *después* de que ya falló la RPC (doble fallo, p. ej. corte de red): queda un auth.user huérfano sin profile, y el reintento con el mismo email da 409 "no se pudo crear el usuario". Resolución: borrar ese user desde el dashboard y reintentar. Es un caso raro y **falla cerrado** (nunca queda una org a medias). No lo considero bloqueante; si molesta, el fix es que la función detecte "email ya existe + sin profile" y reuse el user en vez de 409.

**¿Qué falta para 100% automático?** Nada de código: alta = completar 3 campos en el panel. Lo manual que queda es de negocio: comunicar credenciales al cliente y (si aplica) setear feature flags iniciales — que también se hacen desde el mismo panel (`set_org_features`).

**Feature flags por organización: YA EXISTEN** (no hubo que diseñarlos). `organizations.features` jsonb + defaults en `src/utils/features.js` + RPCs `listar_empresas`/`set_org_features` con guarda `es_superadmin()` (claim firmado, no falsificable) + evaluación en `routes.jsx` (`feature` se evalúa antes que `acceso`: un flag apagado oculta el módulo hasta para el owner). UI de toggle en Superadmin. Verificado el enforcement: la RPC anónima da 42501.

### 2.4 Performance

- **Escritura de `ubicaciones_gps`:** 1 ping/30 s ≈ 2.880 filas/día por dispositivo (~1M filas/año con solo 1 tracker). Con 5 clientes × 3 trackers: ~15.000/día. El insert es barato; el problema eran las **lecturas sin índice**:
  - `SeguimientoGPS.jsx:499` — carga 24 h (`capturado_en >= now-24h`, RLS agrega org): seq scan.
  - `detectar-viajes-gps` (cron cada 10 min) — barrido de 30 h global: seq scan.
  - `tracking_publico` — última posición por dispositivo: seq scan + sort.
  **Fix escrito** en `20260722130000_tracking_publico_org_fix.sql`: índices `(organization_id, capturado_en)` y `(capturado_en)`.
- **Retención:** no hay purga; la tabla crece para siempre. Propuesta (decisión de negocio: cuánta historia GPS vender): cron mensual `delete from ubicaciones_gps where capturado_en < now() - interval '90 days'` (los viajes detectados ya viven resumidos en `viajes_gps`, que es chica: ~decenas de filas/día).
- **`viajes_gps`:** volumen bajo (segmentos, no pings), único index `(org, patente, inicio)` sirve al dedup y razonablemente a la query del Historial (`inicio >= X` con RLS por org). OK.
- **N+1 / paginación:** no hay N+1 (el store carga por tabla, no por fila). Listados: la `Table` compartida pagina en memoria (`PAGE_SIZE`); con la ventana de 24 meses el dataset en memoria queda acotado. El Realtime de la vista mapa (`SeguimientoGPS.jsx:522`) se suscribe a INSERTs sin filtro de org — RLS de Realtime igual no entrega filas ajenas, pero conviene agregar `filter: organization_id=eq.<org>` como en el store (prolijidad, no seguridad).

### 2.5 Responsive / UI (driver terminal)

- Base buena: formularios `grid-cols-1 sm:grid-cols-2`, hovers gateados con `@media (hover:hover)` (no ensucian touch), tablas con scroll propio.
- **Riesgo concreto:** la vista mapa de `SeguimientoGPS.jsx` (líneas 601-693 y 847-970) es un split fijo `flex:7` mapa + `flex:3` panel (`minWidth:220, maxWidth:320`) **sin colapso**: a ~480 px el mapa queda en ~150 px. Necesita stack vertical bajo un breakpoint si un chofer va a abrir esto en el TC56. Es el único layout roto conocido para pantalla angosta.
- **No auditado como bug** (por directiva): la incompatibilidad Android 6-8.1. Pero ojo con un dato de stack: **Tailwind CSS 4 requiere Chrome 111+**; el Chrome máximo instalable en Android viejo puede quedar por debajo → la app podría renderizar sin estilos en el TC56 aunque el layout estuviera perfecto. Va a la lista manual.

---

## 3. Checklist "vendible"

| Módulo / pieza | Estado | Riesgo si se vende así | Esfuerzo del fix |
|---|---|---|---|
| Aislamiento multi-tenant (RLS 21 tablas) | ✅ verificado en vivo | — | — |
| Permisos por sección (nivel base) | ✅ | — | — |
| Suspensión por `estado_sub` | ✅ | — | — |
| Provisioning (`provisionar-empresa` + panel) | ✅ | Huérfano de auth.user ante doble fallo (raro, falla cerrado) | 1-2 h si se quiere reintento idempotente |
| Feature flags por org | ✅ | — | — |
| Branding por empresa | ✅ (4/4 tests) | — | — |
| Dashboard / Viajes / Flota / Combustible / Mantenimiento / Nómina / Finanzas / Contactos / Marketing / Choferes / Usuarios / Backup / Configuración | ✅ | Trampas de datos legacy documentadas en el skill (montos string, horas mixtas) — ya mitigadas al leer | — |
| Notificaciones | ✅ | CHECK de `tipo` duplica TIPO_CONFIG: agregar un tipo nuevo sin migrar rompe silencioso | Disciplina, no código |
| Tracking público (Fase D) | ⚠️ | Leak GPS cross-org por alias repetido **cuando haya 2+ clientes** | **0 — migración ya escrita, solo aplicarla** |
| Performance GPS (índices) | ⚠️ | Queries degradan con meses de pings acumulados | **0 — misma migración** |
| Retención GPS | ⚠️ | Tabla crece sin techo; costo de storage/queries a 1+ año | 30 min (cron de purga) — decidir ventana primero |
| GPS en TC56 (split del mapa) | ❌ para uso en terminal | Mapa inusable <~700 px de ancho | 2-4 h (colapso responsive) + validar en device |
| Anon key + repo público | ❌ | Key vigente publicada en historial; el repo regala el mapa del schema | Bloqueado por acceso al mail (plan en memoria) |
| CI / tests automatizados | ⚠️ | Regresiones invisibles al crecer el equipo/clientes | 1-2 días (GH Actions + correr los checks de supabase/checks) |
| `apiPlugin()` en vite.config.js | ⚠️ cosmético | Confusión, contradice "backend jubilado" | 5 min (confirmar con Nico y borrar) |

**Veredicto:** vendible a UN primer cliente sin GPS-en-terminal **después de**: aplicar `20260722130000`, rotar la anon key y privatizar el repo. Para vender el combo con TC56, además: colapso responsive del mapa + validación física.

---

## 4. Esto lo tenés que validar/ejecutar vos a mano

**Producción Supabase (yo no toco, comandos exactos):**
1. **Aplicar la migración nueva** `supabase/migrations/20260722130000_tracking_publico_org_fix.sql` en el SQL Editor (idempotente). Cierra el leak cross-org del tracking y agrega los índices GPS.
2. **Rotar la anon key** (Dashboard → Settings → API → rotate) y actualizar `.env` local + el host donde se sirva el frontend + el perfil de GPSLogger si usara la key (no: usa token de dispositivo — no lo afecta). Bloqueado hoy por el mail de la cuenta (lo tiene Nico; plan en la memoria de pendientes).
3. **Repo a privado**: GitHub → `vanderbustransporte/vanderbus-app` → Settings → Danger Zone → Change visibility. Mismo bloqueo de acceso.
4. **Decidir retención GPS** (¿90 días de pings crudos?) y, decidido, te escribo el cron de purga.
5. (Opcional, prolijidad) Borrar `ver-pings.tmp.mjs` y sacar `SUPERADMIN_*` del `.env` cuando no se usen.

**Dispositivo físico (imposible de validar desde acá):**
6. TC56 en Chrome kiosk: ¿qué versión de Chrome corre? Si es < 111, **Tailwind 4 no renderiza bien** — eso decide si hay que testear layout siquiera.
7. En device: formularios táctiles (tamaño de targets), scroll de tablas, y el split del mapa GPS (que ya sabemos que hay que colapsar).
8. GPSLogger en la Zebra apuntando a `gps-ingesta` con su token: latencia y batería reales.

**Decisiones de negocio:**
9. ¿El primer cliente lleva GPS? Si no, el módulo se apaga con el feature flag `seguimiento` desde Superadmin y el punto 6-8 deja de bloquear.
10. Política de retención/baja de clientes (suspendido = datos retenidos X días) — el enforcement técnico ya existe; falta escribir la política.
