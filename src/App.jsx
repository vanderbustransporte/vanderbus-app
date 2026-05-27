import React, { useState } from 'react'
import TopNav from './components/Sidebar'
import Dashboard from './modules/Dashboard'
import Vehiculo from './modules/Vehiculo'
import Combustible from './modules/Combustible'
import Mantenimiento from './modules/Mantenimiento'
import Contactos from './modules/Contactos'
import Nomina from './modules/Nomina'
import Finanzas from './modules/Finanzas'
import Marketing from './modules/Marketing'
import Viajes from './modules/Viajes'
import Asistente from './modules/Asistente'
import BackupBar from './modules/Backup'
import { useStore } from './store/useStore'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const { error, loading } = useStore()

  const navigate = (p) => setPage(p)

  return (
    <div className="min-h-screen" style={{ background: '#0F0F1A' }}>
      <TopNav active={page} onNav={navigate} rightContent={<BackupBar />} />

      <div className="pt-14 min-h-screen flex flex-col">
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {error && (
            <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-red-300"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <span className="font-bold">Sin conexión al servidor:</span> {error}
            </div>
          )}
          {loading && !error && (
            <div className="mb-4 text-sm text-gray-500 px-1">Cargando datos...</div>
          )}
          {page === 'dashboard' && <Dashboard onNav={navigate} />}
          {page === 'vehiculo' && <Vehiculo />}
          {page === 'combustible' && <Combustible />}
          {page === 'mantenimiento' && <Mantenimiento />}
          {page === 'contactos' && <Contactos />}
          {page === 'nomina' && <Nomina />}
          {page === 'finanzas' && <Finanzas />}
          {page === 'viajes' && <Viajes />}
          {page === 'marketing' && <Marketing />}
          {page === 'asistente' && <Asistente />}
        </main>
      </div>
    </div>
  )
}
