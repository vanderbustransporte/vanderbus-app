import React from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, onClose, children, size = 'md' }) {
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)' }}
    >
      <div
        className={`w-full ${sizes[size]} rounded-2xl`}
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: '#E2E8F0' }}
        >
          <h2 className="text-base font-700 font-bold" style={{ color: '#1A202C' }}>{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#64748B' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F0F4F8' }}
            onMouseLeave={e => { e.currentTarget.style.background = '' }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[80vh]">{children}</div>
      </div>
    </div>
  )
}
