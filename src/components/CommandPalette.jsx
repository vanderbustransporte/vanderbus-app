import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Search, MapPin, Contact, Truck, IdCard } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../store/useStore'
import { ROUTES, rutaDe, puedeAcceder } from '../routes'
import { useNav } from '../hooks/useNav'
import { formatDate } from '../utils/format'
import { toISO } from '../utils/fecha'

// Búsqueda sin tildes: "nomina" encuentra "Nómina" y "Perez" a "Pérez".
const norm = (s) => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const MAX_POR_GRUPO = 5

// Cuántos caracteres hacen falta para buscar registros. Con 1 solo, cualquier
// letra matchea media base y la lista es puro ruido; los módulos sí aparecen
// desde el primer caracter porque son pocos.
const MIN_QUERY_REGISTROS = 2

const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

const kbdStyle = {
  padding: '1px 5px',
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'var(--bg-overlay)',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-2)',
}

function Kbd({ children }) {
  return <kbd style={kbdStyle}>{children}</kbd>
}

// Arma la lista plana de resultados. Cada item sabe ejecutarse (run), así el
// teclado y el mouse comparten el mismo camino.
function buildResults({ q, auth, data, nav }) {
  const query = norm(q.trim())
  const acc = []

  // ── Módulos ── la visibilidad es la MISMA regla que usan Sidebar y el guard
  // de ruta (puedeAcceder): la palette no puede ofrecer un destino prohibido.
  const visibles = ROUTES.filter(r => puedeAcceder(r, auth))
  const modulos = query
    ? visibles.filter(r => norm(r.label).includes(query) || norm(r.titulo).includes(query) || norm(r.grupo).includes(query))
    : visibles
  for (const r of modulos) {
    acc.push({
      key: `m:${r.id}`,
      grupo: 'Ir a',
      icon: r.icon,
      label: r.titulo,
      detail: r.grupo,
      run: () => nav(r.id),
    })
  }

  if (query.length < MIN_QUERY_REGISTROS) return acc

  const puede = (id) => puedeAcceder(rutaDe(id), auth)

  // ── Viajes ── al elegir uno se navega a la fila exacta (deep link con
  // registro): el módulo la resalta y scrollea vía useRegistroDestacado.
  if (puede('viajes')) {
    const viajes = (data.viajes || [])
      .filter(r => r.cliente || r.origen || r.destino)
      .filter(r => norm(r.cliente).includes(query) || norm(r.origen).includes(query) || norm(r.destino).includes(query))
      .sort((a, b) => toISO(b.fecha).localeCompare(toISO(a.fecha)))
      .slice(0, MAX_POR_GRUPO)
    for (const r of viajes) {
      const ruta = [r.origen, r.destino].filter(Boolean).join(' → ')
      acc.push({
        key: `v:${r.id}`,
        grupo: 'Viajes',
        icon: MapPin,
        label: r.cliente || ruta || 'Sin cliente',
        detail: [formatDate(r.fecha), r.cliente ? ruta : ''].filter(Boolean).join(' · '),
        run: () => nav('viajes', { registro: r.id }),
      })
    }
  }

  // ── Contactos ──
  if (puede('contactos')) {
    const contactos = (data.contactos || [])
      .filter(r => norm(r.nombre).includes(query) || norm(r.empresa).includes(query) || norm(r.telefono).includes(query) || norm(r.email).includes(query))
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
      .slice(0, MAX_POR_GRUPO)
    for (const r of contactos) {
      acc.push({
        key: `c:${r.id}`,
        grupo: 'Contactos',
        icon: Contact,
        label: r.nombre || 'Sin nombre',
        detail: [r.tipo, r.empresa || r.telefono].filter(Boolean).join(' · '),
        run: () => nav('contactos', { registro: r.id }),
      })
    }
  }

  // ── Flota ── incluye archivados (activo: false) marcados como tales: buscar
  // una patente vieja también tiene que encontrarla.
  if (puede('vehiculo')) {
    const flota = (data.vehiculos || [])
      .filter(r => norm(r.alias).includes(query) || norm(r.patente).includes(query) || norm(r.marca).includes(query) || norm(r.modelo).includes(query))
      .slice(0, MAX_POR_GRUPO)
    for (const r of flota) {
      acc.push({
        key: `f:${r.id}`,
        grupo: 'Flota',
        icon: Truck,
        label: r.alias || r.patente || 'Sin nombre',
        detail: [[r.marca, r.modelo].filter(Boolean).join(' '), r.patente, r.activo === false ? 'Archivado' : ''].filter(Boolean).join(' · '),
        run: () => nav('vehiculo', { registro: r.id }),
      })
    }
  }

  // ── Choferes ── también los archivados, marcados (igual criterio que Flota).
  if (puede('choferes')) {
    const choferes = (data.choferes || [])
      .filter(r => norm(r.nombre).includes(query) || norm(r.dni).includes(query) || norm(r.celular).includes(query))
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
      .slice(0, MAX_POR_GRUPO)
    for (const r of choferes) {
      acc.push({
        key: `ch:${r.id}`,
        grupo: 'Choferes',
        icon: IdCard,
        label: r.nombre || r.dni || 'Sin nombre',
        detail: [r.dni ? `DNI ${r.dni}` : '', r.celular, r.activo === false ? 'Archivado' : ''].filter(Boolean).join(' · '),
        run: () => nav('choferes', { registro: r.id }),
      })
    }
  }

  return acc
}

