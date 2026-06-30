# Sistema de Notificaciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un sistema de notificaciones app-wide con centro de notificaciones (campana en la nav), toasts globales, y un helper de creación reutilizable; siguiendo el patrón Supabase directo de los módulos existentes.

**Architecture:** `ToastProvider` en `main.jsx` envuelve toda la app para que cualquier módulo pueda llamar `useToast()`. `NotifCenter` es un componente autocontenido que recibe `unreadCount` desde `App.jsx` (el mismo patrón que `badgeCounts` para oportunidades). `App.jsx` maneja el canal realtime del badge y dispara toasts de notificaciones entrantes.

**Tech Stack:** React 19, Supabase JS v2, lucide-react, CSS animations (ya definidas en index.css), Vite/Electron.

> **Nota sobre tests:** El proyecto no tiene framework de testing instalado. Las verificaciones son visuales — se indica en cada tarea qué comportamiento observar en el browser.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/utils/tipoNotif.js` | Crear | Mapa TIPO_CONFIG: color + Icon por tipo de notificación |
| `src/index.css` | Modificar | Agregar animaciones: `.toast-out`, `.notif-panel-in`, `.notif-panel-out` |
| `src/components/ToastContainer.jsx` | Crear | Renderer de toasts (fixed bottom-left, botón ✕, animación salida) |
| `src/context/ToastContext.jsx` | Crear | ToastProvider + useToast hook |
| `src/main.jsx` | Modificar | Envolver `<App>` en `<ToastProvider>` |
| `src/modules/Oportunidades.jsx` | Modificar | Reemplazar toast local por `useToast()` global |
| `src/utils/crearNotificacion.js` | Crear | Helper fire-and-forget para insertar en tabla `notificaciones` |
| `src/components/NotifCenter.jsx` | Crear | Campana + panel desplegable + suscripción realtime propia |
| `src/App.jsx` | Modificar | Agregar `notifCount`, canal `notificaciones-badge`, `NotifCenter` en rightContent |

---

## Task 1: Crear `utils/tipoNotif.js`

**Files:**
- Create: `src/utils/tipoNotif.js`

- [ ] **Step 1: Crear el archivo con el mapa TIPO_CONFIG**

```js
// src/utils/tipoNotif.js
import {
  Target, DollarSign, AlertTriangle, MapPin,
  Navigation, TrendingUp, Wrench, Settings,
} from 'lucide-react'

export const TIPO_CONFIG = {
  oportunidad:   { color: '#38bdf8', Icon: Target        },
  nomina:        { color: '#34d399', Icon: DollarSign    },
  vencimiento:   { color: '#fb923c', Icon: AlertTriangle },
  viaje:         { color: '#60a5fa', Icon: MapPin        },
  gps:           { color: '#22d3ee', Icon: Navigation    },
  finanzas:      { color: '#a78bfa', Icon: TrendingUp    },
  mantenimiento: { color: '#fbbf24', Icon: Wrench        },
  sistema:       { color: '#94a3b8', Icon: Settings      },
}
```

- [ ] **Step 2: Verificar que no hay error de módulo**

Abrir la consola del devserver (si está corriendo) o simplemente confirmar que el archivo está guardado. No requiere comportamiento visual aún.

- [ ] **Step 3: Commit**

```bash
git add src/utils/tipoNotif.js
git commit -m "feat: add TIPO_CONFIG shared map for notification types"
```

---

## Task 2: Agregar animaciones CSS en `index.css`

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Agregar las tres animaciones nuevas al final de la sección de animaciones existente**

Buscar el bloque que termina con `.toast-in { animation: ... }` (línea ~128) e insertar inmediatamente después:

```css
/* ── Toast exit ──────────────────────────────────────────── */
@keyframes toast-out {
  to { opacity: 0; transform: translateX(-110%); }
}
.toast-out {
  animation: toast-out 150ms cubic-bezier(0.23, 1, 0.32, 1) both;
}

