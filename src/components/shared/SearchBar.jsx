import React from 'react'
import { Search } from 'lucide-react'

export default function SearchBar({ value, onChange, placeholder = 'Buscar...' }) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-4 py-2 rounded-lg text-sm w-full sm:w-64"
        style={{
          background: 'var(--bg-overlay)',
          border: '1px solid var(--border)',
          color: 'var(--text-1)',
        }}
        onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
        onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = '' }}
      />
    </div>
  )
}
