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

  return (
    <div className="flex items-center gap-3">
      {status && (
        <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${status.type === 'ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {status.type === 'ok' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {status.msg}
        </div>
      )}
      <button onClick={exportData}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:bg-white/10 transition-colors"
        title="Exportar datos como JSON">
        <Download size={14} /> Exportar
      </button>
      <button onClick={() => fileRef.current.click()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:bg-white/10 transition-colors"
        title="Importar datos desde JSON">
        <Upload size={14} /> Importar
      </button>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
    </div>
  )
}
