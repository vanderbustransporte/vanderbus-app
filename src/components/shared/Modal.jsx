import React, { useEffect } from 'react'
import { X } from 'lucide-react'

// Cierra SOLO con la X o con Escape. El click en el backdrop NO cierra a
// propósito: estos modales son formularios de carga y un click al costado
// borraba todo lo tipeado sin aviso (pérdida de datos real, no hipotética).
export default function Modal({ title, onClose, children, size = 'md' }) {
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--modal-backdrop)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
    >
      <div
        className={`w-full ${sizes[size]} modal-panel`}
        role="dialog"
        aria-modal="true"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-hi)',
          borderRadius: 12,
          boxShadow: 'var(--modal-shadow)',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{title}</h2>
          <button
            onClick={onClose}
            className="icon-btn"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[80vh]">{children}</div>
      </div>
    </div>
  )
}
