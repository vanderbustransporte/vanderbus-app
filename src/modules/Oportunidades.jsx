import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Target, ExternalLink, CheckCircle, MinusCircle, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { tiempoRelativo } from '../utils/tiempoRelativo'
import { useToast } from '../context/ToastContext'

const ACCENT = '#38bdf8'

const ESTADO_STYLES = {
  nueva:      { bg: 'var(--accent-dim)',          color: 'var(--accent)'    },
  contactada: { bg: 'var(--positive-dim)',         color: 'var(--positive)'  },
  descartada: { bg: 'rgba(100,116,139,0.10)',      color: '#64748b'          },
  cerrada:    { bg: 'rgba(167,139,250,0.10)',      color: '#a78bfa'          },
}

const FILTROS = ['Todas', 'Nuevas', 'Contactadas', 'Descartadas']

const FILTRO_MAP = {
  Nuevas:      'nueva',
  Contactadas: 'contactada',
  Descartadas: 'descartada',
}

function EstadoBadge({ estado }) {
  const s = ESTADO_STYLES[estado] || ESTADO_STYLES.descartada
  return (
    <span
      className="text-xs font-semibold rounded-full px-2"
      style={{ background: s.bg, color: s.color, lineHeight: '20px', display: 'inline-block', flexShrink: 0 }}
    >
      {estado}
    </span>
  )
}

