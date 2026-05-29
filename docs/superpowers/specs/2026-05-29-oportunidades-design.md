# Módulo Oportunidades — Spec

**Fecha:** 2026-05-29  
**Estado:** Aprobado por usuario

---

## Resumen

Nuevo módulo "Oportunidades" para Vanderbus. Lee la tabla `oportunidades` de Supabase, muestra cada registro como card accionable, y expone el conteo de nuevas como badge en la navegación principal en tiempo real.

---

## Arquitectura — Opción A (Direct Supabase + suscripción liviana en App)

```
App.jsx
  ├─ useEffect: supabase realtime channel 'oportunidades-count'
  │   → suscribe a INSERT/UPDATE en tabla oportunidades
  │   → mantiene `nuevasCount` en state
  ├─ <TopNav badgeCounts={{ oportunidades: nuevasCount }} />
  └─ {page === 'oportunidades' && <Oportunidades />}

Sidebar.jsx
  └─ acepta prop badgeCounts; navItem 'oportunidades' muestra badge si count > 0

src/modules/Oportunidades.jsx     ← archivo nuevo
src/utils/tiempoRelativo.js       ← archivo nuevo
```

### Tabla Supabase

```
oportunidades (
  id         uuid PK,
  grupo      text,
  texto      text,
  zona       text,
  link       text,
  estado     text  -- 'nueva' | 'contactada' | 'descartada' | 'cerrada'
  fuente     text,
  notas      text,
  created_at timestamptz,
  updated_at timestamptz
)
```

### Query principal

```sql
SELECT *
FROM oportunidades
WHERE created_at::date = CURRENT_DATE
ORDER BY
  CASE estado WHEN 'nueva' THEN 0 ELSE 1 END ASC,
  created_at DESC
```

### Mutación de estado

`UPDATE oportunidades SET estado = $1, updated_at = now() WHERE id = $2`  
Ejecutada via `supabase.from('oportunidades').update({ estado, updated_at: new Date() }).eq('id', id)`.  
Después del update, refrescar list local con optimistic update (no re-fetch).

---

## Componentes

### StatsBar

Grid `grid-cols-4 gap-4`, estructura idéntica a Marketing:  
`surface` + barra vertical izquierda de 3px + label `db-slabel` + número `.num`.

| Stat | Color de barra |
|---|---|
| Nuevas | `var(--accent)` sky |
| Contactadas | `var(--positive)` green |
| Descartadas | `#64748b` slate |
| Total | `#64748b` slate |

### FilterTabs

Barra de pills debajo de StatsBar. Opciones: Todas / Nuevas / Contactadas / Descartadas.  
Estilo activo: `background: var(--accent-dim); color: var(--accent); border: 1px solid rgba(56,189,248,0.12)`.  
Estilo inactivo: ghost, color `var(--text-2)`, hover `rgba(255,255,255,0.04)`.  
Filtrado en memoria sobre la lista fetched.

### OportunidadCard

Clase base: `surface surface-hover`, padding 16px, border-radius `var(--radius)`.

Layout vertical:

```
[grupo  ·  badge-estado]          [tiempo relativo]
[texto truncado 2 líneas]
[📍 zona]
[Ver post]  [Contactar]  [Skip]
```

**Fila 1:** `grupo` en `font-semibold text-sm` / `var(--text-1)` + badge estado a la izquierda + tiempo relativo `text-xs` `var(--text-3)` float right.

**Fila 2:** `texto` con `display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden`, color `var(--text-2)`, `text-sm`.

**Fila 3:** MapPin icon 12px + zona, `text-xs` `var(--text-3)`, gap 4px.

**Fila 4 (botones):**

| Botón | Estilo |
|---|---|
| Ver post | ghost, `var(--text-2)` → hover `var(--text-1)`, ExternalLink icon 13px |
| Contactar | `var(--positive-dim)` bg + `var(--positive)` text, hover brightens |
| Skip | `rgba(100,116,139,0.10)` bg + `#64748b` text — mismo tratamiento que badge descartada |

### Badge de estado

Pill `text-xs font-semibold rounded-full px-2 py-0.5`:

| Estado | bg | color |
|---|---|---|
| nueva | `var(--accent-dim)` | `var(--accent)` |
| contactada | `var(--positive-dim)` | `var(--positive)` |
| descartada | `rgba(100,116,139,0.10)` | `#64748b` |
| cerrada | `rgba(167,139,250,0.10)` | `#a78bfa` |

### Toast System

State local: `toasts` = array de `{ id, message, type }`.  
Auto-dismiss: 3500ms tras mount del toast (via `setTimeout`).  
Posición: `fixed bottom-4 left-4 z-50 flex flex-col gap-2`.

Cada toast: glass card `surface`, padding `10px 16px`, `text-sm`, ícono + mensaje.  
Entrada: `@keyframes toast-in { from { opacity:0; transform: translateX(-110%) } to { opacity:1; transform: translateX(0) } }`, 220ms ease-out.

Mensajes:
- Contactar → "Oportunidad marcada como contactada" (positive, CheckCircle icon)
- Skip → "Oportunidad descartada" (slate, MinusCircle icon)

---

## Badge de navegación

`nuevasCount` se calcula en `App.jsx` con:

```js
useEffect(() => {
  // fetch inicial
  supabase
    .from('oportunidades')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'nueva')
    .then(({ count }) => setNuevasCount(count ?? 0))

  // suscripción realtime
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

En `Sidebar.jsx`, el item oportunidades renderiza:
```jsx
<span style={{
  background: 'var(--accent)', color: '#09090b',
  borderRadius: 9999, fontSize: 10, fontWeight: 700,
  padding: '0 5px', lineHeight: '16px', minWidth: 16, textAlign: 'center'
}}>
  {count}
</span>
```
Solo visible si `count > 0`.

---

## Utilidad `tiempoRelativo`

```js
export function tiempoRelativo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 60)  return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  return `hace ${Math.floor(hours / 24)}d`
}
```

---

## Icono de navegación

`Target` de lucide-react. Acento: `#38BDF8` (sky, mismo que accent del sistema).

---

## Archivos a crear / modificar

| Archivo | Acción |
|---|---|
| `src/modules/Oportunidades.jsx` | Crear |
| `src/utils/tiempoRelativo.js` | Crear |
| `src/App.jsx` | Modificar: import + nuevasCount state + render case |
| `src/components/Sidebar.jsx` | Modificar: prop badgeCounts + badge en nav item |

---

## Animaciones

- Cards: `db-in db-d{i}` stagger con index × 50ms, igual que todos los módulos.
- Toast entrada: `toast-in` keyframe (definido en `index.css`).
- Botones: hereda `button:active { transform: scale(0.97) }` del sistema global.
- Card hover: hereda `.surface-hover` lift.

---

## Empty state

Si no hay oportunidades del día (o ninguna pasa el filtro activo): caja centrada con ícono Target 32px opaco + texto "Sin oportunidades para hoy" / "No hay oportunidades en este filtro", estilo `.db-empty`.
