import React, { useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { Download, Upload, AlertTriangle, CheckCircle } from 'lucide-react'

export default function BackupBar() {
  const { exportData, importData } = useStore()
  const fileRef = useRef()
  const [status, setStatus] = useState(null)

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      await importData(file)
      setStatus({ type: 'ok', msg: 'Datos importados correctamente' })
    } catch (err) {
      setStatus({ type: 'err', msg: err.message })
    }
    e.target.value = ''
    setTimeout(() => setStatus(null), 4000)
  }

  const btnBase = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-2)',
    transition: 'background 0.15s',
  }

  return (
    <div className="flex items-center gap-2">
      {status && (
        <div
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
          style={
            status.type === 'ok'
              ? { background: 'var(--positive-dim)', color: 'var(--positive)', border: '1px solid var(--positive-dim)' }
              : { background: 'var(--danger-dim)',   color: 'var(--danger)',   border: '1px solid var(--danger-dim)'   }
          }
        >
          {status.type === 'ok' ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
          {status.msg}
        </div>
      )}
      <button
        onClick={exportData}
        style={btnBase}
        title="Exportar datos como JSON"
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-tint-md)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
      >
        <Download size={13} /> Exportar
      </button>
      <button
        onClick={() => fileRef.current.click()}
        style={btnBase}
        title="Importar datos desde JSON"
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-tint-md)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
      >
        <Upload size={13} /> Importar
      </button>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
    </div>
  )
}
