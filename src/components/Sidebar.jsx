import React, { useState } from 'react'
import { LayoutDashboard, Truck, Fuel, Wrench, Users, DollarSign, TrendingUp, Megaphone, MessageSquare, Menu, X } from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'vehiculo', label: 'Vehículo', icon: Truck },
  { id: 'combustible', label: 'Combustible', icon: Fuel },
  { id: 'mantenimiento', label: 'Mantenimiento', icon: Wrench },
  { id: 'contactos', label: 'Contactos', icon: Users },
  { id: 'nomina', label: 'Nómina', icon: DollarSign },
  { id: 'finanzas', label: 'Finanzas', icon: TrendingUp },
  { id: 'viajes', label: 'Viajes', icon: Truck },
  { id: 'marketing', label: 'Marketing', icon: Megaphone },
  { id: 'asistente', label: 'Asistente', icon: MessageSquare },
]

export default function TopNav({ active, onNav, rightContent }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <header className="fixed top-0 left-0 right-0 z-40" style={{ background: '#13131F', borderBottom: '1px solid #2E2E42' }}>
        <div className="flex items-center px-4 h-14 gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#4A8FD4' }}>
              <Truck size={16} className="text-white" />
            </div>
            <span className="text-white font-black tracking-widest text-base hidden sm:block"
              style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.15em' }}>
              VANDERBUS
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-none">
            {navItems.map(({ id, label, icon: Icon }) => {
              const isActive = active === id
              return (
                <button
                  key={id}
                  onClick={() => onNav(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0
                    ${isActive ? '' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  style={isActive ? { background: 'rgba(74,143,212,0.18)', color: '#4A8FD4' } : {}}
                >
                  <Icon size={14} />
                  {label}
                </button>
              )
            })}
          </nav>

          {/* Right: BackupBar + mobile hamburger */}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {rightContent}
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              {mobileOpen
                ? <X size={20} className="text-gray-300" />
                : <Menu size={20} className="text-gray-300" />
              }
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <nav className="md:hidden border-t py-2" style={{ borderColor: '#2E2E42', background: '#13131F' }}>
            {navItems.map(({ id, label, icon: Icon }) => {
              const isActive = active === id
              return (
                <button
                  key={id}
                  onClick={() => { onNav(id); setMobileOpen(false) }}
                  className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-medium transition-all
                    ${isActive ? '' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  style={isActive ? { background: 'rgba(74,143,212,0.15)', color: '#4A8FD4', borderLeft: '2px solid #4A8FD4' } : {}}
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
