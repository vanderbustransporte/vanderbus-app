# Light / Dark Mode Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a premium light mode (glass on light, shadows not glows, adjusted semantic palette) with a Sun/Moon toggle in the TopNav, persisted to localStorage with no theme-flash on load.

**Architecture:** All theme values are controlled by CSS custom properties in `:root` (dark default) overridden by `[data-theme="light"]` on `<html>`. New tokens are added for inline-style values (hover tints, chart colours, tooltips, overlays) that are currently hardcoded as rgba(255,255,255,…). A tiny inline `<script>` in `index.html` reads localStorage and applies the attribute synchronously before any render. `ThemeContext` manages React state and the 200ms transition class. Charts use a shared `useChartTheme()` hook.

**Tech Stack:** React JSX + Tailwind CSS v4 (custom properties), Lucide React (Sun/Moon), Recharts.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `index.html` | Anti-flash inline script |
| Modify | `src/index.css` | All token additions, `[data-theme="light"]` block, fix hardcoded-in-CSS values, Leaflet overrides, `.theme-transitioning` |
| Create | `src/context/ThemeContext.jsx` | Theme state, toggle, localStorage persistence |
| Create | `src/components/ThemeToggle.jsx` | Sun/Moon button |
| Create | `src/utils/chartTheme.js` | `useChartTheme()` hook — tooltip styles, grid stroke, tick fill |
| Modify | `src/main.jsx` | Wrap app in `ThemeProvider` |
| Modify | `src/App.jsx` | Add `ThemeToggle` to TopNav rightContent |
| Modify | `src/components/Sidebar.jsx` | Replace `rgba(255,255,255,…)` hover tints + `#09090b` badge text |
| Modify | `src/components/NotifCenter.jsx` | Replace hover tints, `#09090b` badge text, panel shadow |
| Modify | `src/components/shared/Table.jsx` | Replace hover tints + `#27272a` pagination bg |
| Modify | `src/components/shared/Modal.jsx` | Replace backdrop + shadow tokens |
| Modify | `src/components/shared/Field.jsx` | Replace focus `#38bdf8` → `var(--accent)` |
| Modify | `src/components/shared/SearchBar.jsx` | Same focus fix |
| Modify | `src/modules/Dashboard.jsx` | Chart tick/grid/tooltip → `useChartTheme()` |
| Modify | `src/modules/Combustible.jsx` | Chart tick/grid/tooltip → `useChartTheme()` + hardcoded-in-JS colors |
| Modify | `src/modules/Finanzas.jsx` | Hover tints + chart |
| Modify | `src/modules/Mantenimiento.jsx` | Hover tints |
| Modify | `src/modules/Marketing.jsx` | Hover tints |
| Modify | `src/modules/Nomina.jsx` | Hover tints |
| Modify | `src/modules/Contactos.jsx` | Replace old-style hardcoded palette (`#4A8FD4`, `#1E1E2E`, `#2E2E42`, `#252535`) |
| Modify | `src/modules/Backup.jsx` | Replace hardcoded light-only palette with tokens |

---

## Task 1: CSS Foundations — tokens, light override, CSS-class fixes

**Files:**
- Modify: `src/index.css`

### Light mode palette reference (for all tasks below)

```
Dark default (already exists):
  --bg-base: #09090b  --bg-surface: #101012  --bg-elevated: #18181b  --bg-overlay: #27272a
  --text-1: #f1f5f9   --text-2: #94a3b8      --text-3: #52525b
  --accent: #38bdf8   (sky-400)

Light override target:
  --bg-base: #f7f8fa        (warm off-white — not pure white to avoid harshness)
  --bg-surface: #ffffff     (pure white cards — maximum contrast)
  --bg-elevated: #f0f4f8    (light steel-blue-grey for depth)
  --bg-overlay: #e2e8f0     (slate-200 for menus/dropdowns)
  --border: rgba(0,0,0,0.08)   --border-hi: rgba(0,0,0,0.14)
  --text-1: #0f172a   --text-2: #475569   --text-3: #94a3b8
  --accent: #0284c7          (sky-600 — deeper than sky-400, WCA-legible on white)
  --accent-dim: rgba(2,132,199,0.10)   --accent-glow: rgba(2,132,199,0.05)
  --positive: #059669        (emerald-600)
  --positive-dim: rgba(5,150,105,0.10)
  --danger: #dc2626          (red-600)
  --danger-dim: rgba(220,38,38,0.10)
  --warning: #b45309         (amber-700 — darkened for WCAG contrast on white)
  --warning-dim: rgba(180,83,9,0.10)
```

