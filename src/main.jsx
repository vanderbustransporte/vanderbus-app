import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, useLocation } from 'react-router-dom'
import App from './App.jsx'
import Login from './components/Login.jsx'
import CuentaSuspendida from './components/CuentaSuspendida.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { ConfirmProvider } from './context/ConfirmContext.jsx'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import './index.css'

// Página pública de seguimiento de un viaje (#/track/<token>). Se baja en lazy
// para que Leaflet no lo pague quien entra a la app normal.
const TrackPublico = lazy(() => import('./components/TrackPublico.jsx'))

// Decide qué mostrar según haya o no sesión iniciada
function AuthGate() {
  const { user, loading, estadoSub } = useAuth()
  const { pathname } = useLocation()

  // Ruta pública: NO requiere sesión y no espera al auth. Va antes que todo para
  // que el link compartido funcione deslogueado (usa solo la función pública
  // tracking_publico, no las tablas). El token es lo que sigue a /track/.
  if (pathname.startsWith('/track/')) {
    const token = pathname.slice('/track/'.length)
    return (
      <Suspense fallback={null}>
        <TrackPublico token={token} />
      </Suspense>
    )
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-base)',
          color: 'var(--text-2)',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.9rem',
        }}
      >
        Cargando…
      </div>
    )
  }

  // Empresa suspendida/cancelada: RLS ya le cerró los datos (current_org_id()
  // devuelve NULL); esta pantalla solo le explica el porqué al usuario.
  if (user && estadoSub && estadoSub !== 'activa') {
    return <CuentaSuspendida estado={estadoSub} />
  }

  return user ? <App /> : <Login />
}

// El router envuelve al AuthGate, no sólo a <App/>: así, si alguien abre un link
// profundo (#/viajes) sin sesión, la URL sobrevive al login y después de entrar
// cae en Viajes en vez del dashboard.
//
// HashRouter (y no BrowserRouter) porque el build usa `base: './'` y no hay
// rewrite de servidor configurado: con paths reales, refrescar en /viajes daría
// 404. Si algún día se sirve desde un host con rewrite a index.html, es cambiar
// esta línea por BrowserRouter.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <HashRouter>
              <AuthGate />
            </HashRouter>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>
)
