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
import BackupBar from './modules/Backup'
import { useStore } from './store/useStore'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const { error, loading } = useStore()

  // ── Auto-actualización (sólo disponible en la app Electron) ──
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)

  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.onUpdateAvailable(() => setUpdateAvailable(true))
    window.electronAPI.onUpdateDownloaded(() => setUpdateDownloaded(true))
  }, [])

  const handleInstall = () => {
    window.electronAPI?.installUpdate()
  }
  // ─────────────────────────────────────────────────────────────

  const navigate = (p) => setPage(p)

  return (
    <div className="min-h-screen" style={{ background: '#F0F4F8', WebkitAppRegion: 'drag' }}>
      <TopNav active={page} onNav={navigate} rightContent={<BackupBar />} />

      <div className="pt-14 min-h-screen flex flex-col">
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {/* Actualización descargada → botón para instalar */}
          {updateDownloaded && (
            <div className="mb-4 flex items-center justify-between px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(61,143,209,0.1)', border: '1px solid #3D8FD1', color: '#1E5F8E' }}>
              <span>✅ Actualización lista para instalar</span>
              <button
                onClick={handleInstall}
                className="ml-4 px-4 py-1.5 rounded-lg text-white text-xs font-semibold"
                style={{ background: '#3D8FD1', WebkitAppRegion: 'no-drag' }}>
                Reiniciar y actualizar
              </button>
            </div>
          )}

          {/* Actualización disponible pero aún descargando */}
          {updateAvailable && !updateDownloaded && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid #F59E0B', color: '#92400E' }}>
              ⬇️ Descargando actualización...
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#DC2626'
              }}>
              <span className="font-bold">Sin conexión al servidor:</span> {error}
            </div>
          )}
          {loading && !error && (
            <div className="mb-4 text-sm px-1" style={{ color: '#64748B' }}>Cargando datos...</div>
          )}
          {page === 'dashboard' && <Dashboard onNav={navigate} />}
          {page === 'vehiculo' && <Vehiculo />}
          {page === 'combustible' && <Combustible />}
          {page === 'mantenimiento' && <Mantenimiento />}
          {page === 'nomina' && <Nomina />}
          {page === 'finanzas' && <Finanzas />}
          {page === 'viajes' && <Viajes />}
          {page === 'marketing' && <Marketing />}
        </main>
      </div>
    </div>
  )
}