- [ ] **Step 1: Add new shared tokens to `:root` block** in `src/index.css` (append after `--radius-sm`):

```css
  /* ── Theme-aware inline-style tokens ──────────────────── */
  --hover-tint:     rgba(255, 255, 255, 0.04);
  --hover-tint-md:  rgba(255, 255, 255, 0.06);
  --chart-grid:     rgba(255, 255, 255, 0.06);
  --chart-tick:     #94a3b8;
  --tooltip-bg:     #27272a;
  --tooltip-border: rgba(255, 255, 255, 0.13);
  --tooltip-shadow: 0 8px 32px rgba(0, 0, 0, 0.60);
  --modal-backdrop: rgba(0, 0, 0, 0.65);
  --modal-shadow:   0 24px 64px rgba(0, 0, 0, 0.70);
  --panel-shadow:   0 8px 32px rgba(0, 0, 0, 0.50);
  --badge-text:     #09090b;
  --scrollbar-hover: rgba(255, 255, 255, 0.22);
```

- [ ] **Step 2: Add `[data-theme="light"]` block** after the `:root` block, before the `/* ── Reset & base ──` comment:

```css
/* ── Light mode overrides ──────────────────────────────── */
[data-theme="light"] {
  --bg-base:     #f7f8fa;
  --bg-surface:  #ffffff;
  --bg-elevated: #f0f4f8;
  --bg-overlay:  #e2e8f0;

  --border:    rgba(0, 0, 0, 0.08);
  --border-hi: rgba(0, 0, 0, 0.14);

  --text-1: #0f172a;
  --text-2: #475569;
  --text-3: #94a3b8;

  --accent:      #0284c7;
  --accent-dim:  rgba(2, 132, 199, 0.10);
  --accent-glow: rgba(2, 132, 199, 0.05);

  --positive:     #059669;
  --positive-dim: rgba(5, 150, 105, 0.10);
  --danger:       #dc2626;
  --danger-dim:   rgba(220, 38, 38, 0.10);
  --warning:      #b45309;
  --warning-dim:  rgba(180, 83, 9, 0.10);

  --hover-tint:     rgba(0, 0, 0, 0.04);
  --hover-tint-md:  rgba(0, 0, 0, 0.07);
  --chart-grid:     rgba(0, 0, 0, 0.06);
  --chart-tick:     #64748b;
  --tooltip-bg:     #ffffff;
  --tooltip-border: rgba(0, 0, 0, 0.10);
  --tooltip-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  --modal-backdrop: rgba(0, 0, 0, 0.40);
  --modal-shadow:   0 24px 64px rgba(0, 0, 0, 0.15);
  --panel-shadow:   0 8px 32px rgba(0, 0, 0, 0.12);
  --badge-text:     #ffffff;
  --scrollbar-hover: rgba(0, 0, 0, 0.22);
}
```

- [ ] **Step 3: Add `.theme-transitioning` rule** (after the scrollbar block):

```css
/* ── Theme transition — only active during the 250ms switch ─ */
.theme-transitioning *,
.theme-transitioning *::before,
.theme-transitioning *::after {
  transition:
    background-color 200ms ease,
    color            200ms ease,
    border-color     200ms ease,
    box-shadow       200ms ease !important;
}
```

- [ ] **Step 4: Fix `.mod-h1` gradient** — replace the existing `.mod-h1` rule with:

