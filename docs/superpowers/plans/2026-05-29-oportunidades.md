# Oportunidades Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully-functional Oportunidades module that reads today's leads from Supabase, lets the user triage them via card actions, and shows a live badge on the nav item.

**Architecture:** Direct Supabase queries inside the module component (same pattern as `SeguimientoGPS.jsx`). `App.jsx` holds a `nuevasCount` state fed by a lightweight Supabase realtime channel so the nav badge stays accurate even when the module isn't mounted. Optimistic updates keep the UI instant on state changes.

**Tech Stack:** React 18, Supabase JS v2 (`src/lib/supabase.js`), lucide-react icons, Tailwind utility classes, project design tokens (CSS vars in `src/index.css`).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/utils/tiempoRelativo.js` | **Create** | Pure helper: ISO → "hace Xm/Xh/Xd" |
| `src/index.css` | **Modify** | Add `@keyframes toast-in` |
| `src/components/Sidebar.jsx` | **Modify** | Accept `badgeCounts` prop; render badge on any nav item with a count; add Oportunidades entry |
| `src/modules/Oportunidades.jsx` | **Create** | Full module: fetch, StatsBar, FilterTabs, cards grid, toast system |
| `src/App.jsx` | **Modify** | Import module + supabase; add `nuevasCount` state + realtime subscription; pass `badgeCounts` to TopNav; add render case |

---

## Task 1: `tiempoRelativo` utility

**Files:**
- Create: `src/utils/tiempoRelativo.js`

- [ ] **Create the file with this exact content:**

```js
export function tiempoRelativo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  return `hace ${Math.floor(hours / 24)}d`
}
```

- [ ] **Commit:**
```bash
git add src/utils/tiempoRelativo.js
git commit -m "feat: add tiempoRelativo utility"
```

---

## Task 2: `toast-in` keyframe in `index.css`

**Files:**
- Modify: `src/index.css`

The toast animation slides in from the left. Add the keyframe right after the existing `@keyframes modal-in` block (around line 113).

- [ ] **Add after the `modal-in` block and its `.modal-panel` rule:**

```css
/* ── Toast entry (slide from left) ──────────────────────── */
@keyframes toast-in {
  from { opacity: 0; transform: translateX(-110%); }
  to   { opacity: 1; transform: translateX(0); }
}
.toast-in {
  animation: toast-in 220ms cubic-bezier(0.23, 1, 0.32, 1) both;
}
```

Also add a reduced-motion override inside the existing `@media (prefers-reduced-motion: reduce)` block at the bottom of the file:

```css
  .toast-in { animation: none; }
```

- [ ] **Commit:**
```bash
git add src/index.css
git commit -m "feat: add toast-in animation keyframe"
```

---

## Task 3: Sidebar — `badgeCounts` prop + Oportunidades nav entry

**Files:**
- Modify: `src/components/Sidebar.jsx`

**Context:** `Sidebar.jsx` exports `TopNav`. It has a `navItems` array and renders each as a button. `App.jsx` currently calls `<TopNav active={page} onNav={p => setPage(p)} rightContent={<BackupBar />} />` with no `badgeCounts` prop yet — that gets added in Task 5.

- [ ] **Replace the import line at the top of `Sidebar.jsx`** to add `Target`:

```jsx
import { LayoutDashboard, Truck, Fuel, Wrench, DollarSign, TrendingUp, Megaphone, Menu, X, MapPin, Navigation, Target } from 'lucide-react'
```

- [ ] **Replace the `navItems` array** to add the Oportunidades entry at the end:

```js
const navItems = [
  { id: 'dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'vehiculo',      label: 'Vehículo',        icon: Truck           },
  { id: 'combustible',   label: 'Combustible',     icon: Fuel            },
  { id: 'mantenimiento', label: 'Mantenimiento',   icon: Wrench          },
  { id: 'nomina',        label: 'Nómina',          icon: DollarSign      },
  { id: 'finanzas',      label: 'Finanzas',        icon: TrendingUp      },
  { id: 'viajes',        label: 'Viajes',          icon: MapPin          },
  { id: 'marketing',     label: 'Marketing',       icon: Megaphone       },
  { id: 'seguimiento',   label: 'GPS',             icon: Navigation      },
  { id: 'oportunidades', label: 'Oportunidades',   icon: Target          },
]
```

- [ ] **Replace the function signature** to accept `badgeCounts`:

```jsx
export default function TopNav({ active, onNav, rightContent, badgeCounts = {} }) {
```

- [ ] **Replace the desktop nav button** (inside the `.map()` — the `<button>` element and its contents) to render a badge when `badgeCounts[id] > 0`:

```jsx
<button
  key={id}
  onClick={() => onNav(id)}
  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap flex-shrink-0"
  style={{
    WebkitAppRegion: 'no-drag',
    background: isActive ? 'var(--accent-dim)' : 'transparent',
    color: isActive ? 'var(--accent)' : 'var(--text-2)',
    border: isActive ? '1px solid rgba(56,189,248,0.12)' : '1px solid transparent',
    transition: 'background 150ms ease-out, color 150ms ease-out',
  }}
  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text-1)' } }}
  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)' } }}
