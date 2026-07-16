---
name: vanderbus-app
description: Conocimiento completo sobre la app Vanderbus: arquitectura, stack, convenciones, estado actual y roadmap. Leer SIEMPRE antes de tocar cualquier archivo del proyecto.
---

# Skill: Vanderbus App

## Que es este proyecto

App de gestión para empresas de transporte. Empezó como herramienta interna de Vanderbus Transporte (Lomas de Zamora, AMBA) y está en proceso de conversión a SaaS multi-tenant donde cada empresa tiene sus datos aislados.

> **Formato real de este repo:** es una **SPA web** (React + Vite) que se abre en el navegador con `npm run dev`. **No hay código, configuración ni dependencias de Electron en este repositorio ni en su historial de git.** La doc previa lo describía como "app de escritorio Electron"; si un wrapper de escritorio existe, vive fuera de este repo (ver Stack).

El dueño del proyecto es Nico (usuario: "ELON EL PERRI" en Windows). Diego es el colaborador técnico. El repositorio es `vanderbustransporte/vanderbus-app` en GitHub.

---

## Stack completo

- **Frontend:** React 19 + Vite + Tailwind CSS 4 — **SPA web** (corre en el navegador)
- **Router:** react-router-dom 7 en modo **HashRouter** (`/#/viajes`). Es Hash y no Browser porque el build usa `base: './'` y no hay rewrite de servidor: con paths reales, refrescar en `/viajes` daría 404. Si algún día se sirve desde un host con rewrite a index.html, es cambiar una línea en `main.jsx`.
- **Desktop:** *no presente en este repo.* `vite.config.js` usa `base: './'` (assets con rutas relativas), lo que sugiere que en algún momento se pensó para empaquetar en un contenedor tipo Electron, pero **no hay wrapper Electron ni `electron-updater` versionado acá** (verificado: nada de Electron en el árbol de archivos ni en el historial de git).
- **Base de datos:** Supabase (PostgreSQL + Auth + RLS + Realtime + Edge Functions)
- **Estado global:** Singleton propio en `src/store/useStore.js`
- **Tipografías:** Plus Jakarta Sans (UI) + Geist Mono (números/datos)
- **Iconos:** Lucide React
- **Gráficos:** Recharts
- **Mapas:** Leaflet + OpenStreetMap (módulo GPS)
- **Automatizaciones:** n8n local

**IMPORTANTE:** Hubo un backend Express que fue JUBILADO; **no está en este repo** (no hay carpeta `server/` versionada). El frontend habla directo a Supabase. No reintroducir un backend Express.

---

## Estructura de carpetas

```
vanderbus-app\                 ← raíz del repo (acá está package.json y se corre npm)
├── index.html
├── vite.config.js             ← base: './' (assets con rutas relativas)
├── package.json               ← Vite + React 19 (sin Electron)
├── src\
│   ├── main.jsx               ← HashRouter envuelve al AuthGate (el deep link sobrevive al login)
│   ├── App.jsx                ← shell: topbar + <Routes> + guard de permisos
│   ├── routes.jsx             ← CRÍTICO: registro único de módulos (path, label, permisos, feature, lazy)
│   ├── hooks\useNav.js        ← navegar por id de módulo: nav('viajes')
│   ├── modules\               ← Un archivo = un módulo completo
│   │   ├── Dashboard.jsx
│   │   ├── Vehiculo.jsx        (gestión de FLOTA, no un solo vehículo)
│   │   ├── Combustible.jsx
│   │   ├── Mantenimiento.jsx
│   │   ├── Nomina.jsx
│   │   ├── Finanzas.jsx
│   │   ├── Viajes.jsx
│   │   ├── Marketing.jsx
│   │   ├── Contactos.jsx
│   │   ├── SeguimientoGPS.jsx
│   │   ├── Usuarios.jsx        (solo visible para owner)
│   │   └── Backup.jsx
│   ├── components\
│   │   ├── Sidebar.jsx         (menú filtrado por permisos)
│   │   ├── Login.jsx
│   │   ├── NotifCenter.jsx
│   │   ├── ThemeToggle.jsx
│   │   ├── ToastContainer.jsx
│   │   └── shared\            (Field, Modal, SearchBar, Table)
│   ├── context\              (AuthContext ← CRÍTICO sesión+permisos, ThemeContext, ToastContext)
│   ├── store\useStore.js     ← CRÍTICO: todos los datos de la empresa
│   ├── lib\supabase.js       ← solo anon key, nunca service_role
│   ├── utils\                (format.js, fecha.js, chartTheme.js, crearNotificacion.js, ...)
│   └── index.css             ← Design system completo (variables CSS)
└── public\
```

