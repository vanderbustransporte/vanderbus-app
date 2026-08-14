// Revisión humana de los datos extraídos del PDF.
//
// Regla del feature, y el motivo por el que esta pantalla existe: NINGÚN dato
// extraído entra al cálculo sin que una persona lo acepte. Cada propuesta se
// muestra con la página de origen, la cita textual y la confianza declarada; el
// usuario acepta las que quiera y las que acepte se cargan en el FORMULARIO
// (todavía editables, y todavía sin guardar).
//
// Los valores que la función descartó por estar fuera de rango también se
// muestran, marcados como "revisar a mano": es información — dice que en esa
// página hay algo que el sistema no supo leer bien.

import React, { useState } from 'react'
import { Sparkles, Check, X, TriangleAlert, FileSearch, Loader2 } from 'lucide-react'
import { extraerFicha, aplicarPropuestas, CONFIANZA_COLOR, ETIQUETA_CAMPO } from '../utils/extraccion'

export default function ExtraerFicha({ doc, clase, onAplicar }) {
  const [estado, setEstado]   = useState('inicial')  // inicial | cargando | listo | error
  const [res, setRes]         = useState(null)
  const [error, setError]     = useState(null)
  const [aceptados, setAceptados] = useState(new Set())

  const lanzar = async () => {
    setEstado('cargando'); setError(null)
    const r = await extraerFicha({ docId: doc.id, clase })
    if (r.error) { setError(r.error); setEstado('error'); return }
    setRes(r)
    // Nada viene aceptado por default, ni siquiera lo de confianza alta: la
    // aceptación es el único filtro humano que tiene este flujo.
    setAceptados(new Set())
    setEstado('listo')
  }

  const alternar = (campo) => setAceptados(prev => {
    const s = new Set(prev)
    s.has(campo) ? s.delete(campo) : s.add(campo)
    return s
  })

  const aplicar = () => {
    onAplicar(aplicarPropuestas(res.propuestas, aceptados))
    setEstado('inicial'); setRes(null); setAceptados(new Set())
  }

  if (estado === 'inicial' || estado === 'cargando') {
    return (
      <button
        type="button"
        className="btn-ghost"
        onClick={lanzar}
        disabled={estado === 'cargando'}
        title="Leer las especificaciones del PDF"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 11.5, cursor: estado === 'cargando' ? 'wait' : 'pointer' }}
      >
        {estado === 'cargando' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        {estado === 'cargando' ? 'Leyendo…' : 'Leer datos'}
      </button>
    )
  }

  const marco = {
    marginTop: 10, padding: 14, borderRadius: 'var(--radius)',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    width: '100%',
  }

  if (estado === 'error') {
    return (
      <div style={marco}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <TriangleAlert size={14} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
            {error}
            <button type="button" className="btn-ghost" onClick={lanzar} style={{ marginLeft: 8, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
              Reintentar
            </button>
          </div>
        </div>
      </div>
    )
  }

  const { propuestas, descartados, paginas, totalPaginas, aviso } = res

  return (
    <div style={marco}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <FileSearch size={14} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>Datos encontrados en el PDF</span>
        <button type="button" className="btn-ghost" onClick={() => { setEstado('inicial'); setRes(null) }} style={{ marginLeft: 'auto', padding: 4, cursor: 'pointer' }}>
          <X size={13} />
        </button>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 12 }}>
        {paginas.length > 0 && <>Se leyeron {paginas.length} de {totalPaginas || '?'} páginas (las de especificaciones: {paginas.join(', ')}).{' '}</>}
        <strong style={{ color: 'var(--text-2)' }}>Nada se guarda hasta que lo aceptes.</strong>{' '}
        Verificá cada valor contra la página que indica — abrí el PDF con “Ver”.
      </p>

      {aviso && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--warning-dim)' }}>
          <TriangleAlert size={13} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>{aviso}</span>
        </div>
      )}

      {propuestas.length === 0 && !aviso && (
        <p style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
          El documento no trae ninguno de estos datos de forma explícita. Es lo habitual en un
          manual de operador: el consumo y los pesos suelen estar en la ficha técnica comercial.
          Cargalos a mano.
        </p>
      )}

      {propuestas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {propuestas.map(p => {
            const on = aceptados.has(p.campo)
            return (
              <label
                key={p.campo}
                style={{
                  display: 'flex', gap: 9, alignItems: 'flex-start', cursor: 'pointer',
                  padding: '9px 11px', borderRadius: 'var(--radius-sm)',
                  background: on ? 'var(--accent-dim)' : 'var(--bg-overlay)',
                  border: `1px solid ${on ? 'transparent' : 'var(--border)'}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => alternar(p.campo)}
                  style={{ marginTop: 2, accentColor: 'var(--accent)', width: 15, height: 15, flexShrink: 0 }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{p.etiqueta}</span>
                    <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
                      {p.valor}{p.unidad ? ` ${p.unidad}` : ''}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: CONFIANZA_COLOR[p.confianza] }}>
                      conf. {p.confianza}
                    </span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>pág. {p.pagina}</span>
                  </div>
                  {p.cita && (
                    <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 3, fontStyle: 'italic', lineHeight: 1.5 }}>
                      “{p.cita}”
                    </div>
                  )}
                </div>
              </label>
            )
          })}
        </div>
      )}

      {descartados.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="db-slabel" style={{ marginBottom: 5 }}>Descartados — revisar a mano</div>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
            {descartados.map((d, i) => (
              <li key={i}>
                · {ETIQUETA_CAMPO[d.campo] || d.campo}: <span className="num">{String(d.valor)}</span>
                {d.pagina ? ` (pág. ${d.pagina})` : ''} — {d.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      {propuestas.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
          <button
            type="button"
            className="glass-btn-primary"
            onClick={aplicar}
            disabled={aceptados.size === 0}
            style={{ opacity: aceptados.size === 0 ? 0.5 : 1, cursor: aceptados.size === 0 ? 'not-allowed' : 'pointer' }}
          >
            <Check size={14} /> Cargar {aceptados.size} {aceptados.size === 1 ? 'dato' : 'datos'} en la ficha
          </button>
          <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
            Quedan editables; se guardan con el vehículo.
          </span>
        </div>
      )}
    </div>
  )
}