>
  <Icon size={13} />
  {label}
  {badgeCounts[id] > 0 && (
    <span style={{
      background: 'var(--accent)',
      color: '#09090b',
      borderRadius: 9999,
      fontSize: 10,
      fontWeight: 700,
      padding: '0 5px',
      lineHeight: '16px',
      minWidth: 16,
      textAlign: 'center',
      display: 'inline-block',
      marginLeft: 2,
    }}>
      {badgeCounts[id]}
    </span>
  )}
</button>
```

- [ ] **Replace the mobile nav button** (inside the second `.map()`) similarly to show the badge:

```jsx
<button
  key={id}
  onClick={() => { onNav(id); setMobileOpen(false) }}
  className="w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium"
  style={{
    WebkitAppRegion: 'no-drag',
    background: isActive ? 'var(--accent-dim)' : 'transparent',
    color: isActive ? 'var(--accent)' : 'var(--text-2)',
    borderLeft: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
  }}
>
  <Icon size={16} />
  {label}
  {badgeCounts[id] > 0 && (
    <span style={{
      background: 'var(--accent)',
      color: '#09090b',
      borderRadius: 9999,
      fontSize: 10,
      fontWeight: 700,
      padding: '0 5px',
      lineHeight: '16px',
      minWidth: 16,
      textAlign: 'center',
      display: 'inline-block',
      marginLeft: 'auto',
    }}>
      {badgeCounts[id]}
    </span>
  )}
</button>
```

- [ ] **Commit:**
```bash
git add src/components/Sidebar.jsx
git commit -m "feat: add Oportunidades nav entry and badgeCounts prop to TopNav"
```

---

## Task 4: `Oportunidades.jsx` — full module

**Files:**
- Create: `src/modules/Oportunidades.jsx`

- [ ] **Create the file with this exact content:**

```jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Target, ExternalLink, CheckCircle, MinusCircle, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { tiempoRelativo } from '../utils/tiempoRelativo'

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

let _toastId = 0

function ToastContainer({ toasts }) {
  if (!toasts.length) return null
  return (
    <div style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 50, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div
          key={t.id}
          className="surface toast-in"
          style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, minWidth: 240 }}
        >
          {t.icon}
          <span style={{ color: 'var(--text-1)' }}>{t.message}</span>
        </div>
      ))}
    </div>
  )
}

