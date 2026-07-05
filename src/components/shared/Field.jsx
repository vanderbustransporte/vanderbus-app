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

const baseClass = 'w-full px-3 py-2 rounded-lg text-sm'
const baseStyle = {
  background: 'var(--bg-overlay)',
  border: '1px solid var(--border)',
  color: 'var(--text-1)',
}

const focusHandlers = {
  onFocus: e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' },
  onBlur:  e => { e.target.style.borderColor = ''; e.target.style.boxShadow = '' },
  onMouseEnter: e => { if (document.activeElement !== e.target) e.target.style.borderColor = 'var(--border-hi)' },
  onMouseLeave: e => { if (document.activeElement !== e.target) e.target.style.borderColor = '' },
}

export function Input({ style: extStyle, ...props }) {
  return <input className={baseClass} style={{ ...baseStyle, ...extStyle }} {...focusHandlers} {...props} />
}

export function Select({ children, style: extStyle, ...props }) {
  return (
    <select className={baseClass} style={{ ...baseStyle, cursor: 'pointer', ...extStyle }} {...focusHandlers} {...props}>
      {children}
    </select>
  )
}

export function Textarea({ style: extStyle, ...props }) {
  return <textarea className={`${baseClass} resize-none`} style={{ ...baseStyle, ...extStyle }} rows={3} {...focusHandlers} {...props} />
}

export function BtnPrimary({ children, onClick, style: extStyle, ...props }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-5 py-2 text-sm font-semibold"
      style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', boxShadow: '0 1px 2px rgba(15,23,42,0.12)', transition: 'filter 150ms, box-shadow 150ms', ...extStyle }}
      onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.08)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(37,99,235,0.28)' }}
      onMouseLeave={e => { e.currentTarget.style.filter = ''; e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,23,42,0.12)' }}
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
      className="px-4 py-2 text-sm font-medium"
      style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-2)', borderRadius: 'var(--radius)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.color = 'var(--text-1)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.color = 'var(--text-2)' }}
    >
      {children}
    </button>
  )
}
