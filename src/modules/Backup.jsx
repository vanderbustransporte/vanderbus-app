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
    border: '1px solid #E2E8F0',
    background: '#FFFFFF',
    color: '#64748B',
    transition: 'background 0.15s',
  }

  return (
    <div className="flex items-center gap-2">
      {status && (
        <div
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
          style={
            status.type === 'ok'
              ? { background: 'rgba(34,197,94,0.1)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.2)' }
              : { background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.2)' }
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
        onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF' }}
      >
        <Download size={13} /> Exportar
      </button>
      <button
        onClick={() => fileRef.current.click()}
        style={btnBase}
        title="Importar datos desde JSON"
        onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF' }}
      >
        <Upload size={13} /> Importar
      </button>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
    </div>
  )
}
