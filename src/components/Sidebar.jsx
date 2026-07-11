import React, { useState, useEffect } from 'react'
import {
  LayoutDashboard, MapPin, Truck, Fuel, Wrench, Navigation,
  TrendingUp, DollarSign, Contact, Megaphone, Users, Database,
  Settings, ChevronLeft, ChevronRight, Bell, Building2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../store/useStore'

const GROUPS = [
  {
    label: 'Operación',
    items: [
      { id: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
      { id: 'notificaciones', label: 'Notificaciones', icon: Bell, always: true },
      { id: 'viajes',        label: 'Viajes',        icon: MapPin },
      { id: 'vehiculo',      label: 'Flota',         icon: Truck },
      { id: 'combustible',   label: 'Combustible',   icon: Fuel },
      { id: 'mantenimiento', label: 'Mantenimiento', icon: Wrench },
      // Gateado por feature flag (apagado por defecto): reemplaza el
      // ocultar-por-codigo. ubicaciones_gps ya tiene RLS (migracion 120100);
      // prenderlo por org desde el panel Empresas cuando el tracker este listo.
      { id: 'seguimiento',   label: 'GPS',           icon: Navigation, feature: 'seguimiento' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { id: 'finanzas',  label: 'Finanzas',  icon: TrendingUp },
      { id: 'nomina',    label: 'Nómina',    icon: DollarSign },
      { id: 'contactos', label: 'Contactos', icon: Contact },
    ],
  },
  {
    label: 'Crecimiento',
    items: [
      { id: 'marketing', label: 'Marketing', icon: Megaphone, feature: 'marketing' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { id: 'configuracion', label: 'Configuración', icon: Settings, ownerOnly: true },
      { id: 'usuarios',      label: 'Usuarios',      icon: Users,    ownerOnly: true },
      { id: 'backup',        label: 'Backup',        icon: Database, ownerOnly: true },
    ],
  },
  {
    // Grupo de plataforma (nosotros, no el cliente): solo con app_metadata.superadmin.
    label: 'Plataforma',
    items: [
      { id: 'superadmin', label: 'Empresas', icon: Building2, superadminOnly: true },
    ],
  },
]

export default function Sidebar({ active, onNav, collapsed, onToggleCollapse, mobileOpen, onCloseMobile, unreadCount = 0 }) {
  const { puedeVer, esOwner, esSuperadmin, featureOn, orgNombre } = useAuth()
  const { data } = useStore()
  const width = collapsed ? 64 : 240

  // Branding: logo y nombre de la empresa (org_settings.logo_url +
  // organizations.nombre), con fallback al ícono y nombre del producto.
  const logoUrl = data.orgSettings?.logo_url || ''
  const [logoRoto, setLogoRoto] = useState(false)
  useEffect(() => { setLogoRoto(false) }, [logoUrl])
  const conLogo = logoUrl && !logoRoto

  // Un feature flag apagado oculta el item para toda la org (owner incluido);
  // recien despues aplican los permisos por usuario.
  const visible = (it) => {
    if (it.feature && !featureOn(it.feature)) return false
    return it.superadminOnly ? esSuperadmin : it.always ? true : it.ownerOnly ? esOwner : puedeVer(it.id)
  }
  const handleNav = (id) => { onNav(id); onCloseMobile?.() }

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onCloseMobile} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full z-50 md:z-40 flex flex-col md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
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
              className="ml-auto hidden md:flex items-center justify-center w-7 h-7 rounded-md shrink-0"
              style={{ color: 'var(--sb-text)' }}
              title="Colapsar menú"
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--sb-hover)'; e.currentTarget.style.color = 'var(--sb-text-active)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--sb-text)' }}
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {GROUPS.map(group => {
            const items = group.items.filter(visible)
            if (!items.length) return null
            return (
              <div key={group.label} className="mb-4">
                {collapsed ? (
                  <div className="mx-3 mb-2" style={{ height: 1, background: 'var(--sb-border)' }} />
                ) : (
                  <div
                    className="px-4 mb-1.5"
                    style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--sb-label)' }}
                  >
                    {group.label}
                  </div>
                )}
                <div className="px-2 flex flex-col gap-0.5">
                  {items.map(({ id, label, icon: Icon }) => {
                    const isActive = active === id
                    const badge = id === 'notificaciones' ? unreadCount : 0
                    return (
                      <button
                        key={id}
                        onClick={() => handleNav(id)}
                        title={collapsed ? label : undefined}
                        className="relative flex items-center rounded-md"
                        style={{
                          gap: 10,
                          padding: collapsed ? '9px 0' : '8px 10px',
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          background: isActive ? 'var(--sb-active-bg)' : 'transparent',
                          color: isActive ? 'var(--sb-text-active)' : 'var(--sb-text)',
                          fontSize: 13,
                          fontWeight: isActive ? 600 : 500,
                          transition: 'background 140ms ease, color 140ms ease',
                        }}
                        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--sb-hover)'; e.currentTarget.style.color = 'var(--sb-text-active)' } }}
                        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sb-text)' } }}
                      >
                        {isActive && (
                          <span style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, borderRadius: '0 3px 3px 0', background: 'var(--sb-bar)' }} />
                        )}
                        <Icon size={17} style={{ flexShrink: 0 }} />
                        {!collapsed && <span className="truncate">{label}</span>}
                        {badge > 0 && !collapsed && (
                          <span style={{
                            marginLeft: 'auto', flexShrink: 0,
                            background: 'var(--accent)', color: 'var(--badge-text)',
                            borderRadius: 9999, fontSize: 10, fontWeight: 700,
                            padding: '0 6px', lineHeight: '16px', minWidth: 16, textAlign: 'center',
                          }}>
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                        {badge > 0 && collapsed && (
                          <span style={{
                            position: 'absolute', top: 5, right: 12,
                            width: 7, height: 7, borderRadius: '50%',
                            background: 'var(--accent)', border: '1px solid var(--sb-bg)',
                          }} />
                        )}
                      </button>
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
            className="hidden md:flex items-center justify-center h-10 shrink-0"
            style={{ color: 'var(--sb-text)', borderTop: '1px solid var(--sb-border)' }}
            title="Expandir menú"
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--sb-hover)'; e.currentTarget.style.color = 'var(--sb-text-active)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--sb-text)' }}
          >
            <ChevronRight size={16} />
          </button>
        )}
      </aside>
    </>
  )
}