export default function Oportunidades() {
  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState('Todas')
  const [toasts, setToasts]   = useState([])

  const addToast = useCallback((message, icon) => {
    const id = ++_toastId
    setToasts(prev => [...prev, { id, message, icon }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  useEffect(() => {
    const hoy = new Date().toISOString().slice(0, 10)
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
  }, [])

  const cambiarEstado = useCallback(async (id, nuevoEstado) => {
    setList(prev => prev.map(o =>
      o.id === id ? { ...o, estado: nuevoEstado, updated_at: new Date().toISOString() } : o
    ))
    await supabase
      .from('oportunidades')
      .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq('id', id)
  }, [])

  const handleContactar = useCallback((id) => {
    cambiarEstado(id, 'contactada')
    addToast(
      'Oportunidad marcada como contactada',
      <CheckCircle size={15} style={{ color: 'var(--positive)', flexShrink: 0 }} />
    )
  }, [cambiarEstado, addToast])

  const handleSkip = useCallback((id) => {
    cambiarEstado(id, 'descartada')
    addToast(
      'Oportunidad descartada',
      <MinusCircle size={15} style={{ color: '#64748b', flexShrink: 0 }} />
    )
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

  const STATS_ITEMS = [
    { label: 'Nuevas',      value: stats.nuevas,      color: ACCENT        },
    { label: 'Contactadas', value: stats.contactadas,  color: 'var(--positive)' },
    { label: 'Descartadas', value: stats.descartadas,  color: '#64748b'     },
    { label: 'Total',       value: stats.total,        color: 'var(--text-1)' },
  ]

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

      <ToastContainer toasts={toasts} />
    </div>
  )
}
```

- [ ] **Commit:**
```bash
git add src/modules/Oportunidades.jsx
git commit -m "feat: add Oportunidades module"
```

---

## Task 5: Wire up in `App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Add these two imports** after the existing import block (after `import { useStore } from './store/useStore'`):

```jsx
import Oportunidades from './modules/Oportunidades'
import { supabase } from './lib/supabase'
```

- [ ] **Add `nuevasCount` state** inside the `App()` function, right after the existing state declarations:

```jsx
const [nuevasCount, setNuevasCount] = useState(0)
```

- [ ] **Add the badge subscription `useEffect`** right after the existing `useEffect` for update events:

```jsx
useEffect(() => {
  supabase
    .from('oportunidades')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'nueva')
    .then(({ count }) => setNuevasCount(count ?? 0))

  const channel = supabase
    .channel('oportunidades-badge')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'oportunidades' }, () => {
      supabase
        .from('oportunidades')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'nueva')
        .then(({ count }) => setNuevasCount(count ?? 0))
    })
    .subscribe()

  return () => supabase.removeChannel(channel)
}, [])
```

- [ ] **Replace the `<TopNav>` JSX line** to pass `badgeCounts`:

```jsx
<TopNav active={page} onNav={p => setPage(p)} rightContent={<BackupBar />} badgeCounts={{ oportunidades: nuevasCount }} />
```

- [ ] **Add the render case** for the Oportunidades module, right after the `seguimiento` case:

```jsx
{page === 'oportunidades'  && <Oportunidades />}
```

- [ ] **Commit:**
```bash
git add src/App.jsx
git commit -m "feat: wire Oportunidades module into App with realtime nav badge"
```

---

## Task 6: Smoke test

- [ ] **Start the dev server:**
```bash
npm run dev
```

- [ ] **Verify checklist in the browser / Electron window:**
  - [ ] "Oportunidades" appears in the top nav
  - [ ] Badge shows current count of nuevas (sky number pill)
  - [ ] Clicking the nav item renders the module with header, 4 stat cards, filter pills, and a cards grid (or empty state if no data today)
  - [ ] Each card shows: grupo, badge de estado, tiempo relativo, texto truncado, zona, and the correct action buttons
  - [ ] "Contactar" changes the card badge + removes the Contactar/Skip buttons; a green toast appears bottom-left
  - [ ] "Skip" changes badge to descartada slate; a slate toast appears; nav badge count decrements
  - [ ] "Ver post" opens the link externally (or in a new tab in browser mode)
  - [ ] Filter pills Nuevas / Contactadas / Descartadas filter the visible cards correctly
  - [ ] Empty state shows Target icon + correct message when no cards match the filter
  - [ ] Stat counters update live as cards are actioned

- [ ] **Final commit if any last-minute fixes were needed:**
```bash
git add -p
git commit -m "fix: smoke test corrections for Oportunidades"
```