> **Nota:** la doc previa dibujaba este repo como una subcarpeta `vanderbus\` dentro de `C:\vanderbus-app\`, con carpetas hermanas `electron\` y `server\`. **Esas carpetas no están en este repositorio ni en su historial de git** — la raíz del repo *es* el frontend. Además quedan restos de la plantilla Vite sin usar (`src/counter.ts`, `src/main.ts`, `src/style.css`) que conviven con la app real y se pueden eliminar.

---

## Modelo de datos (Supabase)

### Tablas de identidad (multi-tenant)

```
organizations       id, nombre, plan, estado_sub, created_at
profiles            id(FK auth.users), organization_id, nombre, rol, permisos(jsonb), created_at
org_settings        organization_id, tarifa_sin_peon, tarifa_con_peon, minimo_horas, porcentaje_sena, alias_bancario, logo_url, moneda, extra(jsonb)
```

### Tablas operativas (todas tienen organization_id + RLS activo)

```
vehiculos           id(uuid), organization_id, alias, marca, modelo, anio, patente, motor, chasis, kilometraje, combustible, vtv, seguro, aseguradora, poliza, habilitacion, capacidad, observaciones, activo(bool), created_at
combustible         id, organization_id, vehiculo_id, fecha, litros, precio_litro, total, km, proveedor, tipo, notas, created_at
mantenimiento       id, organization_id, vehiculo_id, fecha, categoria, descripcion, taller, costo, km, proximo_km, proximo_fecha, estado, notas, created_at
viajes              id, organization_id, vehiculo_id, fecha, hora, cliente, tipo, origen, destino, monto_sena, monto_total, estado, notas, created_at
contactos           id, organization_id, nombre, tipo, telefono, email, empresa, direccion, notas, created_at
nomina              id, organization_id, fecha, empleado, concepto, importe, periodo, metodo, notas, created_at
ingresos            id, organization_id, tipo, fecha, descripcion, categoria, importe, cliente, comprobante, viaje_id, notas, created_at
gastos              id, organization_id, tipo, fecha, descripcion, categoria, importe, proveedor, comprobante, notas, created_at
marketing           id, organization_id, fecha, tipo, titulo, descripcion, presupuesto, gastado, estado, resultado, notas, created_at
ubicaciones_gps     (realtime) id, organization_id, lat, lng, timestamp, device_id, battery, ...
viajes_gps          (segmentos detectados) id, organization_id, ...
```

**Nota:** la tabla `vehiculo` (singular, sin 's') es un vestigio de la versión anterior. No usarla para registros nuevos. La tabla activa es `vehiculos`.

**Otras tablas vestigiales en Supabase (sin referencias en el código):** `ubicaciones` (la v1 del tracker GPS, reemplazada por `ubicaciones_gps`), `geofences` (experimento de geocercas, vacía) y `oportunidades` (leads scrapeados; el módulo quedó en spec y nunca se implementó). Las tres se cerraron con RLS + `tenant_isolation` en las migraciones de `supabase/migrations/` (2026-07-10). No reabrirlas ni usarlas sin pasar por RLS.

---

## RLS y seguridad

**RLS está ACTIVO** en todas las tablas. La función central es:

```sql
current_org_id() → uuid
-- devuelve la organization_id del usuario logueado, SOLO si su organización
-- tiene estado_sub = 'activa' (si está suspendida/cancelada devuelve NULL).
-- se usa en todas las policies: organization_id = current_org_id()
```

**Estado de suscripción (migración `20260710130000`):** como `current_org_id()` devuelve NULL para orgs no activas, una empresa suspendida pierde lectura y escritura en todas las tablas a nivel RLS, sin tocar el frontend. El frontend consulta el RPC `estado_suscripcion()` (security definer, solo `authenticated`) en `AuthContext` y muestra `<CuentaSuspendida/>` (`main.jsx`) cuando `estadoSub !== 'activa'`. Reactivar un cliente: `update organizations set estado_sub = 'activa' where id = ...`.

El frontend usa **solo la anon key** (visible en `src/lib/supabase.js`). La service_role NUNCA va en el frontend. La única pieza que usa la service_role es la Edge Function `Crear-Usuario`, que corre en los servidores de Supabase.

---

## AuthContext y permisos

```js
const { user, profile, rol, permisos, esOwner, puedeVer, puedeEditar, signIn, signOut, loading } = useAuth()

