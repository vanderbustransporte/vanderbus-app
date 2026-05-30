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
import BackupBar from './modules/Backup'
import { useStore } from './store/useStore'
import Oportunidades from './modules/Oportunidades'
import { supabase } from './lib/supabase'
import NotifCenter from './components/NotifCenter'
import { useToast } from './context/ToastContext'
import { TIPO_CONFIG } from './utils/tipoNotif'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const { error, loading } = useStore()

  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [nuevasCount, setNuevasCount] = useState(0)
  const [notifCount, setNotifCount] = useState(0)
  const { addToast } = useToast()

  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.onUpdateAvailable(() => setUpdateAvailable(true))
    window.electronAPI.onUpdateDownloaded(() => setUpdateDownloaded(true))
  }, [])

  useEffect(() => {
    const fetchCount = () => {
      supabase
        .from('oportunidades')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'nueva')
        .then(({ count, error }) => { if (!error) setNuevasCount(count ?? 0) })
    }

    fetchCount()

    const channel = supabase
      .channel('oportunidades-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'oportunidades' }, fetchCount)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

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

  const handleInstall = () => window.electronAPI?.installUpdate()

  return (
    <div className="min-h-screen" style={{ WebkitAppRegion: 'drag' }}>
      <div style={{ WebkitAppRegion: 'no-drag' }}>
        <TopNav
          active={page}
          onNav={p => setPage(p)}
          rightContent={
            <>
              <NotifCenter unreadCount={notifCount} onNav={p => setPage(p)} />
              <BackupBar />
            </>
          }
          badgeCounts={{ oportunidades: nuevasCount }}
        />
      </div>

      <div className="pt-12 min-h-screen flex flex-col" style={{ WebkitAppRegion: 'no-drag' }}>
        <main className="flex-1 p-4 sm:p-6 lg:p-8" style={{ WebkitAppRegion: 'no-drag' }}>
          {updateDownloaded && (
            <div
              className="mb-4 flex items-center justify-between px-4 py-3 rounded-lg text-sm"
              style={{ background: 'var(--accent-dim)', border: '1px solid rgba(56,189,248,0.2)', color: 'var(--text-1)' }}
            >
              <span>Actualización lista para instalar</span>
              <button
                onClick={handleInstall}
                className="ml-4 px-4 py-1.5 rounded-md text-xs font-semibold"
                style={{ background: 'var(--accent)', color: '#09090b', WebkitAppRegion: 'no-drag' }}
              >
                Reiniciar y actualizar
              </button>
            </div>
          )}

          {updateAvailable && !updateDownloaded && (
            <div
              className="mb-4 px-4 py-3 rounded-lg text-sm"
              style={{ background: 'var(--warning-dim)', border: '1px solid rgba(251,191,36,0.2)', color: 'var(--warning)' }}
            >
              Descargando actualización…
            </div>
          )}

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
          {page === 'oportunidades' && <Oportunidades />}
        </main>
      </div>
    </div>
  )
}
