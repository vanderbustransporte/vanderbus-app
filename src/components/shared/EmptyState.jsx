import React from 'react'

// Estado vacío compuesto: ícono en un chip neutro + título + guía + acción
// opcional. Reemplaza el texto pelado ("Sin X registrados") que se veía sin
// terminar — y que para una empresa nueva es la PRIMERA pantalla de cada módulo,
// porque todo arranca vacío.
//
// El chip va en tono neutro (no acento): "acá no hay nada" es un estado calmo;
// el acento se lo lleva el botón de acción, que es lo único accionable.
export default function EmptyState({ Icon, title, hint, action, compact = false }) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        padding: compact ? '32px 20px' : '52px 20px', gap: 4,
      }}
    >
      {Icon && (
        <div
          style={{
            width: 46, height: 46, borderRadius: 12, marginBottom: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-overlay)', color: 'var(--text-3)',
          }}
        >
          <Icon size={20} />
        </div>
      )}
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{title}</p>
      {hint && (
        <p style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 340, lineHeight: 1.5, textWrap: 'balance' }}>
          {hint}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="btn-solid"
          style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', fontSize: 13, fontWeight: 600 }}
        >
          {action.Icon && <action.Icon size={15} />}
          {action.label}
        </button>
      )}
    </div>
  )
}
