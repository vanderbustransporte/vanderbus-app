import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Login from './components/Login.jsx'
import CuentaSuspendida from './components/CuentaSuspendida.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import './index.css'

// Decide qué mostrar según haya o no sesión iniciada
function AuthGate() {
  const { user, loading, estadoSub } = useAuth()

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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>
)