export default function CommandPalette({ open, onOpen, onClose }) {
  const auth = useAuth()
  const { data } = useStore()
  const nav = useNav()

  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef(null)

  // Atajo global. Vive acá (el componente está siempre montado) y no en App
  // para que App no cargue con un listener más.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (open) onClose()
        else onOpen()
      } else if (e.key === 'Escape' && open) {
        // Global y no solo en el input: cierra aunque el foco haya quedado en
        // la lista o en el scroll.
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpen, onClose])

  // Cada apertura arranca limpia: el "estado" de la palette es efímero a propósito.
  useEffect(() => {
    if (open) { setQ(''); setSel(0) }
  }, [open])

  const { puedeVer, esOwner, esSuperadmin, featureOn } = auth
  const results = useMemo(
    () => (open ? buildResults({ q, auth: { puedeVer, esOwner, esSuperadmin, featureOn }, data, nav }) : []),
    [open, q, puedeVer, esOwner, esSuperadmin, featureOn, data, nav]
  )

  const selClamp = Math.min(sel, Math.max(results.length - 1, 0))

  useEffect(() => {
    document.getElementById(`cp-item-${selClamp}`)?.scrollIntoView({ block: 'nearest' })
  }, [selClamp, results])

  if (!open) return null

  const pick = (item) => { onClose(); item.run() }

  const onInputKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => (s + 1) % Math.max(results.length, 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => (s - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[selClamp]) pick(results[selClamp]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center p-4"
      style={{ background: 'var(--modal-backdrop)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', alignItems: 'flex-start', paddingTop: '14vh' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-xl modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Buscar"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-hi)',
          borderRadius: 12,
          boxShadow: 'var(--modal-shadow)',
          overflow: 'hidden',
        }}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4" style={{ height: 48, borderBottom: '1px solid var(--border)' }}>
          <Search size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={q}
            onChange={e => { setQ(e.target.value); setSel(0) }}
            onKeyDown={onInputKey}
            placeholder="Buscar módulos, viajes, contactos, vehículos, choferes…"
            role="combobox"
            aria-expanded="true"
            aria-controls="cp-list"
            aria-activedescendant={results.length ? `cp-item-${selClamp}` : undefined}
            className="flex-1"
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 15, color: 'var(--text-1)' }}
          />
          <Kbd>esc</Kbd>
        </div>

        {/* Resultados */}
        <div id="cp-list" role="listbox" aria-label="Resultados" style={{ maxHeight: '52vh', overflowY: 'auto', padding: 6 }}>
          {results.length === 0 && (
            <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-2)' }}>
              Sin resultados para “{q}”.
            </div>
          )}
          {results.map((item, i) => {
            const Icon = item.icon
            const primero = i === 0 || results[i - 1].grupo !== item.grupo
            const activo = i === selClamp
            return (
              <React.Fragment key={item.key}>
                {primero && (
                  <div
                    role="presentation"
                    style={{ padding: '8px 10px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)' }}
                  >
                    {item.grupo}
                  </div>
                )}
                <div
                  id={`cp-item-${i}`}
                  role="option"
                  aria-selected={activo}
                  onMouseMove={() => setSel(i)}
                  onClick={() => pick(item)}
                  className="flex items-center gap-2.5"
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    background: activo ? 'var(--hover-tint)' : 'none',
                  }}
                >
                  <Icon size={16} style={{ color: activo ? 'var(--accent)' : 'var(--text-2)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', flexShrink: 0, maxWidth: '55%', ...ellipsis }}>
                    {item.label}
                  </span>
                  {item.detail && (
                    <span style={{ fontSize: 12, color: 'var(--text-2)', minWidth: 0, ...ellipsis }}>{item.detail}</span>
                  )}
                </div>
              </React.Fragment>
            )
          })}
        </div>

        {/* Hints de teclado */}
        <div className="flex items-center gap-3 px-4" style={{ height: 34, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-3)' }}>
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navegar</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> abrir</span>
        </div>
      </div>
    </div>
  )
}
