import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 10

export default function Table({ columns, data, emptyText = 'Sin registros' }) {
  const [page, setPage] = useState(0)
  useEffect(() => { setPage(0) }, [data])
  const totalPages = Math.ceil(data.length / PAGE_SIZE)
  const rows = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div>
      <div className="overflow-x-auto" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
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
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-2)' }}>
                  {emptyText}
                </td>
              </tr>
            ) : rows.map((row, i) => (
              <tr
                key={row.id || i}
                style={{ borderTop: '1px solid var(--border)', transition: 'background 150ms ease-out' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-tint)' }}
                onMouseLeave={e => { e.currentTarget.style.background = '' }}
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
                className="p-1.5 disabled:opacity-30"
                style={{ border: '1px solid var(--border)', background: 'var(--bg-overlay)', borderRadius: 'var(--radius-sm)', color: 'var(--text-2)', transition: 'background 150ms ease-out' }}
                onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'var(--accent-glow)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-overlay)' }}
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
