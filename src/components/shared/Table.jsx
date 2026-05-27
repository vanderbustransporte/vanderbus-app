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
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #E2E8F0' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {columns.map(c => (
                <th
                  key={c.key}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                  style={{ color: '#64748B', borderBottom: '1px solid #E2E8F0' }}
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
                  style={{ color: '#94A3B8' }}
                >
                  {emptyText}
                </td>
              </tr>
            ) : rows.map((row, i) => (
              <tr
                key={row.id || i}
                className="border-t transition-colors"
                style={{ borderColor: '#E2E8F0' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F0F4F8' }}
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm" style={{ color: '#64748B' }}>
          <span>{data.length} registros — página {page + 1} de {totalPages}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              style={{ border: '1px solid #E2E8F0' }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#F0F4F8' }}
              onMouseLeave={e => { e.currentTarget.style.background = '' }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              style={{ border: '1px solid #E2E8F0' }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#F0F4F8' }}
              onMouseLeave={e => { e.currentTarget.style.background = '' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
