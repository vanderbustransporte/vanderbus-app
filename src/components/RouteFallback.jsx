import React from 'react'

// Fallback de <Suspense> mientras baja el chunk del módulo.
//
// Imita el esqueleto real de un módulo (header + fila de stats + panel de tabla)
// en vez de un spinner centrado: al montar el módulo de verdad, el contenido cae
// donde ya estaba el bloque gris y el layout no salta.
export default function RouteFallback() {
  return (
    <div className="max-w-6xl mx-auto" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando módulo…</span>

      {/* Header: ícono + título + subtítulo */}
      <div className="flex items-center gap-3" style={{ marginBottom: 28 }}>
        <div className="sk" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="sk" style={{ width: 180, height: 22, borderRadius: 6 }} />
          <div className="sk" style={{ width: 260, height: 11, borderRadius: 4, marginTop: 8 }} />
        </div>
      </div>

      {/* Fila de stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ marginBottom: 16 }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="surface" style={{ padding: '18px 22px' }}>
            <div className="sk" style={{ width: '55%', height: 11, borderRadius: 4 }} />
            <div className="sk" style={{ width: '75%', height: 20, borderRadius: 5, marginTop: 12 }} />
            <div className="sk" style={{ width: '40%', height: 10, borderRadius: 4, marginTop: 8 }} />
          </div>
        ))}
      </div>

      {/* Panel de tabla */}
      <div className="surface" style={{ padding: 20 }}>
        <div className="sk" style={{ width: '100%', height: 36, borderRadius: 'var(--radius)' }} />
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="sk" style={{ width: '100%', height: 34, borderRadius: 'var(--radius-sm)' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