```css
.mod-h1 {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin: 0;
  background: linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.68) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
[data-theme="light"] .mod-h1 {
  background: linear-gradient(135deg, #0f172a 0%, rgba(15, 23, 42, 0.70) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

- [ ] **Step 5: Fix `.mod-sub`** — replace existing `.mod-sub` rule:

```css
.mod-sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.32);
  margin-top: 5px;
  letter-spacing: 0.025em;
}
[data-theme="light"] .mod-sub {
  color: var(--text-3);
}
```

- [ ] **Step 6: Fix `.glass-btn-primary`** — replace existing rule + hover override:

```css
.glass-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border-radius: var(--radius);
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #f1f5f9;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  transition:
    background   150ms cubic-bezier(0.23, 1, 0.32, 1),
    border-color 150ms cubic-bezier(0.23, 1, 0.32, 1),
    box-shadow   150ms cubic-bezier(0.23, 1, 0.32, 1);
}
[data-theme="light"] .glass-btn-primary {
  background: rgba(2, 132, 199, 0.10);
  border-color: rgba(2, 132, 199, 0.22);
  color: var(--accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
@media (hover: hover) and (pointer: fine) {
  .glass-btn-primary:hover {
    background: rgba(56, 189, 248, 0.20);
    border-color: rgba(255, 255, 255, 0.22);
    box-shadow: 0 4px 18px rgba(56, 189, 248, 0.18);
  }
  [data-theme="light"] .glass-btn-primary:hover {
    background: rgba(2, 132, 199, 0.16);
    border-color: rgba(2, 132, 199, 0.32);
    box-shadow: 0 4px 14px rgba(2, 132, 199, 0.15);
  }
}
```

- [ ] **Step 7: Fix scrollbar hover** — replace the existing scrollbar hover rule:

```css
::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); border-radius: 3px; }
```

- [ ] **Step 8: Add Leaflet light-mode overrides** — append after the existing `.leaflet-control-attribution a` rule:

```css
/* ── Leaflet: overrides tema claro ────────────────────── */
[data-theme="light"] .leaflet-popup-content-wrapper {
  background: #ffffff;
  border: 1px solid rgba(2, 132, 199, 0.18);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14);
  color: #0f172a;
}
[data-theme="light"] .leaflet-popup-tip { background: #ffffff; }
[data-theme="light"] .leaflet-popup-close-button { color: #94a3b8 !important; }
[data-theme="light"] .leaflet-popup-close-button:hover { color: #475569 !important; }
[data-theme="light"] .leaflet-container { background: #dce8f0; }
[data-theme="light"] .leaflet-control-zoom a {
  background: #ffffff !important;
  border-color: rgba(0, 0, 0, 0.10) !important;
  color: #475569 !important;
}
[data-theme="light"] .leaflet-control-zoom a:hover {
  background: #f0f4f8 !important;
  color: #0f172a !important;
}
[data-theme="light"] .leaflet-control-attribution {
  background: rgba(248, 250, 252, 0.85) !important;
  color: #64748b !important;
  backdrop-filter: blur(4px);
}
[data-theme="light"] .leaflet-control-attribution a { color: #475569 !important; }
```

---

## Task 2: ThemeContext and ThemeToggle

**Files:**
- Create: `src/context/ThemeContext.jsx`
- Create: `src/components/ThemeToggle.jsx`

- [ ] **Step 1: Create `src/context/ThemeContext.jsx`:**

```jsx
import React, { createContext, useContext, useState, useEffect } from 'react'

const ThemeCtx = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('vanderbus_theme') || 'dark'
  )

  useEffect(() => {
    const attr = theme === 'light' ? 'light' : ''
    document.documentElement.setAttribute('data-theme', attr)
  }, [theme])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('vanderbus_theme', next)
    document.documentElement.classList.add('theme-transitioning')
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 260)
    setTheme(next)
  }

  return (
    <ThemeCtx.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export const useTheme = () => useContext(ThemeCtx)
```

- [ ] **Step 2: Create `src/components/ThemeToggle.jsx`:**

```jsx
import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: 6,
        background: 'none', border: '1px solid transparent',
        cursor: 'pointer', color: 'var(--text-2)',
        transition: 'color 120ms ease-out, background 120ms ease-out',
        WebkitAppRegion: 'no-drag',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--hover-tint-md)'
        e.currentTarget.style.color = 'var(--text-1)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'none'
        e.currentTarget.style.color = 'var(--text-2)'
      }}
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  )
}
```

---

## Task 3: Anti-flash script + wire up providers

**Files:**
- Modify: `index.html`
- Modify: `src/main.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Read `src/main.jsx`** to understand current wrapper structure, then wrap `<App />` with `<ThemeProvider>`:

Add import at top:
```jsx
import { ThemeProvider } from './context/ThemeContext'
```

