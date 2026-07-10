import React, { useState, useEffect, useRef } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './modules/Dashboard'
import Vehiculo from './modules/Vehiculo'
import Combustible from './modules/Combustible'
import Mantenimiento from './modules/Mantenimiento'
import Nomina from './modules/Nomina'
import Finanzas from './modules/Finanzas'
import Marketing from './modules/Marketing'
import Viajes from './modules/Viajes'
import SeguimientoGPS from './modules/SeguimientoGPS'
import Usuarios from './modules/Usuarios'
import Configuracion from './modules/Configuracion'
import Contactos from './modules/Contactos'
import Notificaciones from './modules/Notificaciones'
import BackupBar from './modules/Backup'
import { useStore, onStoreError } from './store/useStore'
import { supabase } from './lib/supabase'
import NotifCenter from './components/NotifCenter'
import ThemeToggle from './components/ThemeToggle'
import { useToast } from './context/ToastContext'
import { useAuth } from './context/AuthContext'
import { TIPO_CONFIG } from './utils/tipoNotif'
import { useChequeoVencimientos } from './utils/chequeoVencimientos'
import { Menu, LogOut, ChevronDown, AlertTriangle, Lock } from 'lucide-react'

const TITULOS = {
  dashboard:     'Panel de control',
  notificaciones: 'Notificaciones',
  viajes:        'Viajes',
  vehiculo:      'Flota',
  combustible:   'Combustible',
  mantenimiento: 'Mantenimiento',
  seguimiento:   'Seguimiento GPS',
  finanzas:      'Finanzas',
  nomina:        'Nómina',
  contactos:     'Contactos',
  marketing:     'Marketing',
  usuarios:      'Usuarios',
  configuracion: 'Configuración',
  backup:        'Backup / Datos',
}

const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

// Secciones visibles solo para el owner. Mantener en sync con Sidebar (ownerOnly).
const OWNER_ONLY = ['usuarios', 'configuracion', 'backup']

// ── Panel de acceso denegado ───────────────────────────────────────────────────
function AccessDenied() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="surface db-in db-d0" style={{ padding: 48, textAlign: 'center', borderRadius: 'var(--radius)' }}>
        <Lock size={30} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
        <h1 className="mod-h1" style={{ fontSize: 20 }}>Sin acceso</h1>
        <p className="mod-sub">No tenés permiso para ver esta sección.</p>
      </div>
    </div>
  )
}

// ── Menú de usuario (avatar + dropdown con cerrar sesión) ──────────────────────
function UserMenu() {
  const { profile, user, signOut, esOwner } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const nombre = profile?.nombre || user?.email || 'Usuario'
  const inicial = nombre.charAt(0).toUpperCase()

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-md"
        style={{ padding: '4px 6px', background: 'none', border: '1px solid transparent', cursor: 'pointer' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-tint)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
        title="Cuenta"
      >
        <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
          {inicial}
        </span>
        <span className="hidden sm:block" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', maxWidth: 120, ...ellipsis }}>
          {nombre}
        </span>
        <ChevronDown size={14} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
      </button>

      {open && (
        <div
          className="notif-panel-in"
          style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 224, background: 'var(--bg-elevated)', border: '1px solid var(--border-hi)', borderRadius: 'var(--radius)', boxShadow: 'var(--panel-shadow)', overflow: 'hidden', zIndex: 60 }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', ...ellipsis }}>{nombre}</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2, ...ellipsis }}>{user?.email}</div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', marginTop: 6 }}>
              {esOwner ? 'Owner' : 'Staff'}
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2"
            style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-dim)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
          >
            <LogOut size={15} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

