import React from 'react'
import { Search } from 'lucide-react'

export default function SearchBar({ value, onChange, placeholder = 'Buscar...' }) {
  return (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-4 py-2 rounded-lg text-sm w-full sm:w-64 transition-colors"
        style={{
          background: 'rgba(255,255,255,0.5)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.6)',
          color: '#1A202C',
        }}
        onFocus={e => { e.target.style.borderColor = 'rgba(61,143,209,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(61,143,209,0.12)' }}
        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.6)'; e.target.style.boxShadow = '' }}
      />
    </div>
  )
}