Wrap the `<App />` render:
```jsx
// Replace the ReactDOM.createRoot(...).render(...) call:
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
```

- [ ] **Step 2: Add anti-flash `<script>` to `index.html`** — insert before `</head>`:

```html
    <script>
      (function () {
        var t = localStorage.getItem('vanderbus_theme');
        if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
      })();
    </script>
```

- [ ] **Step 3: Add `ThemeToggle` to `src/App.jsx`** — add import and wire into TopNav rightContent:

```jsx
import ThemeToggle from './components/ThemeToggle'
```

In the `rightContent` prop passed to `<TopNav>`, add `<ThemeToggle />` as the first element:

```jsx
rightContent={
  <>
    <ThemeToggle />
    <NotifCenter unreadCount={notifCount} onNav={p => setPage(p)} />
    <BackupBar />
  </>
}
```

- [ ] **Step 4: Start the dev server and confirm the toggle appears and switching works with no flash on reload.**

Run: `cd C:\vanderbus-app\vanderbus && npx vite`

Expected: Toggle icon (Sun in dark mode, Moon in light mode) appears in the top nav. Clicking switches theme. Refreshing with light mode active does NOT show a dark flash.

---

## Task 4: Fix shared components

**Files:**
- Modify: `src/components/shared/Table.jsx`
- Modify: `src/components/shared/Modal.jsx`
- Modify: `src/components/shared/Field.jsx`
- Modify: `src/components/shared/SearchBar.jsx`
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/components/NotifCenter.jsx`

### Table.jsx

- [ ] **Step 1: Replace hover tint + pagination bg** — three changes in Table.jsx:

Row hover (line ~40):
```jsx
// Before:
onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
// After:
onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-tint)' }}
```

Pagination button accent hover (line ~68):
```jsx
// Before:
onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'rgba(56,189,248,0.06)' }}
// After:
onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'var(--accent-glow)' }}
```

Pagination button mouseleave (line ~69):
```jsx
// Before:
onMouseLeave={e => { e.currentTarget.style.background = '#27272a' }}
// After:
onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-overlay)' }}
```

### Modal.jsx

- [ ] **Step 2: Replace backdrop and shadow** in Modal.jsx:

```jsx
// Before (backdrop div style):
style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
// After:
style={{ background: 'var(--modal-backdrop)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
```

```jsx
// Before (panel boxShadow):
boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
// After:
boxShadow: 'var(--modal-shadow)',
```

```jsx
// Before (close button hover):
onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
// After:
onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-tint-md)' }}
```

### Field.jsx

- [ ] **Step 3: Replace focus colour** in Field.jsx:

```jsx
// Before (onFocus):
onFocus: e => { e.target.style.borderColor = '#38bdf8'; e.target.style.boxShadow = '0 0 0 3px rgba(56,189,248,0.10)' },
// After:
onFocus: e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' },
```

Also fix the submit button text color (hardcoded `#09090b`):
```jsx
// Before:
style={{ background: '#38bdf8', color: '#09090b', border: 'none', borderRadius: 'var(--radius)', ...extStyle }}
// After:
style={{ background: 'var(--accent)', color: 'var(--badge-text)', border: 'none', borderRadius: 'var(--radius)', ...extStyle }}
```

### SearchBar.jsx

- [ ] **Step 4: Replace focus colour** in SearchBar.jsx:

```jsx
// Before:
onFocus={e => { e.target.style.borderColor = '#38bdf8'; e.target.style.boxShadow = '0 0 0 3px rgba(56,189,248,0.10)' }}
// After:
onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
```

### Sidebar.jsx

- [ ] **Step 5: Replace hover tints and badge text** in Sidebar.jsx:

Nav button hover (line ~63):
```jsx
// Before:
onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text-1)' } }}
onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)' } }}
// After:
onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--hover-tint)'; e.currentTarget.style.color = 'var(--text-1)' } }}
onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)' } }}
```

Badge text on nav (both desktop ~line 71 and mobile ~line 147):
```jsx
// Before:
color: '#09090b',
// After:
color: 'var(--badge-text)',
```

Mobile menu button hover (line ~114):
```jsx
// Before:
onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
// After:
onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-tint)' }}
```

Active nav border — also replace the hardcoded rgba value (line ~60):
```jsx
// Before:
border: isActive ? '1px solid rgba(56,189,248,0.12)' : '1px solid transparent',
// After:
border: isActive ? '1px solid var(--accent-dim)' : '1px solid transparent',
```

### NotifCenter.jsx

- [ ] **Step 6: Replace hover tints, badge text, and panel shadow** in NotifCenter.jsx:

NotifRow hover (line ~24-25):
```jsx
// Before:
onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
// After:
onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-tint)' }}
```

Bell button hover (line ~177):
```jsx
// Before:
e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
// After:
e.currentTarget.style.background = 'var(--hover-tint)'
```

Badge text on bell (line ~189):
```jsx
// Before:
background: 'var(--accent)', color: '#09090b',
// After:
background: 'var(--accent)', color: 'var(--badge-text)',
```

Panel shadow (line ~212):
```jsx
// Before:
boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
// After:
boxShadow: 'var(--panel-shadow)',
```

---

## Task 5: Chart theme utility + Dashboard + Combustible + Finanzas

**Files:**
- Create: `src/utils/chartTheme.js`
- Modify: `src/modules/Dashboard.jsx`
- Modify: `src/modules/Combustible.jsx`
- Modify: `src/modules/Finanzas.jsx`

### chartTheme.js

- [ ] **Step 1: Create `src/utils/chartTheme.js`:**

```js
import { useTheme } from '../context/ThemeContext'

export function useChartTheme() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  return {
    tickColor:  isDark ? '#94a3b8' : '#64748b',
    gridColor:  isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    cursorFill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
    tooltip: {
      contentStyle: {
        background:   isDark ? '#27272a' : '#ffffff',
        border:       `1px solid ${isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.10)'}`,
        borderRadius: 8,
        color:        isDark ? '#f1f5f9' : '#0f172a',
        fontSize:     12,
        boxShadow:    isDark ? '0 8px 32px rgba(0,0,0,0.60)' : '0 8px 32px rgba(0,0,0,0.12)',
      },
      labelStyle: {
        color:    isDark ? '#94a3b8' : '#64748b',
        fontSize: 10,
      },
    },
  }
}
```

### Dashboard.jsx

- [ ] **Step 2: Update Dashboard.jsx imports and chart usage.**

Add import at the top of the file:
```jsx
import { useChartTheme } from '../utils/chartTheme'
```

At the top of the `Dashboard` component body (and inside `DarkTooltip`), call the hook:
```jsx
// Inside the Dashboard component:
const ct = useChartTheme()
```

Remove the standalone `DarkTooltip` component that has a hardcoded `#27272a` style, and replace with the inline Recharts `<Tooltip>` configuration using `ct.tooltip`. The `DarkTooltip` function near the top of Dashboard.jsx renders a custom tooltip with hardcoded colors — replace it:

