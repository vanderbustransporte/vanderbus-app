import React, { useState } from 'react'
import { LayoutDashboard, Truck, Fuel, Wrench, DollarSign, TrendingUp, Megaphone, Menu, X, MapPin, Navigation, LogOut, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { id: 'dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'vehiculo',      label: 'Vehículo',        icon: Truck           },
  { id: 'combustible',   label: 'Combustible',     icon: Fuel            },
  { id: 'mantenimiento', label: 'Mantenimiento',   icon: Wrench          },
  { id: 'nomina',        label: 'Nómina',          icon: DollarSign      },
  { id: 'finanzas',      label: 'Finanzas',        icon: TrendingUp      },
  { id: 'viajes',        label: 'Viajes',          icon: MapPin          },
  { id: 'marketing',     label: 'Marketing',       icon: Megaphone       },
  { id: 'seguimiento',   label: 'GPS',             icon: Navigation      },
  { id: 'usuarios',      label: 'Usuarios',         icon: Users           },
]

export default function TopNav({ active, onNav, rightContent, badgeCounts = {} }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { puedeVer, esOwner, signOut } = useAuth()

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <header
        className="fixed top-0 left-0 right-0 z-40 h-12"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center px-4 h-full gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--accent-dim)' }}
            >
              <Truck size={14} style={{ color: 'var(--accent)' }} />
            </div>
            <span
              className="font-bold text-sm hidden sm:block"
              style={{ color: 'var(--text-1)', letterSpacing: '-0.01em' }}
            >
              Vanderbus
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 overflow-x-auto ml-2">
            {navItems.filter(it => puedeVer(it.id) && (it.id !== 'usuarios' || esOwner)).map(({ id, label, icon: Icon }) => {
              const isActive = active === id
              return (
                <button
                  key={id}
                  onClick={() => onNav(id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap flex-shrink-0"
                  style={{
                    background: isActive ? 'var(--accent-dim)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-2)',
                    border: isActive ? '1px solid var(--accent-dim)' : '1px solid transparent',
                    transition: 'background 150ms ease-out, color 150ms ease-out',
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--hover-tint)'; e.currentTarget.style.color = 'var(--text-1)' } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)' } }}
                >
                  <Icon size={13} />
                  {label}
                  {badgeCounts[id] > 0 && (
                    <span style={{
                      background: 'var(--accent)',
                      color: 'var(--badge-text)',
                      borderRadius: 9999,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '0 5px',
                      lineHeight: '16px',
                      minWidth: 16,
                      textAlign: 'center',
                      display: 'inline-block',
                      marginLeft: 2,
                    }}>
                      {badgeCounts[id]}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Right slot */}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {rightContent}

            {/* Cerrar sesión */}
            <button
              title="Cerrar sesión"
              onClick={signOut}
              className="p-1.5 rounded-md"
              style={{ color: 'var(--text-2)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-tint)'; e.currentTarget.style.color = 'var(--text-1)' }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-2)' }}
            >
              <LogOut size={14} />
            </button>

            <button
              onClick={() => setMobileOpen(o => !o)}
              className="md:hidden p-1.5 rounded-md"
              style={{ color: 'var(--text-2)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-tint)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '' }}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <nav
            className="md:hidden border-t py-1"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          >
            {navItems.filter(it => puedeVer(it.id) && (it.id !== 'usuarios' || esOwner)).map(({ id, label, icon: Icon }) => {
              const isActive = active === id
              return (
                <button
                  key={id}
                  onClick={() => { onNav(id); setMobileOpen(false) }}
                  className="w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium"
                  style={{
                    background: isActive ? 'var(--accent-dim)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-2)',
                    borderLeft: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                  }}
                >
                  <Icon size={16} />
                  {label}
                  {badgeCounts[id] > 0 && (
                    <span style={{
                      background: 'var(--accent)',
                      color: 'var(--badge-text)',
                      borderRadius: 9999,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '0 5px',
                      lineHeight: '16px',
                      minWidth: 16,
                      textAlign: 'center',
                      display: 'inline-block',
                      marginLeft: 'auto',
                    }}>
                      {badgeCounts[id]}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        )}
      </header>
    </>
  )
}
