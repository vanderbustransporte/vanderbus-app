# Vanderbus App — Sistema de Gestión Multi-Tenant

App de escritorio (Electron + React) para empresas de transporte y fletes. Arrancó como una herramienta interna de Vanderbus Transporte y está siendo migrada a una plataforma SaaS multi-tenant donde cada empresa tiene sus propios datos aislados.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Desktop | Electron (frameless window, auto-updater) |
| Base de datos | Supabase (PostgreSQL + Auth + RLS + Edge Functions) |
| Estado | Zustand-style singleton (`useStore.js`) |
| Tipografía | Plus Jakarta Sans + Geist Mono |
| Iconos | Lucide React |
| Gráficos | Recharts |
| Mapas | Leaflet + OpenStreetMap |
| Automatizaciones | n8n (local) |

## Estructura del repositorio

```
C:\vanderbus-app\
├── vanderbus\          ← Frontend React (este repo)
│   ├── src\
│   │   ├── modules\    ← Una carpeta = un módulo de la app
│   │   ├── components\ ← Componentes compartidos (Sidebar, NotifCenter, etc)
│   │   ├── context\    ← AuthContext, ThemeContext, ToastContext
│   │   ├── store\      ← useStore.js (acceso global a datos)
│   │   ├── lib\        ← supabase.js (cliente de Supabase)
│   │   └── utils\      ← format.js, fecha.js, chartTheme.js
│   ├── public\
│   ├── index.html
│   └── vite.config.js
├── server\             ← Backend Express JUBILADO (no usar)
│   └── index.js        ← Solo referencia histórica, ya no se usa
├── electron\           ← Main process de Electron
├── dev.bat             ← Levanta frontend en modo dev
└── setup-supabase.sql  ← Schema original (ver ARQUITECTURA.md para el actual)
```

## Cómo levantar en desarrollo

```bash
cd C:\vanderbus-app\vanderbus
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
