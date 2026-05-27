import React from 'react'

export function Field({ label, required, children }) {
  return (
    <div>
      <label
        className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
        style={{ color: '#374151' }}
      >
        {label}{required && <span className="ml-1" style={{ color: '#EF4444' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const baseClass = "w-full px-3 py-2 rounded-lg text-sm transition-colors"
const baseStyle = {
  background: 'rgba(255,255,255,0.5)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.6)',
  color: '#1A202C',
}

function withFocusHandlers(el) {
  return {
    onFocus: (e) => { e.target.style.borderColor = 'rgba(61,143,209,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(61,143,209,0.12)' },
    onBlur: (e) => { e.target.style.borderColor = 'rgba(255,255,255,0.6)'; e.target.style.boxShadow = '' },
  }
}

export function Input({ style: extStyle, ...props }) {
  return (
    <input
      className={baseClass}
      style={{ ...baseStyle, ...extStyle }}
      {...withFocusHandlers()}
      {...props}
    />
  )
}

export function Select({ children, style: extStyle, ...props }) {
  return (
    <select
      className={baseClass}
      style={{ ...baseStyle, ...extStyle, cursor: 'pointer' }}
      {...withFocusHandlers()}
      {...props}
    >
      {children}
    </select>
  )
}

export function Textarea({ style: extStyle, ...props }) {
  return (
    <textarea
      className={`${baseClass} resize-none`}
      style={{ ...baseStyle, ...extStyle }}
      rows={3}
      {...withFocusHandlers()}
      {...props}
    />
  )
}

/* Reusable modal action buttons */
export function BtnPrimary({ children, onClick, style: extStyle, ...props }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      style={{
        background: 'rgba(61,143,209,0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.3)',
        boxShadow: '0 4px 15px rgba(61,143,209,0.3)',
        borderRadius: '10px',
        ...extStyle
      }}
      {...props}
    >
      {children}
    </button>
  )
}

export function BtnCancel({ children = 'Cancelar', onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-sm font-medium transition-colors"
      style={{
        border: '1px solid rgba(255,255,255,0.8)',
        color: '#64748B',
        background: 'rgba(255,255,255,0.5)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: '10px',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.7)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.5)' }}
    >
      {children}
    </button>
  )
}
