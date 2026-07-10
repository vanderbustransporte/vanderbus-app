import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, CheckCheck, Inbox, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { TIPO_CONFIG } from '../utils/tipoNotif'
import { agruparPorSeveridad } from '../utils/notifGrupos'
import { tiempoRelativo } from '../utils/tiempoRelativo'

const ACCENT = 'var(--accent)'

// Etiqueta del botón de acción según el destino del link.
function accionLabel(link) {
  if (link === 'vehiculo')      return 'Completar'
  if (link === 'mantenimiento') return 'Ver service'
  return 'Ver'
}

// ── Fila de notificación ─────────────────────────────────────────────────────
function Fila({ n, onAbrir, onLeer }) {
  const cfg  = TIPO_CONFIG[n.tipo] ?? TIPO_CONFIG.sistema
  const Icon = cfg.Icon
  return (
    <div
      className="surface-hover"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '14px 16px',
        borderLeft: `3px solid ${n.leida ? 'transparent' : cfg.color}`,
        background: n.leida ? 'transparent' : 'var(--hover-tint)',
        borderRadius: 'var(--radius-sm)',
        transition: 'background 120ms ease-out',
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: cfg.color + '1f',
      }}>
        <Icon size={15} style={{ color: cfg.color }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontWeight: 600, fontSize: 13, color: 'var(--text-1)',
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {n.titulo}
          </span>
          {!n.leida && <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />}
          <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{tiempoRelativo(n.created_at)}</span>
        </div>
        {n.mensaje && (
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45 }}>
            {n.mensaje}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {n.link && (
            <button
              onClick={() => onAbrir(n)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px',
                borderRadius: 'var(--radius)', border: '1px solid transparent',
                color: cfg.color, background: cfg.color + '1f',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {accionLabel(n.link)} <ArrowRight size={12} />
            </button>
          )}
          {!n.leida && (
            <button
              onClick={() => onLeer(n)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px',
                borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                color: 'var(--text-2)', background: 'var(--bg-overlay)',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Marcar leída
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function Notificaciones({ onNav }) {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas') // 'todas' | 'noleidas'

  const fetchNotifs = useCallback(async () => {
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    setNotifs(data ?? [])
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchNotifs().finally(() => setLoading(false))
    const channel = supabase
      .channel('notificaciones-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones' }, fetchNotifs)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchNotifs])

  const leer = useCallback(async (n) => {
    setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, leida: true } : x))
    await supabase.from('notificaciones').update({ leida: true }).eq('id', n.id)
  }, [])

  const abrir = useCallback(async (n) => {
    if (!n.leida) await leer(n)
    if (n.link) onNav?.(n.link)
  }, [leer, onNav])

  const marcarTodas = useCallback(async () => {
    setNotifs(prev => prev.map(x => ({ ...x, leida: true })))
    await supabase.from('notificaciones').update({ leida: true }).eq('leida', false)
  }, [])

  const noLeidas = useMemo(() => notifs.filter(n => !n.leida).length, [notifs])

  const visibles = useMemo(
    () => filtro === 'noleidas' ? notifs.filter(n => !n.leida) : notifs,
    [notifs, filtro]
  )
  const grupos = useMemo(() => agruparPorSeveridad(visibles), [visibles])

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bell size={18} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="mod-h1">Notificaciones</h1>
            <p className="mod-sub">
              {noLeidas > 0 ? `${noLeidas} sin leer` : 'Todo al día'}
            </p>
          </div>
        </div>
        {noLeidas > 0 && (
          <button
            onClick={marcarTodas}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px',
              borderRadius: 'var(--radius)', border: '1px solid var(--border)',
              color: 'var(--text-1)', background: 'var(--bg-overlay)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <CheckCheck size={15} /> Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="db-in db-d1" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['todas', 'Todas'], ['noleidas', `No leídas${noLeidas ? ` (${noLeidas})` : ''}`]].map(([key, label]) => {
          const activo = filtro === key
          return (
            <button
              key={key}
              onClick={() => setFiltro(key)}
              style={{
                padding: '6px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${activo ? 'transparent' : 'var(--border)'}`,
                background: activo ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                color: activo ? 'var(--accent)' : 'var(--text-2)',
                transition: 'background 120ms, color 120ms',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Lista agrupada por severidad */}
      {loading ? (
        <div className="surface db-in db-d2" style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
          Cargando…
        </div>
      ) : grupos.length === 0 ? (
        <div className="surface db-in db-d2" style={{ padding: 48, textAlign: 'center', borderRadius: 'var(--radius)' }}>
          <Inbox size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
            {filtro === 'noleidas' ? 'No tenés notificaciones sin leer.' : 'No tenés notificaciones.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {grupos.map((g, gi) => (
            <div key={g.key} className={`surface db-in db-d${Math.min(gi + 2, 8)}`} style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '0 2px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                <span className="db-slabel" style={{ marginBottom: 0 }}>{g.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)' }}>{g.items.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {g.items.map(n => (
                  <Fila key={n.id} n={n} onAbrir={abrir} onLeer={leer} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
