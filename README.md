# Vanderbus App — Sistema de Gestión Multi-Tenant

App web (SPA React + Vite) para empresas de transporte. Arrancó como una herramienta interna de Vanderbus Transporte y está siendo migrada a una plataforma SaaS multi-tenant donde cada empresa tiene sus propios datos aislados.

> **Este repo es solo el frontend web.** Se abre en el navegador con `npm run dev`. No hay código de Electron ni backend propio versionado acá (ni en el historial de git). La versión anterior de este README lo describía como "app de escritorio Electron"; si un wrapper de escritorio existe, vive fuera de este repositorio.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite + Tailwind CSS 4 (SPA web) |
| Desktop | — *(no presente en este repo; ver nota arriba)* |
| Base de datos | Supabase (PostgreSQL + Auth + RLS + Edge Functions) |
| Estado | Zustand-style singleton (`useStore.js`) |
| Tipografía | Plus Jakarta Sans + Geist Mono |
| Iconos | Lucide React |
| Gráficos | Recharts |
| Mapas | Leaflet + OpenStreetMap |
| Automatizaciones | n8n (local) |

## Estructura del repositorio

```
vanderbus-app\          ← raíz del repo (Frontend React, acá está package.json)
├── src\
│   ├── modules\        ← Un archivo = un módulo de la app
│   ├── components\     ← Componentes compartidos (Sidebar, NotifCenter, etc)
│   ├── context\        ← AuthContext, ThemeContext, ToastContext
│   ├── store\          ← useStore.js (acceso global a datos)
│   ├── lib\            ← supabase.js (cliente de Supabase)
│   └── utils\          ← format.js, fecha.js, chartTheme.js
├── public\
├── index.html
└── vite.config.js
```

> **Nota:** la versión anterior de este README listaba también carpetas `server\` (Express jubilado), `electron\`, y archivos `dev.bat` / `setup-supabase.sql`. **Nada de eso está en este repo ni en su historial de git** — la raíz del repositorio es directamente el frontend. El Express fue eliminado (el frontend habla directo a Supabase); el esquema SQL vive en Supabase (ver `ARQUITECTURA.md`).

## Cómo levantar en desarrollo

```bash
npm install
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
# completar .env con los valores reales (pedírselos a quien ya los tenga)
npm run dev
```

Abrí `http://localhost:5173` en el navegador (si el puerto está ocupado, Vite salta al 5174). **No hace falta levantar ningún server** — el Express fue eliminado. El frontend habla directo con Supabase.

Sin `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` la app aborta el arranque con un error explícito, a propósito.

## Antes de empezar a tocar código

| Leer | Para qué |
|---|---|
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Cómo trabajamos: ramas, PRs, migraciones, cómo no pisarnos |
| [`docs/estado-proyecto.md`](docs/estado-proyecto.md) | Qué está hecho, qué migraciones faltan aplicar, quién está en qué |
| [`.claude/skills/vanderbus-app.md`](.claude/skills/vanderbus-app.md) | Arquitectura, modelo de datos y convenciones de código (las trampas de datos están acá) |
| [`ARQUITECTURA.md`](ARQUITECTURA.md) | Esquema de la base |

## Configuración

- **Credenciales:** en `.env`, nunca en el código. Ver `.env.example`.
- **GitHub repo:** `vanderbustransporte/vanderbus-app`
- **Seguridad:** la anon key es pública por diseño (Vite la mete en el bundle); la barrera real es RLS. La `service_role` key **nunca** va en el frontend.

## Módulos actuales

Los módulos se registran en un único lugar: `src/routes.jsx`. Esa tabla es la fuente de verdad (path, permisos, feature flag, lazy import); lo de abajo es un resumen.

| Módulo | Archivo | Estado |
|---|---|---|
| Dashboard | Dashboard.jsx | Activo |
| Viajes | Viajes.jsx | Activo (con despacho y tracking público) |
| Flota | Vehiculo.jsx | Activo (multi-vehículo) |
| Choferes | Choferes.jsx | Activo (legajo + vencimientos) |
| Combustible | Combustible.jsx | Activo (con vales / cuenta corriente) |
| Mantenimiento | Mantenimiento.jsx | Activo |
| Nómina | Nomina.jsx | Activo |
| Finanzas | Finanzas.jsx | Activo (resumen, movimientos, clientes, rentabilidad) |
| Contactos | Contactos.jsx | Activo |
| Marketing | Marketing.jsx | Activo |
| GPS | SeguimientoGPS.jsx | Activo |
| Backup | BackupPage.jsx | Activo |
| Usuarios | Usuarios.jsx | Activo (solo owner) |
| Oportunidades | — | Eliminado en migración multi-tenant |
