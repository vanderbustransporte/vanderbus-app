import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 10

// ── Table ────────────────────────────────────────────────────────────────────
// Refactoring UI fixes applied:
//  • Header background distinguishable from body (rgba(0,0,0,0.035))
//  • Row hover visible: rgba(61,143,209,0.05) — subtle blue tint over white glass
//  • Row borders neutral rgba(0,0,0,0.06) instead of hard #E2E8F0 on translucent bg
//  • Empty-state text upgraded from #94A3B8 (fails WCAG AA) to #64748B
//  • Header text upgraded from #64748B to #475569 (slate-600) for better hierarchy
//  • Pagination buttons use tinted hover matching the row hover system
// ─────────────────────────────────────────────────────────────────────────────
export default function Table({ columns, data, emptyText = 'Sin registros' }) {
  const [page, setPage] = useState(0)
  useEffect(() => { setPage(0) }, [data])
  const totalPages = Math.ceil(data.length / PAGE_SIZE)
  const rows = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div>
      {/* Wrapper: single border, clips overflowing content */}
      <div
        className="overflow-x-auto"
        style={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.07)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{
              background: 'rgba(0,0,0,0.035)',
              borderBottom: '1px solid rgba(0,0,0,0.07)',
            }}>
              {columns.map(c => (
                <th
                  key={c.key}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                  style={{ color: '#475569' }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm"
                  style={{ color: '#64748B' }}
                >
                  {emptyText}
                </td>
              </tr>
            ) : rows.map((row, i) => (
              <tr
                key={row.id || i}
                style={{
                  borderTop: '1px solid rgba(0,0,0,0.06)',
                  transition: 'background-color 150ms ease-out',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(61,143,209,0.05)' }}
                onMouseLeave={e => { e.currentTarget.style.background = '' }}
              >
                {columns.map(c => (
                  <td
                    key={c.key}
                    className="px-4 py-3 whitespace-nowrap"
                    style={{ color: '#374151' }}
                  >
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between mt-3"
          style={{ color: '#64748B', fontSize: 12 }}
        >
          <span>
            {data.length} registros · página {page + 1} / {totalPages}
          </span>
          <div className="flex gap-1">
            {[
              { label: <ChevronLeft size={15} />, action: () => setPage(p => Math.max(0, p - 1)), disabled: page === 0 },
              { label: <ChevronRight size={15} />, action: () => setPage(p => Math.min(totalPages - 1, p + 1)), disabled: page === totalPages - 1 },
            ].map(({ label, action, disabled }, i) => (
              <button
                key={i}
                onClick={action}
                disabled={disabled}
                className="p-1.5 disabled:opacity-30"
                style={{
                  border: '1px solid rgba(0,0,0,0.1)',
                  background: 'rgba(255,255,255,0.5)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  borderRadius: 8,
                  color: '#64748B',
                  transition: 'background-color 150ms ease-out',
                }}
                onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'rgba(61,143,209,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.5)' }}
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
