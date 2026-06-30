# Sistema de Notificaciones — Vanderbus
**Fecha:** 2026-05-30  
**Estado:** Aprobado

---

## Contexto

Vanderbus es una SPA Electron + React + Tailwind que usa Supabase directamente (sin Redux, sin React Query). La tabla `notificaciones` ya existe en Supabase con los campos: `id`, `tipo`, `titulo`, `mensaje`, `link`, `prioridad` (baja/normal/alta), `leida` (bool), `created_at`.

El patrón de arquitectura a seguir es el de `Oportunidades`: queries directas a Supabase + suscripción realtime liviana en `App.jsx` para el badge, pasado como prop a la nav.

---

## Archivos nuevos y modificados

```
src/
├── context/
│   └── ToastContext.jsx          ← NUEVO
├── components/
│   ├── NotifCenter.jsx           ← NUEVO
│   └── ToastContainer.jsx        ← NUEVO
├── utils/
│   ├── crearNotificacion.js      ← NUEVO
│   └── tipoNotif.js              ← NUEVO (TIPO_CONFIG: colores + íconos, compartido)
├── modules/
│   └── Oportunidades.jsx         ← MODIFICADO (refactor toast local → useToast)
└── App.jsx                       ← MODIFICADO (ToastProvider wrapper + notif realtime)
```

`Sidebar.jsx` no cambia su API pública ni su estructura interna.

---

## 1. ToastContext — contexto global de toasts

**Archivo:** `src/context/ToastContext.jsx`

Exporta `ToastProvider` (componente) y `useToast` (hook).

```
ToastProvider
  ├─ state: toasts[]  { id, message, icon, color }
  ├─ addToast({ message, icon, color })   ← schedula auto-dismiss a 3500ms
  ├─ removeToast(id)                      ← dismiss manual (botón ✕)
  ├─ {children}
  └─ <ToastContainer toasts={toasts} onRemove={removeToast} />
```

**ToastContainer** — `position: fixed`, `bottom: 16px`, `left: 16px`, `z-index: 50`, `pointer-events: none` en el wrapper pero `pointer-events: auto` en cada toast. Cada toast tiene:
- Fondo `var(--bg-elevated)` + `border: 1px solid var(--border)`, `border-radius: var(--radius)`, `backdrop-filter: blur(12px)`.
- Ícono coloreado según `color`.
- Texto del mensaje.
- Botón ✕ (dismiss inmediato, limpia el timer pendiente).
- Animación de entrada: clase `.toast-in` ya definida en `index.css` (slide desde left, 220ms ease-out). Salida: cada toast tiene un boolean `removing` en su state; al expirar el timer o al clickear ✕ se setea `removing=true` (dispara clase `.toast-out`: `opacity 0 + translateX(-110%)` en 150ms), y recién después se remueve del array via `setTimeout(150ms)`.

Oportunidades.jsx elimina: `ToastContainer` local, `useState(toasts)`, `useRef(_toastId)`, `useRef(_toastTimers)`, `addToast` local. Los reemplaza con `const { addToast } = useToast()`. Los llamados a `addToast` en `handleContactar` y `handleSkip` quedan — son acciones de usuario y deben seguir disparando toast.

**Importante:** El realtime de notificaciones es el único responsable de disparar el toast de "nueva oportunidad" vía INSERT. Oportunidades.jsx NO dispara toast propio al recibir nuevas oportunidades por realtime — solo en acciones explícitas del usuario (Contactar / Skip).

---

## 2. NotifCenter — campana + panel desplegable

**Archivo:** `src/components/NotifCenter.jsx`

Props: `unreadCount: number`, `onNav: (page: string) => void`

### Campana (trigger)

Botón icono `Bell` de lucide-react, posicionado en el `rightContent` de TopNav (antes de BackupBar). Badge con estilo idéntico al badge de oportunidades en la nav: `background: var(--accent)`, `color: #09090b`, `border-radius: 9999`, `font-size: 10`, `font-weight: 700`. Se oculta cuando `unreadCount === 0`.

Animación del badge al aparecer: `scale(0.7) opacity(0)` → `scale(1) opacity(1)` en 180ms ease-out.

### Panel desplegable

Posición: `absolute`, anclado a la campana (`top: calc(100% + 8px)`, `right: 0`). Dimensiones: `width: 320px`, `max-height: 480px`, `overflow-y: auto`. Estilo glass: `background: var(--bg-elevated)`, `border: 1px solid var(--border-hi)`, `border-radius: var(--radius)`, `backdrop-filter: blur(16px)`, `box-shadow: 0 8px 32px rgba(0,0,0,0.5)`.

Animación entrada: `opacity: 0; transform: translateY(-6px) scale(0.98)` → `opacity: 1; transform: translateY(0) scale(1)` en 200ms `cubic-bezier(0.23, 1, 0.32, 1)`. Salida: 150ms. `transform-origin: top right` (escala desde la campana, no desde el centro).

Click outside cierra el panel (listener en `document`, cleanup en useEffect).

### Query interna

Al abrir el panel (lazy), o si ya está abierto y llega un UPDATE via realtime local:

```js
supabase
  .from('notificaciones')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(50)
```

