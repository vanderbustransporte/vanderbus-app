import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { Truck, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../store/useStore'
import { ROUTES, GRUPOS, puedeAcceder } from '../routes'

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile, unreadCount = 0 }) {
  const { puedeVer, esOwner, esSuperadmin, featureOn, orgNombre } = useAuth()
  const { data } = useStore()
  const width = collapsed ? 64 : 240

  // Branding: logo y nombre de la empresa (org_settings.logo_url +
  // organizations.nombre), con fallback al ícono y nombre del producto.
  const logoUrl = data.orgSettings?.logo_url || ''
  const [logoRoto, setLogoRoto] = useState(false)
  useEffect(() => { setLogoRoto(false) }, [logoUrl])
  const conLogo = logoUrl && !logoRoto

  // La regla de visibilidad sale de routes.jsx — la misma que usa el guard de
  // ruta en App. El menú no puede ofrecer algo que el guard después rechace.
  const auth = { puedeVer, esOwner, esSuperadmin, featureOn }
  const visibles = ROUTES.filter(r => puedeAcceder(r, auth))

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onCloseMobile} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full z-50 md:z-40 flex flex-col md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Navegación principal"
        style={{
          width,
          background: 'var(--sb-bg)',
          borderRight: '1px solid var(--sb-border)',
          transition: 'width 180ms ease, transform 220ms cubic-bezier(0.23,1,0.32,1)',
        }}
      >
        {/* Logo / header */}
        <div
          className="flex items-center h-14 px-3 shrink-0"
          style={{ borderBottom: '1px solid var(--sb-border)' }}
        >
          <button
            onClick={collapsed ? onToggleCollapse : undefined}
            className="flex items-center gap-2 overflow-hidden"
            style={{ background: 'none', border: 'none', padding: 0, cursor: collapsed ? 'pointer' : 'default' }}
            title={collapsed ? 'Expandir menú' : undefined}
          >
            {conLogo ? (
              <img
                src={logoUrl}
                alt=""
                onError={() => setLogoRoto(true)}
                className="w-8 h-8 rounded-lg shrink-0"
                style={{ objectFit: 'cover', background: 'rgba(255,255,255,0.12)' }}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                <Truck size={16} style={{ color: 'var(--sb-logo)' }} />
              </div>
            )}
            {!collapsed && (
              <span className="font-bold text-sm truncate" style={{ color: 'var(--sb-logo)', letterSpacing: '-0.01em' }}>
                {orgNombre || 'Vanderbus'}
              </span>
            )}
          </button>
          {!collapsed && (
            <button
              onClick={onToggleCollapse}
              className="ml-auto hidden md:flex items-center justify-center w-7 h-7 rounded-md shrink-0 sb-icon-btn"
              style={{ color: 'var(--sb-text)' }}
              title="Colapsar menú"
              aria-label="Colapsar menú"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {GRUPOS.map(grupo => {
            const items = visibles.filter(r => r.grupo === grupo)
            if (!items.length) return null
            return (
              <div key={grupo} className="mb-4">
                {collapsed ? (
                  <div className="mx-3 mb-2" style={{ height: 1, background: 'var(--sb-border)' }} />
                ) : (
                  <div
                    className="px-4 mb-1.5"
                    style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--sb-label)' }}
                  >
                    {grupo}
                  </div>
                )}
                <div className="px-2 flex flex-col gap-0.5">
                  {items.map(({ id, path, label, icon: Icon }) => {
                    const badge = id === 'notificaciones' ? unreadCount : 0
                    return (
                      <NavLink
                        key={id}
                        to={path}
                        onClick={onCloseMobile}
                        title={collapsed ? label : undefined}
                        className={({ isActive }) => `sb-item${isActive ? ' is-active' : ''}${collapsed ? ' is-collapsed' : ''}`}
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && <span className="sb-item-bar" />}
                            <Icon size={17} style={{ flexShrink: 0 }} />
                            {!collapsed && <span className="truncate">{label}</span>}
                            {badge > 0 && !collapsed && (
                              <span className="sb-badge">{badge > 99 ? '99+' : badge}</span>
                            )}
                            {badge > 0 && collapsed && <span className="sb-badge-dot" />}
                          </>
                        )}
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* Expand hint when collapsed */}
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex items-center justify-center h-10 shrink-0 sb-icon-btn"
            style={{ color: 'var(--sb-text)', borderTop: '1px solid var(--sb-border)' }}
            title="Expandir menú"
            aria-label="Expandir menú"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </aside>
    </>
  )
}
