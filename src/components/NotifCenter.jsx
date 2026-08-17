// src/components/NotifCenter.jsx
//
// Centro de notificaciones COMPLETO en el popover de la campana. Antes esto era
// una lista mínima y lo demás vivía en un módulo /notificaciones con su propia
// entrada en el sidebar: dos implementaciones de la misma lista para algo que no
// justifica una sección del menú. Ahora la campana es el único lugar.
//
// Qué resuelve el panel:
//   - Filtro Todas / Sin leer.
//   - Agrupado por severidad (misma fuente que antes: utils/notifGrupos).
//   - Cada fila DICE a dónde lleva ("Revisar en Flota") en vez de ser un click a
//     ciegas, y si el usuario no tiene acceso a ese módulo no ofrece la acción
//     (ver utils/notifDestino).
//   - Acciones por fila (marcar leída / descartar) sin salir del panel.
//   - Marcar todas como leídas y limpiar las leídas.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, BellOff, Check, CheckCheck, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../context/ConfirmContext'
import { TIPO_CONFIG } from '../utils/tipoNotif'
import { agruparPorSeveridad } from '../utils/notifGrupos'
import { tiempoRelativo } from '../utils/tiempoRelativo'
import { destinoDe } from '../utils/notifDestino'

const LIMITE = 60

// ─── Fila ────────────────────────────────────────────────────────────────────

function NotifRow({ notif, destino, onAbrir, onLeer, onDescartar }) {
  const cfg  = TIPO_CONFIG[notif.tipo] ?? TIPO_CONFIG.sistema
  const Icon = cfg.Icon
  const DestIcon = destino?.Icon

  return (
    <div
      className="notif-row"
      style={{ borderLeft: `3px solid ${notif.leida ? 'transparent' : cfg.color}` }}
    >
      <button
        type="button"
        onClick={() => onAbrir(notif, destino)}
        className="notif-row-main"
        // Sin destino el click no navega: sólo marca leída. Decirlo evita que el
        // usuario piense que la fila está rota.
        title={destino ? destino.etiqueta : (notif.leida ? notif.titulo : 'Marcar como leída')}
      >
        <span
          style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0, marginTop: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: cfg.color + '1f',
          }}
        >
          <Icon size={13} style={{ color: cfg.color }} />
        </span>

        <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontWeight: 600, fontSize: 12.5, color: 'var(--text-1)', flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {notif.titulo}
            </span>
            {!notif.leida && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>
              {tiempoRelativo(notif.created_at)}
            </span>
          </span>

          {notif.mensaje && (
            <span
              style={{
                margin: '2px 0 0', fontSize: 11, color: 'var(--text-2)', lineHeight: 1.4,
                display: '-webkit-box', WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}
            >
              {notif.mensaje}
            </span>
          )}

          {destino && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 7,
                padding: '3px 8px', borderRadius: 9999,
                background: cfg.color + '1a', color: cfg.color,
                fontSize: 10.5, fontWeight: 700,
              }}
            >
              {DestIcon && <DestIcon size={11} />} {destino.etiqueta}
            </span>
          )}
        </span>
      </button>

      <div className="notif-actions">
        {!notif.leida && (
          <button
            type="button"
            className="icon-btn icon-btn-positive"
            style={{ padding: 4 }}
            onClick={() => onLeer(notif)}
            title="Marcar como leída"
            aria-label={`Marcar como leída: ${notif.titulo}`}
          >
            <Check size={13} />
          </button>
        )}
        <button
          type="button"
          className="icon-btn icon-btn-danger"
          style={{ padding: 4 }}
          onClick={() => onDescartar(notif)}
          title="Descartar"
          aria-label={`Descartar: ${notif.titulo}`}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── NotifCenter ─────────────────────────────────────────────────────────────

