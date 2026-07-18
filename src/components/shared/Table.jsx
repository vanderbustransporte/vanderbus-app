import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import EmptyState from './EmptyState'

const PAGE_SIZE = 10

export default function Table({
  columns, data, emptyText = 'Sin registros', highlightId = null,
  emptyIcon = null, emptyHint = null, emptyAction = null,
}) {
  const [page, setPage] = useState(0)
  useEffect(() => { setPage(0) }, [data])

  // Deep link a una fila (useRegistroDestacado): saltar a la página que la
  // contiene. Declarado DESPUÉS del reset de arriba a propósito: si ambos corren
  // en el mismo render (llegar con filtros limpios cambia `data`), gana este.
  useEffect(() => {
    if (highlightId == null) return
    const idx = data.findIndex(r => r.id === highlightId)
    if (idx >= 0) setPage(Math.floor(idx / PAGE_SIZE))
  }, [highlightId, data])

  // Scrollea la fila resaltada al montarse (el ref sólo se ata a esa fila).
  const flashRef = useCallback(node => {
    if (!node) return
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    node.scrollIntoView({ block: 'center', behavior: reducido ? 'auto' : 'smooth' })
  }, [])

  const totalPages = Math.ceil(data.length / PAGE_SIZE)
  const rows = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div>
      <div className="overflow-x-auto" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
              {columns.map(c => (
                <th
                  key={c.key}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                  style={{ color: 'var(--text-2)' }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState Icon={emptyIcon} title={emptyText} hint={emptyHint} action={emptyAction} />
                </td>
              </tr>
            ) : rows.map((row, i) => (
              <tr
                key={row.id || i}
                ref={row.id === highlightId ? flashRef : null}
                className={row.id === highlightId ? 'table-row row-flash' : 'table-row'}
                style={{ borderTop: '1px solid var(--border)' }}
              >
                {columns.map(c => (
                  <td key={c.key} className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-1)' }}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3" style={{ color: 'var(--text-2)', fontSize: 12 }}>
          <span>{data.length} registros · página {page + 1} / {totalPages}</span>
          <div className="flex gap-1">
            {[
              { label: <ChevronLeft size={15} />, action: () => setPage(p => Math.max(0, p - 1)), disabled: page === 0 },
              { label: <ChevronRight size={15} />, action: () => setPage(p => Math.min(totalPages - 1, p + 1)), disabled: page === totalPages - 1 },
            ].map(({ label, action, disabled }, i) => (
              <button
                key={i}
                onClick={action}
                disabled={disabled}
                className="btn-ghost p-1.5 disabled:opacity-30"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
