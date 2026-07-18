import React, { useState, useEffect, useRef, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import CommandPalette from './components/CommandPalette'
import RouteFallback from './components/RouteFallback'
import { useStore, onStoreError } from './store/useStore'
import { supabase } from './lib/supabase'
import NotifCenter from './components/NotifCenter'
import ThemeToggle from './components/ThemeToggle'
import { useToast } from './context/ToastContext'
import { useAuth } from './context/AuthContext'
import { TIPO_CONFIG } from './utils/tipoNotif'
import { aplicarColorPrimario } from './utils/branding'
import { useChequeoVencimientos } from './utils/chequeoVencimientos'
import { ROUTES, puedeAcceder } from './routes'
import { useNav } from './hooks/useNav'
import { Menu, LogOut, ChevronDown, AlertTriangle, Lock, Compass, Search } from 'lucide-react'

const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

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

// ── 404 ────────────────────────────────────────────────────────────────────────
// Con URLs reales una dirección puede no existir (link viejo, typo, módulo
// renombrado). Antes era imposible: `page` sólo tomaba valores del propio código.
function NotFound() {
  const nav = useNav()
  return (
    <div className="max-w-3xl mx-auto">
      <div className="surface db-in db-d0" style={{ padding: 48, textAlign: 'center', borderRadius: 'var(--radius)' }}>
        <Compass size={30} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
        <h1 className="mod-h1" style={{ fontSize: 20 }}>Esta página no existe</h1>
        <p className="mod-sub">El link puede estar viejo o mal escrito.</p>
        <button className="glass-btn-primary" style={{ marginTop: 20 }} onClick={() => nav('dashboard')}>
          Ir al panel de control
        </button>
      </div>
    </div>
  )
}

// ── Guard de ruta ──────────────────────────────────────────────────────────────
// Usa la MISMA `puedeAcceder` que el Sidebar (routes.jsx). Antes App tenía su
// propia copia de la regla y un comentario avisando que "espejaba" la del
// Sidebar; al vivir en un solo lugar ya no pueden divergir.
function Guarded({ route }) {
  const { puedeVer, esOwner, esSuperadmin, featureOn } = useAuth()
  const { Component } = route
  if (!puedeAcceder(route, { puedeVer, esOwner, esSuperadmin, featureOn })) return <AccessDenied />
  return <Component />
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
        className="quiet-btn flex items-center gap-2 rounded-md"
        style={{ padding: '4px 6px', border: '1px solid transparent', cursor: 'pointer' }}
        title="Cuenta"
        aria-haspopup="menu"
        aria-expanded={open}
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
          role="menu"
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
            role="menuitem"
            className="quiet-btn-danger w-full flex items-center gap-2"
            style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, color: 'var(--danger)', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <LogOut size={15} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const { data, error, loading } = useStore()
  const { addToast } = useToast()
  const { orgNombre } = useAuth()
  const location = useLocation()
  const nav = useNav()

  // Genera notificaciones automáticas de vencimientos (VTV, seguro, service...).
  useChequeoVencimientos()

  // Branding por empresa: color primario como acento + nombre en la pestaña.
  // Al desloguear, App se desmonta y el cleanup restaura los defaults.
  const colorPrimario = data?.orgSettings?.color_primario
  useEffect(() => {
    aplicarColorPrimario(colorPrimario)
    return () => aplicarColorPrimario(null)
  }, [colorPrimario])

  // Matchea también las URLs con registro (/viajes/abc123): sin el prefijo, la
  // topbar y la pestaña quedaban sin título al entrar por un deep link.
  const rutaActual = ROUTES.find(r => location.pathname === r.path || location.pathname.startsWith(r.path + '/'))

  // Título de pestaña: ahora refleja también en qué sección estás, que es lo que
  // se ve al tener varias pestañas abiertas del sistema.
  useEffect(() => {
    const empresa = orgNombre || 'Vanderbus'
    document.title = rutaActual ? `${rutaActual.titulo} · ${empresa}` : empresa
  }, [orgNombre, rutaActual])

  const [notifCount, setNotifCount] = useState(0)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('vanderbus_sidebar_collapsed') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Cerrar el menú mobile al cambiar de ruta: sin esto queda abierto tapando el
  // módulo recién navegado.
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

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

  const titulo = rutaActual?.titulo ?? ''
  const fechaRaw = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(',', '')
  const fecha = fechaRaw.charAt(0).toUpperCase() + fechaRaw.slice(1)

  return (
    <div style={{ '--sb-w': `${collapsed ? 64 : 240}px`, minHeight: '100vh' }}>
      {/* Salto directo al contenido: el sidebar son ~15 tabs antes del módulo. */}
      <a href="#contenido" className="skip-link">Saltar al contenido</a>

      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        unreadCount={notifCount}
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
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', ...ellipsis }}>{titulo}</div>
        </div>

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="hidden lg:block" style={{ fontSize: 12, color: 'var(--text-2)', marginRight: 6 }}>{fecha}</span>

          {/* Buscador global: mismo destino que Ctrl+K. En mobile queda solo la lupa. */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="btn-ghost flex items-center gap-2"
            style={{ padding: '6px 10px', cursor: 'pointer', marginRight: 4 }}
            title="Buscar (Ctrl+K)"
            aria-label="Buscar"
          >
            <Search size={14} />
            <span className="hidden sm:block" style={{ fontSize: 12 }}>Buscar</span>
            <kbd
              className="hidden sm:block"
              style={{ padding: '0px 5px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 10, fontWeight: 600, color: 'var(--text-3)' }}
            >
              Ctrl K
            </kbd>
          </button>

          <NotifCenter unreadCount={notifCount} onNav={nav} />
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <CommandPalette
        open={paletteOpen}
        onOpen={() => setPaletteOpen(true)}
        onClose={() => setPaletteOpen(false)}
      />

      {/* Main */}
      <main id="contenido" className="app-main" style={{ paddingTop: 56, minHeight: '100vh', transition: 'margin-left 180ms ease' }}>
        <div className="p-4 sm:p-6 lg:p-8">
          {error && (
            <div
              className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
              style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger-dim)', color: 'var(--danger)' }}
              role="alert"
            >
              <span className="font-semibold">Sin conexión al servidor:</span> {error}
            </div>
          )}

          {loading && !error && (
            <div className="mb-4 text-sm px-1" style={{ color: 'var(--text-2)' }}>
              Cargando datos…
            </div>
          )}

          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              {ROUTES.map(route => (
                <React.Fragment key={route.id}>
                  <Route path={route.path} element={<Guarded route={route} />} />
                  {/* Deep link a un registro: mismo componente y mismo guard; el
                      módulo lee :registroId con useRegistroDestacado(). */}
                  {route.detalle && (
                    <Route path={`${route.path}/:registroId`} element={<Guarded route={route} />} />
                  )}
                </React.Fragment>
              ))}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  )
}