function OportunidadCard({ oportunidad, onContactar, onSkip, index }) {
  const { id, grupo, texto, zona, link, estado, created_at } = oportunidad

  const abrirLink = () => {
    if (link) {
      if (window.electronAPI?.openExternal) window.electronAPI.openExternal(link)
      else window.open(link, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div
      className={`surface surface-hover db-in db-d${Math.min(index, 8)}`}
      style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {/* Fila 1: grupo + badge + tiempo relativo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span
          className="font-semibold text-sm"
          style={{ color: 'var(--text-1)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {grupo || '—'}
        </span>
        <EstadoBadge estado={estado} />
        <span className="text-xs" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
          {tiempoRelativo(created_at)}
        </span>
      </div>

      {/* Fila 2: texto truncado a 2 líneas */}
      {texto && (
        <p
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            color: 'var(--text-2)',
            fontSize: 13,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {texto}
        </p>
      )}

      {/* Fila 3: zona */}
      {zona && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <MapPin size={12} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>{zona}</span>
        </div>
      )}

      {/* Fila 4: botones de acción */}
      <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
        {link && (
          <button
            onClick={abrirLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.borderColor = 'var(--border-hi)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <ExternalLink size={13} />
            Ver post
          </button>
        )}
        {estado !== 'contactada' && estado !== 'cerrada' && (
          <button
            onClick={() => onContactar(id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{ background: 'var(--positive-dim)', color: 'var(--positive)', border: '1px solid rgba(52,211,153,0.15)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--positive-dim)' }}
          >
            <CheckCircle size={13} />
            Contactar
          </button>
        )}
        {estado !== 'descartada' && estado !== 'cerrada' && (
          <button
            onClick={() => onSkip(id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{ background: 'rgba(100,116,139,0.10)', color: '#64748b', border: '1px solid rgba(100,116,139,0.15)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(100,116,139,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(100,116,139,0.10)' }}
          >
            <MinusCircle size={13} />
            Skip
          </button>
        )}
      </div>
    </div>
  )
}


export default function Oportunidades() {
  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState('Todas')
  const { addToast } = useToast()

  useEffect(() => {
    const hoy = new Date().toISOString().slice(0, 10)

    const fetchList = () => {
      supabase
        .from('oportunidades')
        .select('*')
        .gte('created_at', `${hoy}T00:00:00`)
        .lte('created_at', `${hoy}T23:59:59`)
        .then(({ data, error }) => {
          if (!error && data) {
            setList(data.sort((a, b) => {
              if (a.estado === 'nueva' && b.estado !== 'nueva') return -1
              if (b.estado === 'nueva' && a.estado !== 'nueva') return 1
              return new Date(b.created_at) - new Date(a.created_at)
            }))
          }
          setLoading(false)
        })
    }

    fetchList()

    const channel = supabase
      .channel('oportunidades-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'oportunidades' }, fetchList)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  const cambiarEstado = useCallback(async (id, nuevoEstado) => {
    const prevEstado = list.find(o => o.id === id)?.estado
    setList(prev => prev.map(o =>
      o.id === id ? { ...o, estado: nuevoEstado, updated_at: new Date().toISOString() } : o
    ))
    const { error } = await supabase
      .from('oportunidades')
      .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      setList(prev => prev.map(o => o.id === id ? { ...o, estado: prevEstado } : o))
    }
  }, [list])

  const handleContactar = useCallback((id) => {
    cambiarEstado(id, 'contactada')
    addToast({ message: 'Oportunidad marcada como contactada', Icon: CheckCircle, color: 'var(--positive)' })
  }, [cambiarEstado, addToast])

  const handleSkip = useCallback((id) => {
    cambiarEstado(id, 'descartada')
    addToast({ message: 'Oportunidad descartada', Icon: MinusCircle, color: '#64748b' })
  }, [cambiarEstado, addToast])

  const filtered = useMemo(() => {
    if (filtro === 'Todas') return list
    return list.filter(o => o.estado === FILTRO_MAP[filtro])
  }, [list, filtro])

  const stats = useMemo(() => ({
    nuevas:      list.filter(o => o.estado === 'nueva').length,
    contactadas: list.filter(o => o.estado === 'contactada').length,
    descartadas: list.filter(o => o.estado === 'descartada').length,
    total:       list.length,
  }), [list])

  const STATS_ITEMS = useMemo(() => [
    { label: 'Nuevas',      value: stats.nuevas,      color: ACCENT             },
    { label: 'Contactadas', value: stats.contactadas,  color: 'var(--positive)'  },
    { label: 'Descartadas', value: stats.descartadas,  color: '#64748b'          },
    { label: 'Total',       value: stats.total,        color: 'var(--text-1)'    },
  ], [stats])

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: `${ACCENT}18`, border: `1px solid ${ACCENT}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Target size={18} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="mod-h1">Oportunidades</h1>
            <p className="mod-sub">Leads del día</p>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
        {STATS_ITEMS.map((s, i) => (
          <div
            key={s.label}
            className={`surface surface-hover db-in db-d${i + 1}`}
            style={{ padding: '18px 20px 18px 24px', position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', top: 12, bottom: 12, left: 0, width: 3, borderRadius: '0 3px 3px 0', background: s.color === 'var(--text-1)' ? '#64748b' : s.color, opacity: 0.75 }} />
            <p className="db-slabel" style={{ marginBottom: 8 }}>{s.label}</p>
            <div className="num" style={{ fontSize: 19, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Filtros ── */}
      <div className="db-in db-d5" style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {FILTROS.map(f => {
          const isActive = filtro === f
          return (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className="px-3 py-1.5 rounded-md text-xs font-medium"
              style={{
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-2)',
                border: isActive ? '1px solid rgba(56,189,248,0.12)' : '1px solid transparent',
                transition: 'background 150ms ease-out, color 150ms ease-out',
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text-1)' } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)' } }}
            >
              {f}
            </button>
          )
        })}
      </div>

      {/* ── Cards ── */}
      {loading ? (
        <div className="db-empty">Cargando oportunidades…</div>
      ) : filtered.length === 0 ? (
        <div className="db-empty" style={{ flexDirection: 'column', gap: 10 }}>
          <Target size={32} style={{ color: 'var(--text-3)', opacity: 0.5 }} />
          <span>{filtro === 'Todas' ? 'Sin oportunidades para hoy' : 'No hay oportunidades en este filtro'}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {filtered.map((op, i) => (
            <OportunidadCard
              key={op.id}
              oportunidad={op}
              onContactar={handleContactar}
              onSkip={handleSkip}
              index={i}
            />
          ))}
        </div>
      )}

    </div>
  )
}