Límite de 50 registros para evitar degradación con el tiempo. La suscripción realtime del panel es propia (canal `notificaciones-panel`), separada del canal de App.jsx. Ciclo de vida: se suscribe en el `useEffect` que se dispara cuando `open === true`, hace cleanup (`supabase.removeChannel`) cuando el panel se cierra (`open === false`). Al recibir cualquier evento, refetchea la lista completa (`.limit(50)`).

### Agrupación temporal

```
Hoy      → created_at >= hoy 00:00 local
Ayer     → created_at >= ayer 00:00 local
Anteriores → el resto (dentro del límite de 50)
```

Grupos vacíos no se renderizan.

### NotifRow

Cada notificación muestra:
- Borde izquierdo de 3px del color del tipo.
- Ícono del tipo (lucide, 14px), coloreado.
- Título (`font-weight: 600`, `font-size: 13px`).
- Mensaje (2 líneas max, `-webkit-line-clamp: 2`, `font-size: 12px`, `color: var(--text-2)`).
- Tiempo relativo via `tiempoRelativo()` ya existente.
- Punto indicador `•` si `leida === false`.

Click en row:
1. `UPDATE notificaciones SET leida=true WHERE id=X` (optimistic: actualiza state local primero).
2. Si tiene `link`, llama `onNav(link)` y cierra el panel.

### Header del panel

```
"Notificaciones"  [Marcar todas como leídas]
```

"Marcar todas": `UPDATE notificaciones SET leida=true WHERE leida=false`. Botón solo visible si `unreadCount > 0`.

### Estados

- **Cargando:** spinner o texto "Cargando…" mientras se hace la query inicial.
- **Vacío:** ícono `Bell` tenue + "No tenés notificaciones".

---

## 3. Realtime en App.jsx

Canal: `notificaciones-badge`. Escucha **todos** los eventos (`*`) sobre la tabla `notificaciones`.

```js
const fetchCount = () =>
  supabase
    .from('notificaciones')
    .select('id', { count: 'exact', head: true })
    .eq('leida', false)
    .then(({ count }) => setNotifCount(count ?? 0))

const channel = supabase.channel('notificaciones-badge')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'notificaciones' },
    (payload) => {
      fetchCount()  // siempre refresca el count (cubre INSERT y UPDATE leida=true)
      if (payload.eventType === 'INSERT') {
        const n = payload.new
        if (n.prioridad === 'normal' || n.prioridad === 'alta') {
          addToast({ message: n.titulo, icon: <TipoIcon tipo={n.tipo} />, color: TIPO_COLOR[n.tipo] })
        }
      }
    }
  ).subscribe()
```

`addToast` se obtiene de `useToast()` dentro de App, que ya está envuelto en `ToastProvider`.

---

## 4. crearNotificacion helper

**Archivo:** `src/utils/crearNotificacion.js`

```js
export async function crearNotificacion({ tipo, titulo, mensaje, link = null, prioridad = 'normal' }) {
  const { error } = await supabase
    .from('notificaciones')
    .insert({ tipo, titulo, mensaje, link, prioridad })
  if (error) console.error('[notif]', error)
}
```

Fire-and-forget. Sin throw. Sin valor de retorno.

---

## 5. Colores y íconos por tipo

| tipo | color hex | token | ícono lucide |
|---|---|---|---|
| oportunidad | `#38bdf8` | `var(--accent)` | `Target` |
| nomina | `#34d399` | `var(--positive)` | `DollarSign` |
| vencimiento | `#fb923c` | — | `AlertTriangle` |
| viaje | `#60a5fa` | — | `MapPin` |
| gps | `#22d3ee` | — | `Navigation` |
| finanzas | `#a78bfa` | — | `TrendingUp` |
| mantenimiento | `#fbbf24` | `var(--warning)` | `Wrench` |
| sistema | `#94a3b8` | `var(--text-2)` | `Settings` |

Definidos como un mapa constante `TIPO_CONFIG` en `src/utils/tipoNotif.js`, importado tanto por `NotifCenter` como por `App.jsx`. Evita duplicar la tabla de colores/íconos.

---

## 6. Cambios en App.jsx

1. Envolver el árbol en `<ToastProvider>`.
2. Agregar `useState(notifCount)` + `useEffect` con canal `notificaciones-badge`.
3. Pasar `rightContent={<><NotifCenter unreadCount={notifCount} onNav={setPage} /><BackupBar /></>}` a `TopNav`.

---

## 7. Animaciones — resumen de decisiones (Emil Design)

| Elemento | Duración | Easing | Notas |
|---|---|---|---|
| Panel entrada | 200ms | `cubic-bezier(0.23, 1, 0.32, 1)` | `transform-origin: top right` |
| Panel salida | 150ms | `cubic-bezier(0.23, 1, 0.32, 1)` | Asimétrico (más rápido salida) |
| Toast entrada | 220ms | mismo (ya en `.toast-in`) | Slide desde left |
| Toast salida | 150ms | mismo | fade + slide de vuelta |
| Badge aparece | 180ms | `ease-out` | `scale(0.7)+opacity(0)` → normal |

---

## 8. Lo que NO cambia

- `Sidebar.jsx` — sin cambios de API ni estructura.
- `SeguimientoGPS.jsx`, `Finanzas.jsx`, etc. — no se modifican.
- `index.css` — solo se agrega la animación de salida de toast si no existe; no se toca lo existente.
- El patrón de query directa a Supabase (sin Context nuevo para datos, solo para toasts).
