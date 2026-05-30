import React from 'react'

export default function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null
  return (
    <div
      style={{
        position: 'fixed', bottom: 16, left: 16, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <div
          key={t.id}
          className={`surface ${t.removing ? 'toast-out' : 'toast-in'}`}
          style={{
            padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 13, minWidth: 240, maxWidth: 320,
            pointerEvents: 'auto',
          }}
        >
          {t.Icon && (
            <t.Icon size={15} style={{ color: t.color, flexShrink: 0 }} />
          )}
          <span style={{ color: 'var(--text-1)', flex: 1, lineHeight: 1.4 }}>
            {t.message}
          </span>
          <button
            onClick={() => onRemove(t.id)}
            style={{
              color: 'var(--text-3)', background: 'none', border: 'none',
              cursor: 'pointer', padding: '0 2px', lineHeight: 1,
              fontSize: 15, flexShrink: 0,
              transition: 'color 120ms ease-out',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)' }}
            aria-label="Cerrar notificación"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
