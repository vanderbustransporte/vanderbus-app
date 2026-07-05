import React, { useState, useEffect } from 'react'
import TopNav from './components/Sidebar'
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
import BackupBar from './modules/Backup'
import { useStore } from './store/useStore'
import { supabase } from './lib/supabase'
import NotifCenter from './components/NotifCenter'
import { useToast } from './context/ToastContext'
import { TIPO_CONFIG } from './utils/tipoNotif'
import ThemeToggle from './components/ThemeToggle'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const { error, loading } = useStore()

  const [notifCount, setNotifCount] = useState(0)
  const { addToast } = useToast()

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

  return (
    <div className="min-h-screen">
      <TopNav
        active={page}
        onNav={p => setPage(p)}
        rightContent={
          <>
            <ThemeToggle />
            <NotifCenter unreadCount={notifCount} onNav={p => setPage(p)} />
            <BackupBar />
          </>
        }
      />

      <div className="pt-12 min-h-screen flex flex-col">
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {error && (
            <div
              className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
              style={{ background: 'var(--danger-dim)', border: '1px solid rgba(248,113,113,0.2)', color: 'var(--danger)' }}
            >
              <span className="font-semibold">Sin conexión al servidor:</span> {error}
            </div>
          )}

          {loading && !error && (
            <div className="mb-4 text-sm px-1" style={{ color: 'var(--text-2)' }}>
              Cargando datos…
            </div>
          )}

          {page === 'dashboard'     && <Dashboard onNav={p => setPage(p)} />}
          {page === 'vehiculo'      && <Vehiculo />}
          {page === 'combustible'   && <Combustible />}
          {page === 'mantenimiento' && <Mantenimiento />}
          {page === 'nomina'        && <Nomina />}
          {page === 'finanzas'      && <Finanzas />}
          {page === 'viajes'        && <Viajes />}
          {page === 'marketing'     && <Marketing />}
          {page === 'seguimiento'   && <SeguimientoGPS />}
          {page === 'usuarios'      && <Usuarios />}
        </main>
      </div>
    </div>
  )
}
