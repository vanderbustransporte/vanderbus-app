import { lazy } from 'react'
import {
  LayoutDashboard, MapPin, Truck, Fuel, Wrench, Navigation,
  TrendingUp, DollarSign, Contact, Megaphone, Users, Database,
  Settings, Bell, Building2, IdCard,
} from 'lucide-react'

// ── Registro único de módulos ────────────────────────────────────────────────
//
// Antes esto vivía partido en cuatro lugares que había que editar en sync para
// agregar una sección: TITULOS y OWNER_ONLY (App.jsx), GROUPS (Sidebar.jsx) y
// PAGE_FEATURE (utils/features.js). App.jsx incluso avisaba en un comentario
// que su regla de visibilidad "espejaba" la del Sidebar — - si se desincronizaban,
// un módulo aparecía en el menú y tiraba "Sin acceso" al entrar (o peor, al revés).
// Ahora agregar un módulo es agregar UNA fila acá.
//
// `id` es el token canónico de navegación y se persiste en `notificaciones.link`
// (ver utils/chequeoVencimientos.js). NO renombrar un id sin migrar esas filas.
//
// `label` es el texto del sidebar (corto, entra en 240px y en el ancho colapsado)
// y `titulo` el de la topbar y la pestaña del navegador (largo y explícito). Son
// dos campos y no uno a propósito: el menú dice "GPS", la topbar "Seguimiento GPS".
//
// `acceso`:
//   'libre'      → cualquier usuario con sesión
//   'permiso'    → puedeVer(id) según profiles.permisos
//   'owner'      → solo el owner de la empresa
//   'superadmin' → solo plataforma (app_metadata.superadmin), no el cliente
//
// `feature` (opcional) → flag de organizations.features. Un flag apagado oculta
// el módulo para TODA la org, incluido el owner, y se evalúa ANTES que `acceso`.
//
// `detalle: true` → el módulo acepta deep link a un registro: `path/:registroId`
// (ej: /#/viajes/abc123). App.jsx monta la ruta con parámetro y el módulo la
// consume con useRegistroDestacado() (limpia filtros, scrollea y resalta la fila).
// `notificaciones.link` puede llevar el token 'modulo:registroId'; useNav lo parsea.
//
// Cada `Component` es lazy: el chunk del módulo se baja recién al entrar. Así el
// mapa (Leaflet) y los gráficos (Recharts) no los paga quien nunca los abre.

const Dashboard      = lazy(() => import('./modules/Dashboard'))
const Notificaciones = lazy(() => import('./modules/Notificaciones'))
const Viajes         = lazy(() => import('./modules/Viajes'))
const Vehiculo       = lazy(() => import('./modules/Vehiculo'))
const Combustible    = lazy(() => import('./modules/Combustible'))
const Mantenimiento  = lazy(() => import('./modules/Mantenimiento'))
const SeguimientoGPS = lazy(() => import('./modules/SeguimientoGPS'))
const Finanzas       = lazy(() => import('./modules/Finanzas'))
const Nomina         = lazy(() => import('./modules/Nomina'))
const Contactos      = lazy(() => import('./modules/Contactos'))
const Marketing      = lazy(() => import('./modules/Marketing'))
const Configuracion  = lazy(() => import('./modules/Configuracion'))
const Usuarios       = lazy(() => import('./modules/Usuarios'))
const Choferes       = lazy(() => import('./modules/Choferes'))
const BackupPage     = lazy(() => import('./modules/BackupPage'))
const Superadmin     = lazy(() => import('./modules/Superadmin'))

export const GRUPOS = ['Operación', 'Administración', 'Crecimiento', 'Sistema', 'Plataforma']

