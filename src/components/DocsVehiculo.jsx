// Documentos técnicos de una unidad, dentro de la ficha del vehículo.
//
// Sube el PDF al bucket privado, lo lista y lo abre en un visor (el visor nativo
// del navegador dentro de un iframe: trae búsqueda de texto, zoom e impresión
// sin que tengamos que mantener nada). El archivo se sirve siempre con una
// signed URL de vida corta, nunca con una URL pública.
//
// Ver utils/docsVehiculo.js para el almacenamiento y las reglas de aislamiento.

import React, { useEffect, useState, useCallback } from 'react'
import { FileText, Upload, Trash2, Eye, X, TriangleAlert, Loader2 } from 'lucide-react'
import { Field, Select } from './shared/Field'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import {
  TIPOS_DOC, AVISO_QUE_SUBIR, LIMITE_MB,
  listarDocs, subirDoc, borrarDoc, urlFirmada, validarArchivo, fmtTamano,
} from '../utils/docsVehiculo'
import { formatDate } from '../utils/format'

const tipoLabel = id => (TIPOS_DOC.find(t => t.id === id) || {}).label || 'Documento'

export default function DocsVehiculo({ vehiculoId, organizationId, editable, extraAccion }) {
  const [docs, setDocs]       = useState([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [tipo, setTipo]       = useState('ficha_tecnica')
  const [error, setError]     = useState(null)
  const [visor, setVisor]     = useState(null)   // { doc, url }
  const { addToast } = useToast()
  const confirmar = useConfirm()

  const refrescar = useCallback(async () => {
    setCargando(true)
    setDocs(await listarDocs(vehiculoId))
    setCargando(false)
  }, [vehiculoId])

  useEffect(() => { refrescar() }, [refrescar])

  const onArchivo = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''   // permite volver a elegir el mismo archivo
    if (!file) return
    const problema = validarArchivo(file)
    if (problema) { setError(problema); return }
    setError(null)
    setSubiendo(true)
    const { error: err } = await subirDoc({ file, vehiculoId, organizationId, tipo })
    setSubiendo(false)
    if (err) { setError(err); return }
    addToast({ message: 'Documento subido.', Icon: FileText, color: 'var(--positive)' })
    refrescar()
  }

  const abrir = async (doc) => {
    const url = await urlFirmada(doc.storage_path)
    if (!url) { setError('No se pudo abrir el documento. Probá de nuevo.'); return }
    setVisor({ doc, url })
  }

  const eliminar = async (doc) => {
    const ok = await confirmar({
      titulo: 'Eliminar documento',
      mensaje: `Se borra "${doc.nombre}" del almacenamiento. Los datos que ya hayas aceptado en la ficha quedan como están.`,
      accion: 'Eliminar',
      Icon: Trash2,
    })
    if (!ok) return
    const { error: err } = await borrarDoc(doc)
    if (err) { setError(err); return }
    addToast({ message: 'Documento eliminado.', Icon: Trash2, color: 'var(--danger)' })
    refrescar()
  }

  return (
    <div className="surface db-in db-d6" style={{ padding: 24, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <FileText size={15} style={{ color: 'var(--accent)' }} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Manual y ficha técnica</h2>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16 }}>
        {AVISO_QUE_SUBIR} Se guarda privado, sólo para tu empresa. PDF, hasta {LIMITE_MB} MB.
      </p>

      {editable && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
          <Field label="Tipo de documento">
            <Select value={tipo} onChange={e => setTipo(e.target.value)}>
              {TIPOS_DOC.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
          </Field>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <label
              className="glass-btn-primary"
              style={{ cursor: subiendo ? 'wait' : 'pointer', width: '100%', justifyContent: 'center' }}
            >
              {subiendo ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {subiendo ? 'Subiendo…' : 'Subir PDF'}
              <input type="file" accept="application/pdf" onChange={onArchivo} disabled={subiendo} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 14, padding: '9px 11px', borderRadius: 'var(--radius-sm)', background: 'var(--danger-dim)' }}>
          <TriangleAlert size={13} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11.5, color: 'var(--danger)', lineHeight: 1.5 }}>{error}</span>
        </div>
      )}

      {cargando ? (
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Cargando documentos…</p>
      ) : docs.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Todavía no hay documentos para esta unidad.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docs.map(d => (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '10px 12px', borderRadius: 'var(--radius)',
              background: 'var(--bg-overlay)', border: '1px solid var(--border)',
            }}>
              <FileText size={15} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.nombre}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {tipoLabel(d.tipo)}
                  {d.tamano_bytes ? ` · ${fmtTamano(d.tamano_bytes)}` : ''}
                  {d.created_at ? ` · ${formatDate(d.created_at.slice(0, 10))}` : ''}
                </div>
              </div>
              <button type="button" className="btn-ghost" onClick={() => abrir(d)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 11.5, cursor: 'pointer' }}>
                <Eye size={13} /> Ver
              </button>
              {extraAccion && extraAccion(d)}
              {editable && (
                <button type="button" className="btn-ghost-danger" onClick={() => eliminar(d)} title="Eliminar"
                  style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 9px', cursor: 'pointer' }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Visor: el PDF nativo del navegador. Trae búsqueda de texto (Ctrl+F),
          zoom e impresión — no hace falta mantener un visor propio. */}
      {visor && (
        <div
          onClick={() => setVisor(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div onClick={e => e.stopPropagation()} className="modal-panel" style={{ width: 'min(1100px, 100%)', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <FileText size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {visor.doc.nombre}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto', marginRight: 8 }}>
                Ctrl+F busca dentro del PDF
              </span>
              <button type="button" className="btn-ghost" onClick={() => setVisor(null)} style={{ padding: 6, cursor: 'pointer' }}>
                <X size={15} />
              </button>
            </div>
            <iframe
              title={visor.doc.nombre}
              src={visor.url}
              style={{ flex: 1, width: '100%', border: 'none', borderRadius: '0 0 var(--radius) var(--radius)', background: '#fff' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
