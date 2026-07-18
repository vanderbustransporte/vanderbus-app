import React, { useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { Download, Upload, AlertTriangle, CheckCircle } from 'lucide-react'

export default function BackupBar() {
  const { exportData, importData } = useStore()
  const fileRef = useRef()
  const [status, setStatus] = useState(null)
  const [pendiente, setPendiente] = useState(null) // archivo elegido, esperando confirmación
  const [importando, setImportando] = useState(false)

  const handleFile = (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (file) {
      setStatus(null)
      setPendiente(file)
    }
  }

  const confirmarImport = async () => {
    setImportando(true)
    try {
      const resumen = await importData(pendiente)
      const total = Object.values(resumen || {}).reduce((a, b) => a + (b || 0), 0)
      setStatus({ type: 'ok', msg: `Backup importado: ${total} registros` })
    } catch (err) {
      setStatus({ type: 'err', msg: err.message })
    }
    setPendiente(null)
    setImportando(false)
    setTimeout(() => setStatus(null), 8000)
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
    // borde/fondo/hover los pone .btn-ghost (CSS); acá solo forma y tipografía
  }

  if (pendiente) {
    return (
      <div
        className="flex items-start gap-3 text-xs px-4 py-3 rounded-lg"
        style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning-dim)', maxWidth: 520 }}
      >
        <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
        <div className="flex flex-col gap-2" style={{ color: 'var(--text-1)' }}>
          <span>
            Importar <strong>{pendiente.name}</strong> reemplaza <strong>todos</strong> los
            datos de la empresa con el contenido del archivo (las tablas que no estén en el
            archivo quedan vacías). Si algo falla, no se modifica nada.
          </span>
          <div className="flex gap-2">
            <button
              onClick={confirmarImport}
              disabled={importando}
              className="btn-ghost"
              style={{ ...btnBase, color: 'var(--warning)', opacity: importando ? 0.6 : 1 }}
            >
              <Upload size={13} /> {importando ? 'Importando…' : 'Sí, reemplazar todo'}
            </button>
            <button onClick={() => setPendiente(null)} disabled={importando} className="btn-ghost" style={btnBase}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
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
        className="btn-ghost"
        style={btnBase}
        title="Exportar datos como JSON"
      >
        <Download size={13} /> Exportar
      </button>
      <button
        onClick={() => fileRef.current.click()}
        className="btn-ghost"
        style={btnBase}
        title="Importar datos desde JSON"
      >
        <Upload size={13} /> Importar
      </button>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
    </div>
  )
}
