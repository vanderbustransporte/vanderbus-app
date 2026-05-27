import React from 'react'
import { Search } from 'lucide-react'

export default function SearchBar({ value, onChange, placeholder = 'Buscar...' }) {
  return (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-4 py-2 rounded-lg text-sm w-full sm:w-64 transition-colors"
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          color: '#1A202C',
        }}
        onFocus={e => { e.target.style.borderColor = '#3D8FD1'; e.target.style.boxShadow = '0 0 0 3px rgba(61,143,209,0.1)' }}
        onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = '' }}
      />
    </div>
  )
}