export default function NotifCenter({ unreadCount, onNav, onUnreadChange }) {
  const auth = useAuth()
  const confirmar = useConfirm()

  const [open,    setOpen]    = useState(false)
  const [closing, setClosing] = useState(false)
  const [notifs,  setNotifs]  = useState([])
  const [loading, setLoading] = useState(false)
  const [filtro,  setFiltro]  = useState('todas') // 'todas' | 'noleidas'

  const panelRef      = useRef(null)
  const btnRef        = useRef(null)
  const closeTimerRef = useRef(null)
  // Mientras hay un confirm abierto, el click afuera NO cierra el panel: el
  // click cae en el diálogo, que vive fuera del panel, y cerrarlo dejaría la
  // confirmación huérfana sobre un panel que ya no está.
  const confirmandoRef = useRef(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchNotifs = useCallback(async () => {
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(LIMITE)
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

  // ── Click afuera + Escape ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e) => {
      if (confirmandoRef.current) return
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current   && !btnRef.current.contains(e.target)
      ) closePanel()
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !confirmandoRef.current) {
        closePanel()
        btnRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
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

  // ── Cleanup del timer de cierre ────────────────────────────────────────────
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current) }, [])

  // ── Acciones ───────────────────────────────────────────────────────────────
  const leer = useCallback(async (notif) => {
    if (notif.leida) return
    setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, leida: true } : n))
    await supabase.from('notificaciones').update({ leida: true }).eq('id', notif.id)
  }, [])

  // Click en la fila: marca leída SIEMPRE y navega si hay a dónde ir. El destino
  // ya viene resuelto (existe el módulo + el usuario tiene acceso).
  const abrir = useCallback(async (notif, destino) => {
    leer(notif)
    if (destino) {
      onNav(destino.link)
      closePanel()
    }
  }, [leer, onNav, closePanel])

  const descartar = useCallback(async (notif) => {
    setNotifs(prev => prev.filter(n => n.id !== notif.id))
    await supabase.from('notificaciones').delete().eq('id', notif.id)
  }, [])

  const marcarTodas = useCallback(async () => {
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })))
    await supabase.from('notificaciones').update({ leida: true }).eq('leida', false)
  }, [])

  const limpiarLeidas = useCallback(async () => {
    confirmandoRef.current = true
    const ok = await confirmar({
      titulo:  'Limpiar leídas',
      mensaje: 'Se eliminan las notificaciones ya leídas. Las de vencimientos vuelven a generarse solas si el vencimiento sigue vigente.',
      accion:  'Limpiar',
      Icon:    Trash2,
    })
    confirmandoRef.current = false
    if (!ok) return
    setNotifs(prev => prev.filter(n => !n.leida))
    await supabase.from('notificaciones').delete().eq('leida', true)
  }, [confirmar])

  // ── Derivados ──────────────────────────────────────────────────────────────
  const visibles = useMemo(
    () => filtro === 'noleidas' ? notifs.filter(n => !n.leida) : notifs,
    [notifs, filtro]
  )
  const grupos    = useMemo(() => agruparPorSeveridad(visibles), [visibles])
  const hayLeidas = useMemo(() => notifs.some(n => n.leida), [notifs])

  // El badge lo cuenta App con un select count + Realtime, pero el UPDATE de
  // `leida` no siempre vuelve por el canal (verificado en runtime: marcar leída
  // sacaba la fila del filtro y el badge seguía en el número viejo). Mientras el
  // panel está abierto y la lista NO está truncada por el límite, acá tenemos el
  // conteo exacto: se lo pasamos al padre y el badge sigue a la acción.
  useEffect(() => {
    if (!open || notifs.length >= LIMITE) return
    onUnreadChange?.(notifs.filter(n => !n.leida).length)
  }, [open, notifs, onUnreadChange])

  // Destino por notificación: depende de los permisos, así que se recalcula si
  // cambia la sesión. Se resuelve una sola vez por render, no por fila.
  const { puedeVer, esOwner, esSuperadmin, featureOn } = auth
  const destinos = useMemo(() => {
    const ctx = { puedeVer, esOwner, esSuperadmin, featureOn }
    const map = new Map()
    for (const n of notifs) map.set(n.id, destinoDe(n, ctx))
    return map
  }, [notifs, puedeVer, esOwner, esSuperadmin, featureOn])

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
        aria-label={unreadCount > 0 ? `Notificaciones (${unreadCount} sin leer)` : 'Notificaciones'}
        aria-haspopup="dialog"
        aria-expanded={open}
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
          role="dialog"
          aria-label="Notificaciones"
          className={closing ? 'notif-panel-out' : 'notif-panel-in'}
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: 'min(380px, calc(100vw - 24px))',
            maxHeight: 'min(70vh, 540px)',
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
          <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', flex: 1 }}>
                Notificaciones
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {[['todas', 'Todas'], ['noleidas', `Sin leer${unreadCount ? ` (${unreadCount})` : ''}`]].map(([key, label]) => {
                const activo = filtro === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFiltro(key)}
                    aria-pressed={activo}
                    style={{
                      padding: '4px 11px', borderRadius: 9999, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${activo ? 'transparent' : 'var(--border)'}`,
                      background: activo ? 'var(--accent-dim)' : 'transparent',
                      color: activo ? 'var(--accent)' : 'var(--text-2)',
                      transition: 'background 120ms, color 120ms',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={marcarTodas}
                  className="hover-dim"
                  style={{
                    marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  }}
                >
                  <CheckCheck size={13} /> Marcar todas
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
                Cargando…
              </div>
            ) : grupos.length === 0 ? (
              <div style={{
                padding: 32, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 10, color: 'var(--text-3)', textAlign: 'center',
              }}>
                {filtro === 'noleidas'
                  ? <BellOff size={26} style={{ opacity: 0.4 }} />
                  : <Bell    size={26} style={{ opacity: 0.35 }} />}
                <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                  {filtro === 'noleidas' ? 'No tenés notificaciones sin leer' : 'No tenés notificaciones'}
                </span>
                {filtro === 'noleidas' && notifs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFiltro('todas')}
                    className="hover-dim"
                    style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Ver todas
                  </button>
                )}
              </div>
            ) : (
              grupos.map(g => (
                <div key={g.key}>
                  <div style={{
                    position: 'sticky', top: 0, zIndex: 1,
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px 5px',
                    background: 'var(--bg-elevated)',
                    fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: 'var(--text-3)',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                    {g.label}
                    <span>· {g.items.length}</span>
                  </div>
                  {g.items.map(n => (
                    <NotifRow
                      key={n.id}
                      notif={n}
                      destino={destinos.get(n.id)}
                      onAbrir={abrir}
                      onLeer={leer}
                      onDescartar={descartar}
                    />
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {hayLeidas && (
            <button
              type="button"
              onClick={limpiarLeidas}
              className="quiet-btn"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 14px', flexShrink: 0,
                border: 'none', borderTop: '1px solid var(--border)',
                color: 'var(--text-2)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Trash2 size={12} /> Limpiar leídas
            </button>
          )}
        </div>
      )}
    </div>
  )
}
