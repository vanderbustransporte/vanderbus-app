// src/components/CuentaSuspendida.jsx
//
// Pantalla de bloqueo cuando la suscripción de la empresa no está activa
// (estado_sub = 'suspendida' | 'cancelada'). El bloqueo real es RLS:
// current_org_id() devuelve NULL para orgs no activas, así que aunque alguien
// saltee esta pantalla no ve ni escribe ningún dato. Esto solo explica por qué.
import { Lock, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const TEXTOS = {
  suspendida: {
    titulo: 'Suscripción suspendida',
    detalle: 'El acceso a los datos de tu empresa está pausado. Tus datos siguen guardados: regularizá la suscripción para volver a entrar.',
  },
  cancelada: {
    titulo: 'Suscripción cancelada',
    detalle: 'La suscripción de tu empresa fue dada de baja. Si querés reactivarla o exportar tus datos, escribinos.',
  },
}

export default function CuentaSuspendida({ estado }) {
  const { signOut, user } = useAuth()
  const t = TEXTOS[estado] ?? TEXTOS.suspendida

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', padding: 20,
    }}>
      <div className="surface db-in db-d0" style={{ padding: '48px 40px', textAlign: 'center', borderRadius: 'var(--radius)', maxWidth: 440 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, margin: '0 auto 16px',
          background: 'var(--warning-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Lock size={24} style={{ color: 'var(--warning)' }} />
        </div>
        <h1 className="mod-h1" style={{ fontSize: 22 }}>{t.titulo}</h1>
        <p className="mod-sub" style={{ marginTop: 8, lineHeight: 1.55 }}>{t.detalle}</p>
        {user?.email && (
          <p style={{ marginTop: 14, fontSize: 12, color: 'var(--text-3)' }}>
            Sesión: {user.email}
          </p>
        )}
        <button
          onClick={signOut}
          style={{
            marginTop: 24, display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', background: 'var(--bg-overlay)',
            color: 'var(--text-1)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <LogOut size={15} /> Cerrar sesión
        </button>
      </div>
    </div>
  )
}
