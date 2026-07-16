import React from 'react'
import { AlertTriangle } from 'lucide-react'
import BackupBar from './Backup'

// Vivía dentro de App.jsx. Se movió acá para que TODA ruta del registro sea un
// módulo lazy uniforme (App ya no importa módulos de forma directa).
export default function BackupPage() {
  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="db-in db-d0" style={{ marginBottom: 24 }}>
        <h1 className="mod-h1">Backup / Datos</h1>
        <p className="mod-sub">Exportá una copia de seguridad de tu empresa o restaurá desde un archivo.</p>
      </div>
      <div className="surface db-in db-d1" style={{ padding: 20 }}>
        <BackupBar />
        <div
          className="flex items-start gap-2"
          style={{ marginTop: 16, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--warning-dim)', color: 'var(--warning)', fontSize: 12, lineHeight: 1.5 }}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span><strong>Importar reemplaza todos los datos actuales</strong> de tu empresa por los del archivo. Exportá antes, por las dudas.</span>
        </div>
      </div>
    </div>
  )
}