// Permisos granulares por sección:
puedeVer('viajes')    // true si permisos.viajes es 'ver' o 'editar', o si esOwner
puedeEditar('viajes') // true si permisos.viajes es 'editar', o si esOwner
```

Secciones con permisos: `dashboard`, `viajes`, `combustible`, `mantenimiento`, `vehiculo`, `nomina`, `finanzas`, `marketing`, `seguimiento`.

La sección `usuarios` solo la ve el owner (se chequea con `esOwner`, no con `puedeVer`).

---

## useStore.js — cómo funciona

Singleton (módulo-level state) que:
1. Al SIGNED_IN carga todos los datos de la empresa del usuario de Supabase.
2. Expone `{ data, loading, error, update, exportData, importData }`.
3. `update('tabla', nuevoArray)` detecta altas/bajas/cambios y sincroniza con Supabase.
4. Se refresca solo cada 30 segundos.
5. Al SIGNED_OUT limpia todo.

```js
const { data, update } = useStore()

// Leer datos:
data.viajes         // todos los viajes de esta empresa
data.vehiculos      // flota de vehículos
data.vehiculo       // el primer vehículo activo (para retrocompat con Dashboard)

// Guardar (detecta diff automáticamente):
update('viajes', [...data.viajes, nuevoViaje])
update('vehiculos', data.vehiculos.map(v => v.id === id ? {...v, activo: false} : v))
```

---

## Edge Functions

**`Crear-Usuario`** (capitalización exacta, importante)

```js
// Invocación desde el frontend:
const { data, error } = await supabase.functions.invoke('Crear-Usuario', {
  body: { email, password, nombre, rol, permisos }
})
```

Verifica que quien llama sea owner, crea auth.user + profile en la misma empresa.

**`provisionar-empresa`** (código versionado en `supabase/functions/provisionar-empresa/`)

Alta administrada y atómica de un cliente nuevo: crea auth.user del owner +
`organizations` + `profiles` (owner) + `org_settings` (la parte SQL va en una
transacción: función `provisionar_empresa()`, migración `20260710130200`, solo
ejecutable por service_role). Solo puede invocarla un usuario con
`app_metadata.superadmin = true` (flag que solo se setea con service_role/SQL).

```js
const { data, error } = await supabase.functions.invoke('provisionar-empresa', {
  body: { empresa: 'Transportes X', email: 'owner@x.com', nombre: 'Juan' }
}) // → { organization_id, user_id, email, password? }
```

---

## Design system

### Variables CSS principales (src/index.css)

```css
/* Fondos (dark) */
--bg-base: #09090b; --bg-surface: #101012; --bg-elevated: #18181b; --bg-overlay: #27272a;

/* Textos */
--text-1: #f1f5f9; --text-2: #94a3b8; --text-3: #52525b;

/* Accent */
--accent: #38bdf8; --accent-dim: rgba(56,189,248,0.10);

/* Semánticos */
--positive: #34d399; --danger: #f87171; --warning: #fbbf24;

/* Forma */
--radius: 8px; --radius-sm: 6px;
```

### Clases CSS importantes

```css
.surface          /* panel base: bg-elevated + border + radius */
.surface-hover    /* agrega hover lift */
.glass-btn-primary /* botón de acción principal */
.db-in .db-d{0-8} /* animación de entrada con stagger (delay: N*50ms) */
.db-slabel        /* etiqueta de sección: 12px uppercase mono */
.mod-h1           /* título de módulo: 26px gradient */
.mod-sub          /* subtítulo de módulo */
.modal-panel      /* panel de modal con animación modal-in */
```

Light mode: `[data-theme="light"]` en `<html>` activa las overrides.

### Patrón de módulo típico

```jsx
import { useStore } from '../store/useStore'
import { useAuth } from '../context/AuthContext'
import { Field, Input, Select } from '../components/shared/Field'