export const ROUTES = [
  // ── Operación ──
  { id: 'dashboard',      path: '/dashboard',      label: 'Dashboard',     titulo: 'Panel de control', grupo: 'Operación',      icon: LayoutDashboard, acceso: 'permiso',    Component: Dashboard },
  { id: 'notificaciones', path: '/notificaciones', label: 'Notificaciones', titulo: 'Notificaciones',  grupo: 'Operación',      icon: Bell,            acceso: 'libre',      Component: Notificaciones },
  { id: 'viajes',         path: '/viajes',         label: 'Viajes',        titulo: 'Viajes',           grupo: 'Operación',      icon: MapPin,          acceso: 'permiso',    Component: Viajes, detalle: true },
  { id: 'vehiculo',       path: '/vehiculo',       label: 'Flota',         titulo: 'Flota',            grupo: 'Operación',      icon: Truck,           acceso: 'permiso',    Component: Vehiculo, detalle: true },
  { id: 'choferes',       path: '/choferes',       label: 'Choferes',      titulo: 'Choferes',         grupo: 'Operación',      icon: IdCard,          acceso: 'permiso',    Component: Choferes, detalle: true },
  { id: 'combustible',    path: '/combustible',    label: 'Combustible',   titulo: 'Combustible',      grupo: 'Operación',      icon: Fuel,            acceso: 'permiso',    Component: Combustible },
  { id: 'mantenimiento',  path: '/mantenimiento',  label: 'Mantenimiento', titulo: 'Mantenimiento',    grupo: 'Operación',      icon: Wrench,          acceso: 'permiso',    Component: Mantenimiento, detalle: true },
  { id: 'seguimiento',    path: '/seguimiento',    label: 'GPS',           titulo: 'Seguimiento GPS',  grupo: 'Operación',      icon: Navigation,      acceso: 'permiso',    Component: SeguimientoGPS, feature: 'seguimiento' },

  // ── Administración ──
  { id: 'finanzas',       path: '/finanzas',       label: 'Finanzas',      titulo: 'Finanzas',         grupo: 'Administración', icon: TrendingUp,      acceso: 'permiso',    Component: Finanzas },
  { id: 'nomina',         path: '/nomina',         label: 'Nómina',        titulo: 'Nómina',           grupo: 'Administración', icon: DollarSign,      acceso: 'permiso',    Component: Nomina },
  { id: 'contactos',      path: '/contactos',      label: 'Contactos',     titulo: 'Contactos',        grupo: 'Administración', icon: Contact,         acceso: 'permiso',    Component: Contactos, detalle: true },

  // ── Crecimiento ──
  { id: 'marketing',      path: '/marketing',      label: 'Marketing',     titulo: 'Marketing',        grupo: 'Crecimiento',    icon: Megaphone,       acceso: 'permiso',    Component: Marketing, feature: 'marketing' },

  // ── Sistema ──
  { id: 'configuracion',  path: '/configuracion',  label: 'Configuración', titulo: 'Configuración',    grupo: 'Sistema',        icon: Settings,        acceso: 'owner',      Component: Configuracion },
  { id: 'usuarios',       path: '/usuarios',       label: 'Usuarios',      titulo: 'Usuarios',         grupo: 'Sistema',        icon: Users,           acceso: 'owner',      Component: Usuarios },
  { id: 'backup',         path: '/backup',         label: 'Backup',        titulo: 'Backup / Datos',   grupo: 'Sistema',        icon: Database,        acceso: 'owner',      Component: BackupPage },

  // ── Plataforma (nosotros, no el cliente) ──
  { id: 'superadmin',     path: '/superadmin',     label: 'Empresas',      titulo: 'Empresas',         grupo: 'Plataforma',     icon: Building2,       acceso: 'superadmin', Component: Superadmin },
]

const POR_ID = new Map(ROUTES.map(r => [r.id, r]))

export function rutaDe(id) {
  return POR_ID.get(id) ?? null
}

// id de navegación → path. Fallback al dashboard para ids desconocidos: las filas
// viejas de `notificaciones.link` apuntan a módulos que podrían no existir más.
export function pathDe(id) {
  return POR_ID.get(id)?.path ?? '/dashboard'
}

// Fuente ÚNICA de la regla de visibilidad: la usan el Sidebar (qué items pinta)
// y el guard de ruta (qué deja entrar). Al salir del mismo lugar no pueden
// desincronizarse.
export function puedeAcceder(route, { puedeVer, esOwner, esSuperadmin, featureOn }) {
  if (!route) return false
  if (route.feature && !featureOn(route.feature)) return false
  if (route.acceso === 'libre')      return true
  if (route.acceso === 'owner')      return esOwner
  if (route.acceso === 'superadmin') return esSuperadmin
  return puedeVer(route.id)
}