// ── Página de Backup / Datos ───────────────────────────────────────────────────
function BackupPage() {
  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="db-in db-d0" style={{ marginBottom: 24 }}>
        <h1 className="mod-h1">Backup / Datos</h1>
        <p className="mod-sub">Exportá una copia de seguridad de tu empresa o restaurá desde un archivo.</p>
      </div>
      <div className="surface db-in db-d1" style={{ padding: 20 }}>
        <BackupBar />
        <div
          className="flex items-start gap-2"
          style={{ marginTop: 16, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--warning-dim)', color: 'var(--warning)', fontSize: 12, lineHeight: 1.5 }}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span><strong>Importar reemplaza todos los datos actuales</strong> de tu empresa por los del archivo. Exportá antes, por las dudas.</span>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const { error, loading } = useStore()
  const { addToast } = useToast()
  const { puedeVer, esOwner } = useAuth()

  // Genera notificaciones automáticas de vencimientos (VTV, seguro, service...).
  useChequeoVencimientos()

  // Espeja la regla de visibilidad del Sidebar: sin esto, navegar por un link de
  // notificacion o un boton del Dashboard podia abrir un modulo sin permiso.
  const canView = (p) => p === 'notificaciones' ? true : OWNER_ONLY.includes(p) ? esOwner : puedeVer(p)

  const [notifCount, setNotifCount] = useState(0)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('vanderbus_sidebar_collapsed') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const fetchNotifCount = () => {
      supabase
        .from('notificaciones')
        .select('id', { count: 'exact', head: true })
        .eq('leida', false)
        .then(({ count }) => { setNotifCount(count ?? 0) })
    }

    fetchNotifCount()

    const channel = supabase
      .channel('notificaciones-badge')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notificaciones' },
        (payload) => {
          fetchNotifCount()
          if (payload.eventType === 'INSERT') {
            const n = payload.new
            if (n.prioridad === 'normal' || n.prioridad === 'alta') {
              const cfg = TIPO_CONFIG[n.tipo] ?? TIPO_CONFIG.sistema
              addToast({ message: n.titulo, Icon: cfg.Icon, color: cfg.color })
            }
          }
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [addToast])

  // Toast cuando un guardado del store falla (RLS, red, columna inexistente, etc.)
  useEffect(() => {
    return onStoreError((message) => {
      addToast({ message, Icon: AlertTriangle, color: 'var(--danger)' })
    })
  }, [addToast])

  const toggleCollapse = () => setCollapsed(c => {
    const next = !c
    localStorage.setItem('vanderbus_sidebar_collapsed', next ? '1' : '0')
    return next
  })

  const titulo = TITULOS[page] || ''
  const fechaRaw = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(',', '')
  const fecha = fechaRaw.charAt(0).toUpperCase() + fechaRaw.slice(1)

  return (
    <div style={{ '--sb-w': `${collapsed ? 64 : 240}px`, minHeight: '100vh' }}>
      <Sidebar
        active={page}
        onNav={setPage}
        unreadCount={notifCount}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Topbar */}
      <header
        className="app-topbar fixed top-0 right-0 z-30 flex items-center gap-3 px-4"
        style={{ height: 56, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', transition: 'left 180ms ease' }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden p-1.5 rounded-md shrink-0"
          style={{ color: 'var(--text-2)' }}
          title="Menú"
        >
          <Menu size={20} />
        </button>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', ...ellipsis }}>{titulo}</div>
        </div>

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="hidden lg:block" style={{ fontSize: 12, color: 'var(--text-2)', marginRight: 6 }}>{fecha}</span>
          <NotifCenter unreadCount={notifCount} onNav={setPage} />
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      {/* Main */}
      <main className="app-main" style={{ paddingTop: 56, minHeight: '100vh', transition: 'margin-left 180ms ease' }}>
        <div className="p-4 sm:p-6 lg:p-8">
          {error && (
            <div
              className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
              style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger-dim)', color: 'var(--danger)' }}
            >
              <span className="font-semibold">Sin conexión al servidor:</span> {error}
            </div>
          )}

          {loading && !error && (
            <div className="mb-4 text-sm px-1" style={{ color: 'var(--text-2)' }}>
              Cargando datos…
            </div>
          )}

          {!canView(page) ? <AccessDenied /> : (
            <>
              {page === 'dashboard'     && <Dashboard onNav={setPage} />}
              {page === 'notificaciones' && <Notificaciones onNav={setPage} />}
              {page === 'vehiculo'      && <Vehiculo />}
              {page === 'combustible'   && <Combustible />}
              {page === 'mantenimiento' && <Mantenimiento />}
              {page === 'nomina'        && <Nomina />}
              {page === 'finanzas'      && <Finanzas />}
              {page === 'viajes'        && <Viajes />}
              {page === 'marketing'     && <Marketing />}
              {page === 'seguimiento'   && <SeguimientoGPS />}
              {page === 'contactos'     && <Contactos />}
              {page === 'usuarios'      && <Usuarios />}
              {page === 'configuracion' && <Configuracion />}
              {page === 'backup'        && <BackupPage />}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