```jsx
// REMOVE the DarkTooltip function entirely.

// In the BarChart, replace:
//   <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
// With:
<Tooltip
  {...ct.tooltip}
  cursor={{ fill: ct.cursorFill }}
/>
```

Replace all chart `tick={{ fill: '#94a3b8', ... }}` with `tick={{ fill: ct.tickColor, ... }}`.

Replace all `<CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" ... />` with `<CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} ... />`.

Replace the inline Tooltip contentStyle and labelStyle in PieChart:
```jsx
// Before:
contentStyle={{ background: '#27272a', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 8, color: '#f1f5f9', fontSize: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
labelStyle={{ color: '#94a3b8', fontSize: 10 }}
// After:
{...ct.tooltip}
```

Also fix the hardcoded `#94a3b8` Legend styles — replace:
```jsx
wrapperStyle={{ color: '#94a3b8', fontSize: 11, fontWeight: 600 }}
// with:
wrapperStyle={{ color: 'var(--chart-tick)', fontSize: 11, fontWeight: 600 }}
```
(CSS variables work in JS style objects since they're standard `style` props on DOM elements.)

Fix the header section hardcoded colors (lines ~170-173). Replace hardcoded `color: '#f1f5f9'` and `color: '#94a3b8'` with `var(--text-1)` and `var(--text-2)` respectively throughout the component.

### Combustible.jsx

- [ ] **Step 3: Update Combustible.jsx.**

Add import:
```jsx
import { useChartTheme } from '../utils/chartTheme'
```

Call inside component:
```jsx
const ct = useChartTheme()
```

Replace the `TOOLTIP_STYLE` constant near the top:
```jsx
// REMOVE:
const TOOLTIP_STYLE = {
  contentStyle: { background: '#27272a', border: '1px solid rgba(255,255,255,0.13)', ... },
  labelStyle: { color: '#94a3b8' },
  itemStyle:  { color: '#94a3b8' },
}

// Replace usages of TOOLTIP_STYLE spread with:
{...ct.tooltip}
```

Replace `stroke="rgba(255,255,255,0.06)"` on CartesianGrid:
```jsx
stroke={ct.gridColor}
```

Replace `tick={{ fill: '#94a3b8', ... }}`:
```jsx
tick={{ fill: ct.tickColor, fontSize: 11, fontFamily: MONO }}
```

Table row hover (line ~250):
```jsx
// Before:
onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
// After:
onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-tint)' }}
```

Table header row hardcoded border (line ~234):
```jsx
// Before:
style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'var(--bg-base)' }}
// After (border is already --border value, just use token):
style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-base)' }}
```

Table row border (line ~249):
```jsx
// Before:
style={{ borderTop: '1px solid rgba(255,255,255,0.07)', ... }}
// After:
style={{ borderTop: '1px solid var(--border)', ... }}
```

Delete button hover (line ~278):
```jsx
// Before:
onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.10)' }}
// After:
onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-dim)' }}
```

### Finanzas.jsx

- [ ] **Step 4: Update Finanzas.jsx.**

Add import and call `useChartTheme()` in component body (same pattern as above).

Tab hover (line ~265):
```jsx
// Before:
onMouseEnter={e => { if (tab !== val) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; ... } }}
// After:
onMouseEnter={e => { if (tab !== val) { e.currentTarget.style.background = 'var(--hover-tint)'; ... } }}
```

Delete button hover (line ~185):
```jsx
onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-dim)' }}
```

Update any chart components in Finanzas using the same tick/grid/tooltip pattern from chartTheme (read the file to identify exact lines).

---

## Task 6: Fix remaining modules

**Files:**
- Modify: `src/modules/Mantenimiento.jsx`
- Modify: `src/modules/Marketing.jsx`
- Modify: `src/modules/Nomina.jsx`
- Modify: `src/modules/Contactos.jsx`
- Modify: `src/modules/Backup.jsx`

### Mantenimiento.jsx, Marketing.jsx, Nomina.jsx

Each of these follows the same pattern — replace hover tint and danger hover:

- [ ] **Step 1: Mantenimiento.jsx** — two changes:

```jsx
// Delete row hover (line ~98-99):
// Before:
style={{ color: '#F87171' }}
onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.10)' }}
// After:
style={{ color: 'var(--danger)' }}
onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-dim)' }}
```

- [ ] **Step 2: Marketing.jsx** — two changes (same pattern as Mantenimiento):

```jsx
// Row hover (line ~97):
onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-tint-md)'; ... }}

// Delete hover (line ~105-106):
style={{ color: 'var(--danger)' }}
onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-dim)' }}
```

- [ ] **Step 3: Nomina.jsx** — one change:

```jsx
// Delete hover (line ~78-79):
style={{ color: 'var(--danger)' }}
onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-dim)' }}
```

### Contactos.jsx

- [ ] **Step 4: Replace old-style hardcoded palette in Contactos.jsx.** Read the file, then replace:

```jsx
// Icon wrapper (line ~80-81):
// Before:
style={{ background: 'rgba(74,143,212,0.2)' }}
<Users size={20} style={{ color: '#4A8FD4' }} />
// After:
style={{ background: 'var(--accent-dim)' }}
<Users size={20} style={{ color: 'var(--accent)' }} />
```

```jsx
// New button (line ~88):
// Before:
style={{ background: '#4A8FD4' }}
// After:
style={{ background: 'var(--accent)', color: 'var(--badge-text)' }}
```

```jsx
// Table container (line ~93):
// Before:
style={{ background: '#1E1E2E', border: '1px solid #2E2E42' }}
// After:
style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
```

```jsx
// Filter select (line ~97):
// Before:
style={{ background: '#252535', border: '1px solid #2E2E42' }}
// After:
style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
```

```jsx
// Save button (line ~141):
// Before:
style={{ background: '#4A8FD4' }}
// After:
style={{ background: 'var(--accent)', color: 'var(--badge-text)' }}
```

### Backup.jsx

- [ ] **Step 5: Replace hardcoded light-only palette in Backup.jsx.** The entire `btnBase` style object and hover handlers use light-mode colors — replace all with tokens:

```jsx
// Replace btnBase:
const btnBase = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '5px 12px',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
  border: '1px solid var(--border)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-2)',
  transition: 'background 0.15s',
}
```

```jsx
// Replace hover handlers:
onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-tint-md)' }}
onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
```

The status badges (`#16A34A`, `#DC2626`) are acceptable semantic values but should use tokens:
```jsx
// Before:
? { background: 'rgba(34,197,94,0.1)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.2)' }
: { background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.2)' }
// After:
? { background: 'var(--positive-dim)', color: 'var(--positive)', border: '1px solid var(--positive-dim)' }
: { background: 'var(--danger-dim)',   color: 'var(--danger)',   border: '1px solid var(--danger-dim)'   }
```

---

## Task 7: Final verification across all modules

- [ ] **Step 1: Launch dev server** — `cd C:\vanderbus-app\vanderbus && npx vite`

- [ ] **Step 2: Dark mode checklist** — toggle to dark and verify each module:
  - [ ] Dashboard: charts, KPI cards, quick actions all legible
  - [ ] Combustible: chart ticks visible, tooltip styled, table rows hover correctly
  - [ ] Finanzas: tab selector, chart, balance card
  - [ ] Mantenimiento, Marketing, Nomina: status badges, delete button hover
  - [ ] Contactos: accent buttons and table background correct
  - [ ] Backup: buttons match dark theme
  - [ ] NotifCenter: panel shadow, badge, hover rows
  - [ ] Modals: backdrop and shadow
  - [ ] Toasts: `.surface` class renders correctly

- [ ] **Step 3: Light mode checklist** — toggle to light and verify:
  - [ ] Body background is warm off-white (#f7f8fa), not pure white or grey
  - [ ] Cards/panels: white on elevated grey — clear depth
  - [ ] `.mod-h1` gradients render dark (not invisible white text)
  - [ ] `.mod-sub` text is readable
  - [ ] `.glass-btn-primary` renders with sky-600 accent, legible
  - [ ] All charts: tick labels visible (dark on light), grid lines subtle
  - [ ] Chart tooltips: white bg, dark text, light shadow
  - [ ] Accent buttons: sky-600 (#0284c7), white badge text
  - [ ] Status chips: emerald/red/amber — all WCAG-legible on white
  - [ ] Leaflet map: light background, white popup
  - [ ] No `rgba(255,255,255,…)` hovering remaining in light mode

- [ ] **Step 4: No-flash verification** — in light mode, hard-refresh (Ctrl+Shift+R) and confirm no dark flash before paint.

- [ ] **Step 5: Notify user** — `powershell -c "[console]::beep(1000,500)"`

---

## Self-review: Spec coverage

| Requirement | Covered by |
|-------------|-----------|
| Audit existing design tokens | Task 1 notes + File Map |
| Tokenize hardcoded colors | Tasks 1, 4, 5, 6 |
| Light mode palette (premium, not inverted) | Task 1 Step 2 — full palette with WCAG-aware values |
| Sun/Moon toggle in nav | Task 2 ThemeToggle + Task 3 App.jsx |
| Smooth transition on switch | Task 1 `.theme-transitioning` + Task 2 toggleTheme |
| Persist preference (localStorage) | Task 2 ThemeContext + Task 3 index.html anti-flash |
| No flash on load | Task 3 inline script in index.html |
| All modules verified | Task 7 checklist |
| Leaflet / GPS module | Task 1 Step 8 |
| Toasts | ToastContainer uses `.surface` + CSS-var tokens — no changes needed |
| Dashboard (Recharts) | Task 5 |
| Oportunidades / Viajes | These modules use `var(--…)` tokens and `--hover-tint` patterns already covered by Task 4 shared components; spot-check in Task 7 |