export default function MiModulo() {
  const { data, update } = useStore()
  const { puedeEditar } = useAuth()
  const editable = puedeEditar('mi-seccion')

  // ...

  return (
    <div className="max-w-5xl mx-auto">
      <div className="db-in db-d0" style={{ marginBottom: 28 }}>
        <h1 className="mod-h1">Título</h1>
        <p className="mod-sub">Subtítulo</p>
      </div>
      {editable && <button className="glass-btn-primary">Agregar</button>}
    </div>
  )
}
```

---

## Navegación y rutas — `src/routes.jsx`

**Registro único de módulos.** Agregar o cambiar un módulo se hace en UNA fila de
`ROUTES`, no tocando cuatro archivos. Antes esto vivía partido en `TITULOS` +
`OWNER_ONLY` (App.jsx), `GROUPS` (Sidebar.jsx) y `PAGE_FEATURE` (utils/features.js),
y había que mantenerlos en sync a mano: si se desincronizaban, el módulo aparecía
en el menú y tiraba "Sin acceso" al entrar (o peor, al revés).

```js
{ id, path, label, titulo, grupo, icon, acceso, Component, feature? }
```

- **`id`** — token canónico. **Se persiste en `notificaciones.link`**: NO renombrar
  sin migrar esas filas. Es lo que reciben `nav(id)` y `crearNotificacion({link})`.
- **`label`** = texto del sidebar (corto: "GPS"). **`titulo`** = topbar y pestaña
  ("Seguimiento GPS"). Son dos campos a propósito.
- **`acceso`** — `'libre'` | `'permiso'` (→ `puedeVer(id)`) | `'owner'` | `'superadmin'`.
- **`feature`** — flag de `organizations.features`. Se evalúa ANTES que `acceso`:
  un flag apagado oculta el módulo para toda la org, **incluido el owner**.
- **`Component`** — siempre `lazy(() => import(...))`. El chunk baja al entrar.

`puedeAcceder(route, auth)` es la **única** regla de visibilidad: la usan el
Sidebar (qué items pinta) y el guard de ruta (qué deja entrar). No duplicarla.

**Para navegar** usar `useNav()`, nunca `navigate('/viajes')` a mano:

```js
import { useNav } from '../hooks/useNav'
const nav = useNav()
nav('viajes')   // por id de módulo; si el path cambia, cambia solo en routes.jsx
```

---

## Convenciones importantes

1. **IDs:** se generan en el frontend con `genId()` de `src/utils/format.js` (base36 + random). Los vehículos nuevos usan `crypto.randomUUID()`.
2. **Fechas:** siempre ISO `YYYY-MM-DD` al guardar (`toISO()` de `src/utils/fecha.js`).
   Usar `todayISO()` de `src/utils/format.js` para "hoy"; nunca `new Date().toISOString()`
   — eso da UTC y en Argentina devuelve **mañana** a partir de las 21:00 (bug real,
   arreglado 2026-07-16: adelantaba un día el default de todos los formularios).
   **Ojo al leer:** hay filas viejas con fecha en otros formatos (`'6/6/2026'` conviviendo
   con `'2026-05-28'`). Comparar el string crudo ordena mal (`'6'` > `'2'` y esas filas se
   trepan al tope); pasar por `toISO()` antes de comparar u ordenar.
3. **Montos:** siempre strings en la base (legado). Parsear con `parseFloat(r.importe) || 0`. Formatear con `formatARS(n)` de `src/utils/format.js`.
3b. **Horas (`viajes.hora`):** columna TEXT con formatos MEZCLADOS — n8n (Google Forms
   → Viajes) escribe 12h (`'9:00:00 AM'`) y el formulario de la app escribe 24h
   (`'14:30'`, que es lo único que produce `<input type="time">`). Hay filas en `null`.
   **Nunca ordenar ni comparar `hora` como string**: `'11:59:00 AM' < '9:00:00 AM'` como
   texto. Usar siempre `src/utils/hora.js` → `toHora()` (canónico `'HH:MM'` 24h),
   `formatHora()` (display) y `horaOrden()` (minutos, sin hora va al final del día).
   Las filas viejas NO se migran: se normalizan al leer, igual criterio que los montos.
   Al guardar, pasar por `toHora()` para que lo nuevo salga siempre en 24h.
3c. **FKs uuid vs. `''`:** `viajes.vehiculo_id` (y cualquier FK uuid) es **uuid**, no
   text. Un `<Select>` sin selección manda `''` y Postgres lo rechaza con
   *"invalid input syntax for type uuid"*: el guardado falla ENTERO y el usuario
   sólo ve "No se pudieron guardar los cambios". Convertir siempre con
   `campo || null` antes de guardar. (Bug real: crear un viaje sin vehículo
   asignado fue imposible hasta el 2026-07-16.)
3d. **Datos derivados:** un viaje `Realizado` con monto genera un **ingreso espejo**
   en `ingresos` vinculado por `viaje_id`. Toda ruta que toque un viaje (alta,
   edición, cambio de estado, borrado) tiene que mantenerlo sincronizado —
   `sincronizarIngreso()` en `Viajes.jsx` es la única función que lo hace.
   No duplicar esa lógica: un ingreso huérfano miente en Finanzas y no hay forma
   de encontrarlo desde la UI.
4. **Soft delete:** los vehículos no se borran, se archivan con `activo: false`.
   **Ojo en los formularios:** un `<Select>` que filtra `activo !== false` no
   encuentra la opción de un vehículo ya archivado, cae en la primera y al guardar
   pisa el dato. Mismo problema con valores legacy fuera de la lista canónica
   (hay viajes con `tipo: 'Mudanza'`/`'Flete'`, que ya no están en `TIPOS`).
   Ver `conValorActual()` en `Viajes.jsx`.
5. **Formularios:** usar el componente `<Field label="..."><Input/></Field>` de `src/components/shared/Field.jsx`.
6. **Sin Express:** todo va directo a Supabase. No crear endpoints nuevos en el server.

---

## Roadmap (qué falta)

1. **Tarifas por empresa** — leer de `org_settings` en vez de valores hardcodeados.
2. **Onboarding self-service** — pantalla de registro para empresas nuevas (función `crear_empresa()` ya existe en SQL).
3. **SaaS / billing** — planes, límites, webhook de pago. (La suspensión por `estado_sub` ya se aplica a nivel RLS; falta lo que la dispara: cobro/webhook.)
4. **Dominio propio** — `api.vanderbus.app` → Supabase (evita bloqueos de red corporativa).
5. **Nómina mejorada** — sueldo fijo + extras, resumen día 26, notificación WhatsApp via n8n.
6. **Ancho uniforme** — todos los módulos a `max-w-[1680px]` (el Dashboard ya lo tiene).
7. **Deep links a registros** — hoy las rutas llegan al módulo (`/#/viajes`), no a la fila
   (`/#/viajes/:id`). El registro ya soporta params; falta que los módulos lean `useParams()`
   y abran el detalle. Es lo que haría que una notificación linkee al service exacto y no
   sólo a la lista.
