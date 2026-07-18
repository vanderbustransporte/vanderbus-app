import React from 'react'

export function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
        {label}{required && <span className="ml-1" style={{ color: 'var(--danger)' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

// Estados hover/focus en CSS (.input-base, index.css): los handlers JS de antes
// dejaban el borde "pegado" si el elemento se re-renderizaba con el puntero
// encima o el modal se cerraba antes del mouseleave.

export function Input(props) {
  return <input className="input-base" {...props} />
}

export function Select({ children, ...props }) {
  return (
    <select className="input-base" {...props}>
      {children}
    </select>
  )
}

export function Textarea(props) {
  return <textarea className="input-base resize-none" rows={3} {...props} />
}

export function BtnPrimary({ children, onClick, style: extStyle, ...props }) {
  return (
    <button
      onClick={onClick}
      className="btn-solid flex items-center gap-2 px-5 py-2 text-sm font-semibold"
      style={extStyle}
      {...props}
    >
      {children}
    </button>
  )
}

export function BtnCancel({ children = 'Cancelar', onClick }) {
  return (
    <button onClick={onClick} className="btn-ghost px-4 py-2 text-sm font-medium">
      {children}
    </button>
  )
}
