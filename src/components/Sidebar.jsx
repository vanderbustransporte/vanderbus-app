import React, { useState } from 'react'
import { LayoutDashboard, Truck, Fuel, Wrench, DollarSign, TrendingUp, Megaphone, Menu, X, MapPin, Minus } from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'vehiculo', label: 'Vehículo', icon: Truck },
  { id: 'combustible', label: 'Combustible', icon: Fuel },
  { id: 'mantenimiento', label: 'Mantenimiento', icon: Wrench },
  { id: 'nomina', label: 'Nómina', icon: DollarSign },
  { id: 'finanzas', label: 'Finanzas', icon: TrendingUp },
  { id: 'viajes', label: 'Viajes', icon: MapPin },
  { id: 'marketing', label: 'Marketing', icon: Megaphone },
]

export default function TopNav({ active, onNav, rightContent }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <header
        className="fixed top-0 left-0 right-0 z-40"
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
        }}
      >
        <div className="flex items-center px-4 h-14 gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: '#3D8FD1' }}
            >
              <Truck size={16} className="text-white" />
            </div>
            <span
              className="font-extrabold text-base tracking-tight hidden sm:block"
              style={{ color: '#1A202C', fontFamily: "'Inter', sans-serif", letterSpacing: '-0.01em' }}
            >
              Vanderbus
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-none ml-2">
            {navItems.map(({ id, label, icon: Icon }) => {
              const isActive = active === id
              return (
                <button
                  key={id}
                  onClick={() => onNav(id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0"
                  style={
                    isActive
                      ? { background: '#EBF4FF', color: '#3D8FD1', fontWeight: 600, WebkitAppRegion: 'no-drag' }
                      : { color: '#64748B', WebkitAppRegion: 'no-drag' }
                  }
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#1A202C' } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#64748B' } }}
                >
                  <Icon size={14} />
                  {label}
                </button>
              )
            })}
          </nav>

          {/* Right: BackupBar + window controls + mobile hamburger */}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {rightContent}

            {/* Window controls */}
            <div className="flex items-center gap-1.5 ml-1">
              <button
                title="Minimizar"
                onClick={() => window.electronAPI?.minimizeApp()}
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity flex-shrink-0"
                style={{ background: '#F59E0B', WebkitAppRegion: 'no-drag' }}
              >
                <Minus size={8} className="text-white" strokeWidth={3} />
              </button>
              <button
                title="Cerrar"
                onClick={() => window.electronAPI?.closeApp()}
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity flex-shrink-0"
                style={{ background: '#EF4444', WebkitAppRegion: 'no-drag' }}
              >
                <X size={8} className="text-white" strokeWidth={3} />
              </button>
            </div>

            <button
              onClick={() => setMobileOpen(o => !o)}
              className="md:hidden p-2 rounded-lg transition-colors"
              style={{ color: '#64748B', WebkitAppRegion: 'no-drag' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F0F4F8' }}
              onMouseLeave={e => { e.currentTarget.style.background = '' }}
            >
              {mobileOpen
                ? <X size={20} />
                : <Menu size={20} />
              }
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <nav
            className="md:hidden border-t py-2"
            style={{ borderColor: '#E2E8F0', background: '#FFFFFF' }}
          >
            {navItems.map(({ id, label, icon: Icon }) => {
              const isActive = active === id
              return (
                <button
                  key={id}
                  onClick={() => { onNav(id); setMobileOpen(false) }}
                  className="w-full flex items-center gap-3 px-5 py-3 text-sm font-medium transition-all"
                  style={
                    isActive
                      ? { background: '#EBF4FF', color: '#3D8FD1', borderLeft: '3px solid #3D8FD1', WebkitAppRegion: 'no-drag' }
                      : { color: '#64748B', borderLeft: '3px solid transparent', WebkitAppRegion: 'no-drag' }
                  }
                >
                  <Icon size={17} />
                  {label}
                </button>
              )
            })}
          </nav>
        )}
      </header>
    </>
  )
}
