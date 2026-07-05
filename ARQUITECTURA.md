# Vanderbus App — Arquitectura técnica (para Diego)

Este documento describe cómo está construida la app hoy, después de la migración multi-tenant. Es el punto de partida para cualquier colaborador nuevo.

---

## 1. Modelo de datos multi-tenant

El aislamiento entre empresas se basa en tres pilares:

### 1.1 Tablas de identidad

```sql
organizations       -- cada empresa que usa la plataforma
  id (uuid PK)
  nombre
  plan              -- 'trial' | 'basico' | 'pro'
  estado_sub        -- 'activa' | 'suspendida' | 'cancelada'
  created_at

profiles            -- extiende auth.users de Supabase
  id (uuid FK → auth.users)
  organization_id (FK → organizations)
  nombre
  rol               -- 'owner' | 'staff'
  permisos (jsonb)  -- { dashboard:'ver', viajes:'editar', ... }
  created_at

org_settings        -- configuracion por empresa
  organization_id (PK FK → organizations)
  tarifa_sin_peon   -- default 55000 ARS
  tarifa_con_peon   -- default 70000 ARS
  minimo_horas      -- default 3
  porcentaje_sena   -- default 10
  alias_bancario
  logo_url
  color_primario
  moneda            -- default 'ARS'
  extra (jsonb)
```

### 1.2 Tablas operativas

Todas tienen la columna `organization_id` que las ata a una empresa:

```
vehiculos, combustible, mantenimiento, contactos,
nomina, ingresos, gastos, marketing, viajes
```

La tabla `vehiculo` (singular, sin 's') es un vestigio de la versión single-tenant. Los nuevos registros usan `vehiculos` (plural).

### 1.3 Row Level Security (RLS)

**ACTIVO** en todas las tablas. La policy central es:

```sql
-- En cada tabla operativa:
create policy tenant_isolation on <tabla> for all
  using (organization_id = current_org_id())
  with check (organization_id = current_org_id());

-- Helper function (SECURITY DEFINER para evitar recursion):
create function current_org_id() returns uuid as $$
  select organization_id from profiles where id = auth.uid()
$$ language sql stable security definer;
```

**IMPORTANTE:** el frontend usa la `anon key` de Supabase (no la service_role). RLS es la única barrera de aislamiento. No la desactivar nunca.

### 1.4 Funciones SQL útiles

```sql
-- Crear empresa nueva (onboarding de clientes nuevos)
select crear_empresa('Nombre de la empresa', 'Nombre del admin');

-- Verificar si el usuario actual es owner
select is_owner();
```

---

## 2. Flujo de autenticación

```
Usuario abre la app
    ↓
AuthContext.jsx (src/context/AuthContext.jsx)
    ↓
supabase.auth.getSession()
    ↓
¿Hay sesión?
  NO → mostrar Login.jsx
  SÍ → cargar profile (rol + permisos) → mostrar App.jsx
```

### Helpers de permisos

```js
const { puedeVer, puedeEditar, esOwner } = useAuth()

puedeVer('viajes')    // true si permisos.viajes === 'ver' || 'editar' || esOwner
puedeEditar('viajes') // true si permisos.viajes === 'editar' || esOwner
```

El owner ignora los permisos (siempre true). Para usuarios staff, los permisos son un objeto JSON con 9 secciones, cada una con valor 'ninguno' | 'ver' | 'editar'.

---

## 3. Store de datos (useStore.js)

`src/store/useStore.js` es un singleton que:

1. Al iniciar sesión, carga **todos** los datos de la empresa del usuario.
2. Expone `{ data, loading, error, update, exportData, importData }`.
3. La función `update('tabla', nuevoArray)` detecta automáticamente altas/bajas/cambios y sincroniza con Supabase.
4. Se refresca solo cada 30 segundos.
5. Al cerrar sesión, limpia todos los datos.

```js
// Uso en cualquier módulo:
const { data, update } = useStore()

// Leer:
const viajes = data.viajes  // array con todos los viajes de la empresa

// Guardar:
update('viajes', [...data.viajes, nuevoViaje])
```

**Las tablas disponibles en `data`:**
`vehiculos`, `vehiculo` (principal, derivado), `combustible`, `mantenimiento`, `contactos`, `nomina`, `ingresos`, `gastos`, `marketing`, `viajes`

---

## 4. Edge Functions

Una sola Edge Function deployada en Supabase:

**`Crear-Usuario`** (notar capitalización exacta)
- URL: `https://mrfwcfuddvexqixfjnuh.supabase.co/functions/v1/Crear-Usuario`
- Recibe: `{ email, password, nombre, rol, permisos }`
- Valida que quien llama sea owner de su empresa
- Crea el usuario en auth.users + su profile en la misma empresa
- Se invoca desde el módulo Usuarios:

