// src/context/ConfirmContext.jsx
//
// Reemplazo del confirm() nativo para acciones destructivas. El nativo era
// bloqueante (congela hasta la automatización del navegador), inconsistente
// visualmente con la app, y no permitía marcar la acción como peligrosa.
//
//   const confirmar = useConfirm()
//   const ok = await confirmar({
//     titulo:  'Eliminar viaje',
//     mensaje: 'Se elimina el viaje de Juan del 12/06/2026.',
//     accion:  'Eliminar',          // texto del botón (default 'Eliminar')
//     tono:    'danger',            // 'danger' (default) | 'normal' (ej. archivar)
//     Icon:    Trash2,              // opcional, default AlertTriangle
//   })
//   if (!ok) return
//
// Escape y el click en el fondo cancelan. El foco arranca en "Cancelar": para
// una acción destructiva, Enter por inercia NO tiene que borrar nada.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [dialogo, setDialogo] = useState(null)
  const cancelRef = useRef(null)

  const confirmar = useCallback((opts) =>
    new Promise(resolve => {
      // Si quedó un diálogo abierto (no debería), resolverlo como cancelado
      // para no dejar una promesa colgada.
      setDialogo(prev => { prev?.resolve(false); return { ...opts, resolve } })
    }), [])

  const cerrar = useCallback((ok) => {
    setDialogo(prev => { prev?.resolve(ok); return null })
  }, [])

  useEffect(() => {
    if (!dialogo) return
    cancelRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') cerrar(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dialogo, cerrar])

  const Icon = dialogo?.Icon ?? AlertTriangle
  const peligro = (dialogo?.tono ?? 'danger') === 'danger'
  const color = peligro ? 'var(--danger)' : 'var(--accent)'

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {dialogo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--modal-backdrop)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(false) }}
        >
          <div
            className="w-full max-w-sm modal-panel"
            role="alertdialog"
            aria-modal="true"
            aria-label={dialogo.titulo}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-hi)',
              borderRadius: 12,
              boxShadow: 'var(--modal-shadow)',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: peligro ? 'var(--danger-dim)' : 'var(--accent-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={17} style={{ color }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>
                  {dialogo.titulo}
                </h2>
                {dialogo.mensaje && (
                  <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, margin: '6px 0 0' }}>
                    {dialogo.mensaje}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3" style={{ marginTop: 22 }}>
              <button
                ref={cancelRef}
                onClick={() => cerrar(false)}
                className="btn-ghost px-4 py-2 text-sm font-medium"
                style={{ cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => cerrar(true)}
                className="hover-bright px-4 py-2 text-sm font-semibold"
                style={{
                  background: color, color: '#fff', border: 'none',
                  borderRadius: 'var(--radius)', cursor: 'pointer',
                }}
              >
                {dialogo.accion ?? 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)
