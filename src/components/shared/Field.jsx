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
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  color: '#1A202C',
}

function withFocusHandlers(el) {
  return {
    onFocus: (e) => { e.target.style.borderColor = '#3D8FD1'; e.target.style.boxShadow = '0 0 0 3px rgba(61,143,209,0.1)' },
    onBlur: (e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = '' },
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
      className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
      style={{ background: '#3D8FD1', ...extStyle }}
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
      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      style={{ border: '1px solid #E2E8F0', color: '#64748B', background: '#FFFFFF' }}
      onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC' }}
      onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF' }}
    >
      {children}
    </button>
  )
}
