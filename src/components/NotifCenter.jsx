// src/components/NotifCenter.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { TIPO_CONFIG } from '../utils/tipoNotif'
import { agruparPorSeveridad } from '../utils/notifGrupos'
import { tiempoRelativo } from '../utils/tiempoRelativo'

// ─── NotifRow ───────────────────────────────────────────────────────────────

function NotifRow({ notif, onAction }) {
  const cfg  = TIPO_CONFIG[notif.tipo] ?? TIPO_CONFIG.sistema
  const Icon = cfg.Icon
  return (
    <button
      onClick={() => onAction(notif)}
      className="quiet-btn"
      style={{
        width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 16px 10px 13px',
        border: 'none', cursor: 'pointer',
        borderLeft: `3px solid ${notif.leida ? 'transparent' : cfg.color}`,
        textAlign: 'left',
      }}
    >
      <Icon size={14} style={{ color: cfg.color, flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{
            fontWeight: 600, fontSize: 12, color: 'var(--text-1)',
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {notif.titulo}
          </span>
          {!notif.leida && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
          )}
          <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>
            {tiempoRelativo(notif.created_at)}
          </span>
        </div>
        {notif.mensaje && (
          <p style={{
            margin: 0, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {notif.mensaje}
          </p>
        )}
      </div>
    </button>
  )
}

// ─── NotifCenter ─────────────────────────────────────────────────────────────

export default function NotifCenter({ unreadCount, onNav }) {
  const [open,    setOpen]    = useState(false)
  const [closing, setClosing] = useState(false)
  const [notifs,  setNotifs]  = useState([])
  const [loading, setLoading] = useState(false)
  const panelRef      = useRef(null)
  const btnRef        = useRef(null)
  const closeTimerRef = useRef(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchNotifs = useCallback(async () => {
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setNotifs(data)
  }, [])

  // ── Open / close ───────────────────────────────────────────────────────────
  const openPanel = useCallback(() => {
    setOpen(true)
    setLoading(true)
    fetchNotifs().finally(() => setLoading(false))
  }, [fetchNotifs])

  const closePanel = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    setClosing(true)
    closeTimerRef.current = setTimeout(() => {
      setOpen(false)
      setClosing(false)
      closeTimerRef.current = null
    }, 150)
  }, [])

  const togglePanel = useCallback(() => {
    if (open) closePanel()
    else      openPanel()
  }, [open, openPanel, closePanel])

  // ── Click outside ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current   && !btnRef.current.contains(e.target)
      ) closePanel()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, closePanel])

  // ── Realtime del panel (solo cuando está abierto) ──────────────────────────
  useEffect(() => {
    if (!open) return
    const channel = supabase
      .channel('notificaciones-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones' }, fetchNotifs)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [open, fetchNotifs])

  // ── Cleanup closePanel timer on unmount ────────────────────────────────────
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current) }, [])

  // ── Acciones ───────────────────────────────────────────────────────────────
  const markRead = useCallback(async (notif) => {
    if (!notif.leida) {
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, leida: true } : n))
      await supabase.from('notificaciones').update({ leida: true }).eq('id', notif.id)
    }
    if (notif.link) {
      onNav(notif.link)
      closePanel()
    }
  }, [onNav, closePanel])

  const markAllRead = useCallback(async () => {
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })))
    await supabase.from('notificaciones').update({ leida: true }).eq('leida', false)
  }, [])

  const verTodas = useCallback(() => {
    onNav('notificaciones')
    closePanel()
  }, [onNav, closePanel])

  // ── Render ─────────────────────────────────────────────────────────────────
  const grupos = useMemo(() => agruparPorSeveridad(notifs), [notifs])

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>

      {/* ── Campana ── */}
      <button
        ref={btnRef}
        onClick={togglePanel}
        className="icon-btn"
        style={{
          position: 'relative', display: 'flex', alignItems: 'center',
          border: '1px solid transparent',
          cursor: 'pointer', padding: '4px 6px',
        }}
        title="Notificaciones"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -1, right: -1,
            background: 'var(--accent)', color: 'var(--badge-text)',
            borderRadius: 9999, fontSize: 9, fontWeight: 700,
            padding: '0 4px', lineHeight: '14px',
            minWidth: 14, textAlign: 'center', display: 'inline-block',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Panel ── */}
      {open && (
        <div
          ref={panelRef}
          className={closing ? 'notif-panel-out' : 'notif-panel-in'}
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: 320, maxHeight: 480,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-hi)',
            borderRadius: 'var(--radius)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: 'var(--panel-shadow)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', zIndex: 50,
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>
              Notificaciones
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="hover-dim"
                style={{
                  fontSize: 11, color: 'var(--accent)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {/* Body */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
                Cargando…
              </div>
            ) : notifs.length === 0 ? (
              <div style={{
                padding: 32, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 10, color: 'var(--text-3)',
              }}>
                <Bell size={28} style={{ opacity: 0.35 }} />
                <span style={{ fontSize: 13 }}>No tenés notificaciones</span>
              </div>
            ) : (
              grupos.map(g => (
                <div key={g.key}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px 4px',
                    fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: 'var(--text-3)',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                    {g.label}
                    <span style={{ color: 'var(--text-3)' }}>· {g.items.length}</span>
                  </div>
                  {g.items.map(n => (
                    <NotifRow key={n.id} notif={n} onAction={markRead} />
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <button
              onClick={verTodas}
              className="quiet-btn"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '11px 16px', flexShrink: 0,
                border: 'none', borderTop: '1px solid var(--border)',
                color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Ver todas las notificaciones <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