8. **Command palette (Ctrl+K)** — saltar a cualquier módulo y buscar registros (viajes,
   contactos, vehículos) desde un solo input. Con 15 módulos, el sidebar ya no alcanza.
9. **Confirmación y undo** — los borrados usan `confirm()` nativo (bloqueante, inconsistente)
   y no hay deshacer. Reemplazar por un dialog propio + toast con undo.
10. **Vestigio del backend Express** — `vite.config.js` todavía define `apiPlugin()`, un
   `/api/viajes` en memoria sobre el dev server. No lo usa nadie del frontend y contradice
   la regla de "backend jubilado". Confirmar con el dueño y borrar.
11. ~~Editar viajes~~ — **hecho** (2026-07-16). Queda la misma deuda en otros módulos:
   `Combustible` y `Nomina` tampoco tienen edición.

---

## Comandos clave

```bash
# Levantar en dev (UNA sola terminal)
cd C:\Users\diego\Desktop\vanderbus-app   # raíz del repo (donde está package.json)
npm run dev

# Claude Code
cd C:\Users\diego\Desktop\vanderbus-app   # raíz del repo (donde está package.json)
claude --dangerously-skip-permissions

# Git (usar ruta completa, Git no está en PATH)
"C:\Program Files\Git\bin\git.exe" add .
"C:\Program Files\Git\bin\git.exe" commit -m "feat: descripcion"
"C:\Program Files\Git\bin\git.exe" push
```

---

## Contacto / contexto del negocio

- **Empresa base:** Vanderbus Transporte, Lomas de Zamora, AMBA
- **Vehículo actual:** Renault Master G9U (patente/datos en Supabase tabla vehiculos)
- **Módulo GPS:** Zebra TC21 del chofer corriendo GPSLogger (Mendhak), POST a Supabase REST cada 30s
- **n8n:** automatizaciones locales (Google Forms → Viajes, Combustible). Correr `start-n8n.bat`.
- **Moneda:** ARS (pesos argentinos)