/* ── Notification panel enter ────────────────────────────── */
@keyframes notif-panel-in {
  from { opacity: 0; transform: translateY(-6px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
}
.notif-panel-in {
  animation: notif-panel-in 200ms cubic-bezier(0.23, 1, 0.32, 1) both;
  transform-origin: top right;
}

/* ── Notification panel exit ─────────────────────────────── */
@keyframes notif-panel-out {
  from { opacity: 1; transform: translateY(0)    scale(1);    }
  to   { opacity: 0; transform: translateY(-6px) scale(0.98); }
}
.notif-panel-out {
  animation: notif-panel-out 150ms cubic-bezier(0.23, 1, 0.32, 1) both;
  transform-origin: top right;
}
```

- [ ] **Step 2: Agregar las clases nuevas al bloque `prefers-reduced-motion`**

Buscar el bloque `@media (prefers-reduced-motion: reduce)` existente y agregar al final del mismo:

```css
  .toast-out      { animation: none; }
  .notif-panel-in { animation: none; }
  .notif-panel-out{ animation: none; }
```

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: add toast-out and notification panel CSS animations"
```

---

## Task 3: Crear `components/ToastContainer.jsx`

**Files:**
- Create: `src/components/ToastContainer.jsx`

- [ ] **Step 1: Crear el componente**

```jsx
// src/components/ToastContainer.jsx
import React from 'react'

export default function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null
  return (
    <div
      style={{
        position: 'fixed', bottom: 16, left: 16, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <div
          key={t.id}
          className={`surface ${t.removing ? 'toast-out' : 'toast-in'}`}
          style={{
            padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 13, minWidth: 240, maxWidth: 320,
            pointerEvents: 'auto',
          }}
        >
          {t.Icon && (
            <t.Icon size={15} style={{ color: t.color, flexShrink: 0 }} />
          )}
          <span style={{ color: 'var(--text-1)', flex: 1, lineHeight: 1.4 }}>
            {t.message}
          </span>
          <button
            onClick={() => onRemove(t.id)}
            style={{
              color: 'var(--text-3)', background: 'none', border: 'none',
              cursor: 'pointer', padding: '0 2px', lineHeight: 1,
              fontSize: 15, flexShrink: 0,
              transition: 'color 120ms ease-out',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)' }}
            aria-label="Cerrar notificación"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ToastContainer.jsx
git commit -m "feat: add ToastContainer component with close button and exit animation"
```

---

## Task 4: Crear `context/ToastContext.jsx`

**Files:**
- Create: `src/context/ToastContext.jsx`

- [ ] **Step 1: Crear el directorio y el archivo**

```powershell
mkdir src\context
```

```jsx
// src/context/ToastContext.jsx
import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import ToastContainer from '../components/ToastContainer'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef    = useRef(0)
  const timersRef = useRef({})   // { [id]: { autoTimer?, removeTimer? } }

  const removeToast = useCallback((id) => {
    // Cancelar auto-dismiss si aún está pendiente
    clearTimeout(timersRef.current[id]?.autoTimer)
    // Marcar como "saliendo" para disparar la animación de salida
    setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t))
    // Esperar que termine la animación (150ms) antes de sacar del array
    const removeTimer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      delete timersRef.current[id]
    }, 150)
    timersRef.current[id] = { ...(timersRef.current[id] ?? {}), removeTimer }
  }, [])

  const addToast = useCallback(({ message, Icon, color }) => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, message, Icon, color, removing: false }])
    const autoTimer = setTimeout(() => removeToast(id), 3500)
    timersRef.current[id] = { autoTimer }
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
```

- [ ] **Step 2: Commit**

```bash
git add src/context/ToastContext.jsx
git commit -m "feat: add global ToastProvider and useToast hook"
```

---

## Task 5: Actualizar `main.jsx` — envolver app en ToastProvider

**Files:**
- Modify: `src/main.jsx`

- [ ] **Step 1: Agregar el import y envolver `<App>`**

Reemplazar el contenido completo de `src/main.jsx`:

```jsx
// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
)
```

- [ ] **Step 2: Verificar que la app sigue cargando sin errores en consola**

Correr `npm run dev` y abrir la app. No debe haber errores de contexto ni pantalla en blanco.

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "feat: wrap app in ToastProvider for global toast access"
```

---

## Task 6: Refactorizar `modules/Oportunidades.jsx` — toast local → useToast global

**Files:**
- Modify: `src/modules/Oportunidades.jsx`

- [ ] **Step 1: Agregar el import de useToast y quitar los imports que ya no se usan**

En el bloque de imports, agregar:
```jsx
import { useToast } from '../context/ToastContext'
```

Y remover `useCallback` de los imports de React si queda sin uso (verificar — sí se sigue usando para `cambiarEstado`, `handleContactar`, `handleSkip`). El import de `useCallback` debe quedarse.

- [ ] **Step 2: Eliminar el componente `ToastContainer` local (líneas 133–149 del archivo original)**

Borrar completamente este bloque:
```jsx
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
```

- [ ] **Step 3: Eliminar el estado y refs locales de toasts dentro del componente `Oportunidades()`**

Borrar estas 3 líneas:
```jsx
const [toasts, setToasts]   = useState([])
const _toastId = useRef(0)
const _toastTimers = useRef([])
```

- [ ] **Step 4: Eliminar la función `addToast` local**

Borrar este bloque:
```jsx
const addToast = useCallback((message, icon) => {
  const id = ++_toastId.current
  setToasts(prev => [...prev, { id, message, icon }])
  const timer = setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  _toastTimers.current.push(timer)
}, [])
```

- [ ] **Step 5: Eliminar el useEffect de cleanup de timers**

Borrar esta línea:
```jsx
useEffect(() => () => _toastTimers.current.forEach(clearTimeout), [])
```

- [ ] **Step 6: Agregar `useToast` y actualizar las llamadas a `addToast`**

Inmediatamente después de las líneas de estado que quedan, agregar:
```jsx
const { addToast } = useToast()
```

Luego actualizar `handleContactar`:
```jsx
const handleContactar = useCallback((id) => {
  cambiarEstado(id, 'contactada')
  addToast({ message: 'Oportunidad marcada como contactada', Icon: CheckCircle, color: 'var(--positive)' })
}, [cambiarEstado, addToast])
```

Y `handleSkip`:
```jsx
const handleSkip = useCallback((id) => {
  cambiarEstado(id, 'descartada')
  addToast({ message: 'Oportunidad descartada', Icon: MinusCircle, color: '#64748b' })
}, [cambiarEstado, addToast])
```

- [ ] **Step 7: Eliminar `<ToastContainer toasts={toasts} />` del JSX**

Al final del return del componente, borrar la línea:
```jsx
<ToastContainer toasts={toasts} />
```

- [ ] **Step 8: Verificar funcionamiento visual**

Navegar a Oportunidades en la app. Hacer click en "Contactar" en una oportunidad. Debe aparecer el toast en bottom-left con la animación de entrada, el botón ✕, y desaparecer a los 3.5s.

- [ ] **Step 9: Commit**

```bash
git add src/modules/Oportunidades.jsx
git commit -m "refactor: replace local toast in Oportunidades with global useToast"
```

---

## Task 7: Crear `utils/crearNotificacion.js`

**Files:**
- Create: `src/utils/crearNotificacion.js`

- [ ] **Step 1: Crear el archivo**

```js
// src/utils/crearNotificacion.js
import { supabase } from '../lib/supabase'

/**
 * Inserta una notificación en la tabla `notificaciones`.
 * Fire-and-forget — no lanza excepciones.
 */
export async function crearNotificacion({ tipo, titulo, mensaje, link = null, prioridad = 'normal' }) {
  const { error } = await supabase
    .from('notificaciones')
    .insert({ tipo, titulo, mensaje, link, prioridad })
  if (error) console.error('[notif]', error)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/crearNotificacion.js
git commit -m "feat: add crearNotificacion helper for inserting notifications"
```

---

## Task 8: Crear `components/NotifCenter.jsx`

**Files:**
- Create: `src/components/NotifCenter.jsx`

- [ ] **Step 1: Crear el componente completo**

```jsx
// src/components/NotifCenter.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { TIPO_CONFIG } from '../utils/tipoNotif'
import { tiempoRelativo } from '../utils/tiempoRelativo'

// ─── NotifRow ───────────────────────────────────────────────────────────────

function NotifRow({ notif, onAction }) {
  const cfg  = TIPO_CONFIG[notif.tipo] ?? TIPO_CONFIG.sistema
  const Icon = cfg.Icon
  return (
    <button
      onClick={() => onAction(notif)}
      style={{
        width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 16px 10px 13px',
        background: 'none', border: 'none', cursor: 'pointer',
        borderLeft: `3px solid ${notif.leida ? 'transparent' : cfg.color}`,
        textAlign: 'left',
        transition: 'background 120ms ease-out',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
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

// ─── Helpers de agrupación ───────────────────────────────────────────────────

function agrupar(notifs) {
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0)
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
  const grupos = { hoy: [], ayer: [], anteriores: [] }
  for (const n of notifs) {
    const d = new Date(n.created_at)
    if (d >= hoy)  grupos.hoy.push(n)
    else if (d >= ayer) grupos.ayer.push(n)
    else           grupos.anteriores.push(n)
  }
  return grupos
}

// ─── NotifCenter ─────────────────────────────────────────────────────────────

export default function NotifCenter({ unreadCount, onNav }) {
  const [open,    setOpen]    = useState(false)
  const [closing, setClosing] = useState(false)
  const [notifs,  setNotifs]  = useState([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef(null)
  const btnRef   = useRef(null)

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
    setClosing(true)
    setTimeout(() => { setOpen(false); setClosing(false) }, 150)
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

  // ── Render ─────────────────────────────────────────────────────────────────
  const grupos = agrupar(notifs)

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>

      {/* ── Campana ── */}
      <button
        ref={btnRef}
        onClick={togglePanel}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center',
          color: 'var(--text-2)', background: 'none', border: '1px solid transparent',
          cursor: 'pointer', padding: '4px 6px', borderRadius: 6,
          transition: 'color 120ms ease-out, background 120ms ease-out',
          WebkitAppRegion: 'no-drag',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = 'var(--text-1)'
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = 'var(--text-2)'
          e.currentTarget.style.background = 'none'
        }}
        title="Notificaciones"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -1, right: -1,
            background: 'var(--accent)', color: '#09090b',
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
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
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
                style={{
                  fontSize: 11, color: 'var(--accent)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  transition: 'opacity 120ms ease-out',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.7' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
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
              [['Hoy', grupos.hoy], ['Ayer', grupos.ayer], ['Anteriores', grupos.anteriores]].map(
                ([label, items]) => items.length === 0 ? null : (
                  <div key={label}>
                    <div style={{
                      padding: '8px 16px 4px',
                      fontSize: 10, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      color: 'var(--text-3)',
                      fontFamily: "'Geist Mono', monospace",
                    }}>
                      {label}
                    </div>
                    {items.map(n => (
                      <NotifRow key={n.id} notif={n} onAction={markRead} />
                    ))}
                  </div>
                )
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar que no hay errores de importación en la consola**

Correr `npm run dev`. La app debe cargar sin errores. El componente `NotifCenter` aún no está conectado a la nav — eso pasa en Task 9.

- [ ] **Step 3: Commit**

```bash
git add src/components/NotifCenter.jsx
git commit -m "feat: add NotifCenter component with bell, dropdown panel, and realtime list"
```

---

## Task 9: Actualizar `App.jsx` — conectar todo

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Agregar los imports nuevos**

Al inicio de `App.jsx`, agregar junto a los imports existentes:

```jsx
import NotifCenter from './components/NotifCenter'
import { useToast } from './context/ToastContext'
import { TIPO_CONFIG } from './utils/tipoNotif'
```

- [ ] **Step 2: Agregar estado y hook dentro de `App()`**

Inmediatamente después de `const [nuevasCount, setNuevasCount] = useState(0)`, agregar:

```jsx
const [notifCount, setNotifCount] = useState(0)
const { addToast } = useToast()
```

- [ ] **Step 3: Agregar el useEffect del canal `notificaciones-badge`**

Después del `useEffect` existente de oportunidades-badge (el que termina con `return () => supabase.removeChannel(channel)`), agregar:

```jsx
useEffect(() => {
  const fetchNotifCount = () => {
    supabase
      .from('notificaciones')
      .select('id', { count: 'exact', head: true })
      .eq('leida', false)
      .then(({ count }) => { setNotifCount(count ?? 0) })
  }

  fetchNotifCount()

  const channel = supabase
    .channel('notificaciones-badge')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'notificaciones' },
      (payload) => {
        fetchNotifCount()
        if (payload.eventType === 'INSERT') {
          const n = payload.new
          if (n.prioridad === 'normal' || n.prioridad === 'alta') {
            const cfg = TIPO_CONFIG[n.tipo] ?? TIPO_CONFIG.sistema
            addToast({ message: n.titulo, Icon: cfg.Icon, color: cfg.color })
          }
        }
      }
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}, [addToast])
```

- [ ] **Step 4: Actualizar `rightContent` en el JSX de `<TopNav>`**

Cambiar la línea que pasa `rightContent`:

**Antes:**
```jsx
<TopNav active={page} onNav={p => setPage(p)} rightContent={<BackupBar />} badgeCounts={{ oportunidades: nuevasCount }} />
```

**Después:**
```jsx
<TopNav
  active={page}
  onNav={p => setPage(p)}
  rightContent={
    <>
      <NotifCenter unreadCount={notifCount} onNav={p => setPage(p)} />
      <BackupBar />
    </>
  }
  badgeCounts={{ oportunidades: nuevasCount }}
/>
```

- [ ] **Step 5: Verificación visual completa**

1. Correr `npm run dev`.
2. La campana debe aparecer en la nav, a la izquierda de `BackupBar`.
3. Si hay notificaciones no leídas en Supabase, el badge con el número debe ser visible.
4. Hacer click en la campana: el panel debe abrirse con animación (scale + fade desde top right).
5. Click fuera del panel: debe cerrarse con animación de salida.
6. Si hay notificaciones, deben aparecer agrupadas por Hoy/Ayer/Anteriores con íconos y colores correctos.
7. Click en una notificación no leída: el punto indicador debe desaparecer (marcada como leída) y si tiene `link` debe navegar al módulo correspondiente.
8. "Marcar todas como leídas": el badge debe bajar a 0 y los puntos indicadores desaparecer.
9. Insertar una notificación desde Supabase Studio con `prioridad = 'normal'` o `'alta'`: el badge debe actualizarse en tiempo real Y debe aparecer un toast en bottom-left.
10. El toast debe tener botón ✕ funcional y desaparecer automáticamente a los 3.5s.
11. En Oportunidades, hacer Contactar/Skip: los toasts siguen funcionando con el botón ✕.

- [ ] **Step 6: Commit final**

```bash
git add src/App.jsx
git commit -m "feat: wire NotifCenter and realtime badge into App, toasts on new notifications"
```

---

## Self-Review

### Spec coverage

| Sección spec | Tarea que la implementa |
|---|---|
| ToastContext + useToast + removeToast | Task 4 |
| ToastContainer con botón ✕ y animación salida | Task 3 + Task 2 |
| Refactor Oportunidades sin toast duplicado en realtime | Task 6 |
| crearNotificacion helper | Task 7 |
| NotifCenter: campana + badge | Task 8 |
| NotifCenter: panel glass, animaciones, transform-origin top right | Task 8 + Task 2 |
| Query limitada a 50 registros | Task 8 (fetchNotifs con .limit(50)) |
| Agrupación Hoy/Ayer/Anteriores | Task 8 (función agrupar) |
| NotifRow: borde izquierdo por tipo, punto indicador, tiempo relativo | Task 8 |
| Click en notif: marca leída + navega si tiene link | Task 8 (markRead) |
| Marcar todas como leídas | Task 8 (markAllRead) |
| Estado vacío y loading | Task 8 |
| Canal `notificaciones-panel` (ciclo: open=true → subscribe, open=false → cleanup) | Task 8 |
| Canal `notificaciones-badge` escucha `*` (INSERT + UPDATE) | Task 9 |
| Toast automático solo en INSERT con prioridad normal/alta | Task 9 |
| TIPO_CONFIG compartido entre NotifCenter y App.jsx | Task 1 |
| ToastProvider en main.jsx | Task 5 |
| Animaciones CSS con transform-origin: top right | Task 2 |
| prefers-reduced-motion para las nuevas clases | Task 2 |

Cobertura: **completa**. Todos los requisitos del spec tienen tarea asignada.

### Placeholders

Ninguno encontrado. Todas las tareas contienen código completo.

### Type consistency

- `addToast({ message, Icon, color })` — definido en Task 4, usado con la misma firma en Task 6 (Oportunidades) y Task 9 (App.jsx). ✓
- `TIPO_CONFIG[tipo].Icon` — definido en Task 1, usado en Task 8 (NotifCenter) y Task 9 (App.jsx). ✓
- `removeToast(id)` — definido en Task 4, pasado como `onRemove` a ToastContainer en Task 4, recibido como `onRemove` en Task 3. ✓
- `fetchNotifs()` — definida en Task 8 como `useCallback async`, usada en `openPanel`, en el `useEffect` realtime del panel, y en el handler de postgres_changes. ✓
- `closePanel()` — definida en Task 8, usada en `togglePanel`, click outside, y `markRead`. ✓
- `onAction(notif)` → `markRead(notif)` — `NotifRow` recibe `onAction` prop (Task 8), `NotifCenter` la pasa como `onAction={markRead}`. ✓
