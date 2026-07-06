import React from 'react'
import {
  LayoutDashboard, MapPin, Truck, Fuel, Wrench, Navigation,
  TrendingUp, DollarSign, Contact, Megaphone, Users, Database,
  Settings, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const GROUPS = [
  {
    label: 'Operación',
    items: [
      { id: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
      { id: 'viajes',        label: 'Viajes',        icon: MapPin },
      { id: 'vehiculo',      label: 'Flota',         icon: Truck },
      { id: 'combustible',   label: 'Combustible',   icon: Fuel },
      { id: 'mantenimiento', label: 'Mantenimiento', icon: Wrench },
      // GPS oculto hasta migrar ubicaciones_gps (falta organization_id + RLS:
      // hoy filtra cross-tenant). El modulo y su ruta en App.jsx siguen vivos.
      // { id: 'seguimiento',   label: 'GPS',           icon: Navigation },
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
      { id: 'marketing', label: 'Marketing', icon: Megaphone },
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
]

export default function Sidebar({ active, onNav, collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const { puedeVer, esOwner } = useAuth()
  const width = collapsed ? 64 : 240

  const visible = (it) => (it.ownerOnly ? esOwner : puedeVer(it.id))
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
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.12)' }}
            >
              <Truck size={16} style={{ color: 'var(--sb-logo)' }} />
            </div>
            {!collapsed && (
              <span className="font-bold text-sm truncate" style={{ color: 'var(--sb-logo)', letterSpacing: '-0.01em' }}>
                Vanderbus
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