```js
await supabase.functions.invoke('Crear-Usuario', {
  body: { email, password, nombre, rol, permisos }
})
```

---

## 5. Sistema de permisos granular

Los permisos se guardan en `profiles.permisos` como jsonb:

```json
{
  "dashboard": "ver",
  "viajes": "editar",
  "combustible": "editar",
  "mantenimiento": "ver",
  "vehiculo": "ninguno",
  "nomina": "ninguno",
  "finanzas": "ninguno",
  "marketing": "ver",
  "seguimiento": "ver"
}
```

**Aplicación en los módulos:**
- El **menú** (Sidebar.jsx) filtra las secciones con `puedeVer(it.id)`.
- La sección "Usuarios" solo aparece si `esOwner`.
- Dentro de cada módulo, los botones de crear/editar/borrar están envueltos en `{editable && (...)}` donde `editable = puedeEditar('seccion')`.

---

## 6. GPS Tracking

- El chofer usa una app **GPSLogger** (Mendhak) en un dispositivo Zebra.
- GPSLogger hace POST cada 30 segundos a la REST API de Supabase (`/rest/v1/ubicaciones_gps`).
- El módulo `SeguimientoGPS.jsx` usa Leaflet + suscripción realtime de Supabase para mostrar el mapa en vivo.
- La tabla `viajes_gps` guarda los segmentos de viaje detectados automáticamente.

---

## 7. Design system

El CSS vive en `src/index.css`. Variables clave:

```css
--bg-base, --bg-surface, --bg-elevated, --bg-overlay  /* Fondos */
--text-1, --text-2, --text-3                           /* Textos */
--accent (#38bdf8), --accent-dim, --accent-glow        /* Celeste */
--positive, --danger, --warning                        /* Semánticos */
--border, --border-hi                                  /* Bordes */
--radius (8px), --radius-sm (6px)                      /* Redondeos */
```

Clases utilitarias importantes:
- `.surface` — panel con fondo elevado y borde
- `.glass-btn-primary` — botón de acción principal
- `.db-in .db-d{0-8}` — animación de entrada escalonada
- `.db-slabel` — etiqueta de sección (uppercase, mono)
- `.mod-h1`, `.mod-sub` — título y subtítulo de módulo

Soporte dark/light mode via `[data-theme="light"]` en el HTML.

---

## 8. Archivos críticos que NO tocar sin entender bien

| Archivo | Por qué es crítico |
|---|---|
| `src/lib/supabase.js` | Solo tiene la anon key. Nunca meter service_role acá. |
| `src/context/AuthContext.jsx` | Maneja toda la sesión y permisos. |
| `src/store/useStore.js` | Singleton global. Cambios acá afectan toda la app. |
| `src/index.css` (variables :root) | El design system completo vive acá. |

---

## 9. Roadmap pendiente

En orden de prioridad:

1. **Tarifas y branding por empresa** — mover los valores hardcodeados de Vanderbus a `org_settings`. Hoy `tarifa_sin_peon`, `tarifa_con_peon`, etc. existen en la tabla pero la calculadora de precios no los lee de ahí todavía.
2. **Registro self-service de empresas nuevas** — la función `crear_empresa()` ya existe en SQL. Falta la pantalla de onboarding (registro → crea empresa → wizard inicial).
3. **Cobro / suscripción SaaS** — planes, límites por plan (cantidad de vehículos, usuarios), webhook de pago (MercadoPago o Stripe). La validación de suscripción tiene que vivir en una Edge Function, no en el frontend.
4. **Dominio propio para Supabase** — hoy la app conecta a `*.supabase.co`. Algunos clientes pueden tener ese dominio bloqueado. Configurar un dominio propio (ej. `api.vanderbus.app`) resuelve esto.
5. **Nómina mejorada** — sueldo fijo + extras por viajes fuera de horario, resumen al día 26, notificación WhatsApp via n8n.
6. **Ancho de contenedor global** — hoy el Dashboard usa `max-w-[1680px]` (ancho total) pero los demás módulos siguen con `max-w-4xl`/`max-w-5xl`. Uniformizar.

---

## 10. Comandos útiles

```bash
# Desarrollo (solo frontend, Express no se usa más)
cd C:\Users\diego\Desktop\vanderbus-app   # raíz del repo
npm run dev

# Claude Code con permisos skip
cd C:\Users\diego\Desktop\vanderbus-app   # raíz del repo
claude --dangerously-skip-permissions

# Git (siempre usar la ruta completa)
"C:\Program Files\Git\bin\git.exe" add .
"C:\Program Files\Git\bin\git.exe" commit -m "mensaje"
"C:\Program Files\Git\bin\git.exe" push
```
