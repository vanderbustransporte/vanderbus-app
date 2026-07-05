# Vanderbus App — Sistema de Gestión Multi-Tenant

App web (SPA React + Vite) para empresas de transporte y fletes. Arrancó como una herramienta interna de Vanderbus Transporte y está siendo migrada a una plataforma SaaS multi-tenant donde cada empresa tiene sus propios datos aislados.

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
cd C:\Users\diego\Desktop\vanderbus-app   # raíz del repo
npm run dev
```

Abrí `http://localhost:5173` en el navegador. **No hace falta levantar el server** — el Express fue eliminado. El frontend habla directo con Supabase.

## Credenciales

- **Supabase URL:** `https://mrfwcfuddvexqixfjnuh.supabase.co`
- **Supabase Key:** anon key (pública, en `src/lib/supabase.js`)
- **GitHub repo:** `vanderbustransporte/vanderbus-app`
- **Email owner:** `vanderbustransporte@gmail.com`

## Módulos actuales

| Módulo | Archivo | Estado |
|---|---|---|
| Dashboard | Dashboard.jsx | Activo |
| Flota | Vehiculo.jsx | Activo (multi-vehículo) |
| Combustible | Combustible.jsx | Activo |
| Mantenimiento | Mantenimiento.jsx | Activo |
| Nómina | Nomina.jsx | Activo |
| Finanzas | Finanzas.jsx | Activo |
| Viajes | Viajes.jsx | Activo |
| Marketing | Marketing.jsx | Activo |
| GPS | SeguimientoGPS.jsx | Activo |
| Usuarios | Usuarios.jsx | Activo (solo owner) |
| Oportunidades | — | Eliminado en migración multi-tenant |
