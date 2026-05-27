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
      <div className="overflow-x-auto rounded-xl" style={{border:'1px solid #2E2E42'}}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{background:'#252535'}}>
              {columns.map(c => (
                <th key={c.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">{emptyText}</td>
              </tr>
            ) : rows.map((row, i) => (
              <tr key={row.id || i} className="border-t hover:bg-white/5 transition-colors" style={{borderColor:'#2E2E42'}}>
                {columns.map(c => (
                  <td key={c.key} className="px-4 py-3 text-gray-200 whitespace-nowrap">
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm text-gray-400">
          <span>{data.length} registros — página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page === totalPages-1}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
