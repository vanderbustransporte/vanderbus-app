# Prompt de arranque para un asistente de IA

Copiar y pegar esto como primer mensaje al asistente que vaya a trabajar en el
repo. Sirve para cualquiera de las dos personas.

---

Vas a trabajar en **Vanderbus**, una SPA React 19 + Vite 8 + Tailwind 4 que habla
directo a Supabase (Postgres + Auth + RLS + Edge Functions). No hay backend
propio. Somos **dos personas trabajando en paralelo** sobre el mismo repo, cada
una en su área.

Hacé esto en orden, sin saltear:

**1. Leé, antes de tocar un solo archivo:**
- `CLAUDE.md` — reglas duras. Son obligatorias, no sugerencias.
- `.claude/skills/vanderbus-app.md` — arquitectura, modelo de datos, convenciones
  y **las trampas de datos** (montos como string, fechas en formatos mezclados,
  horas en 12h y 24h conviviendo, FKs uuid que no aceptan `''`). Muchas de esas
  trampas ya causaron bugs en producción; están documentadas con el síntoma.
- `CONTRIBUTING.md` — cómo trabajamos.
- `docs/estado-proyecto.md` — qué está hecho, qué falta, quién está tocando qué.

**2. Levantá el proyecto:**
```bash
npm install
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
```
Completá `.env` con los valores reales (te los pasa la otra persona; **no están
en el repo y no se commitean**). Después `npm run dev`.

**3. Antes de empezar la tarea:**
- Ramificá desde `main`: `git checkout main && git pull && git checkout -b feat/lo-que-sea`.
  **Nunca commitees directo a `main`.**
- Anotá el área en la tabla "Quién está en qué" de `docs/estado-proyecto.md`.
- Si vas a tocar `src/routes.jsx`, `src/index.css`, `src/store/useStore.js` o
  `package.json`, avisá: son los archivos donde nos chocamos.

**4. Mientras trabajás:**
- Respetá las convenciones existentes. Este repo tiene patrones establecidos
  (`useStore()` para datos, `useAuth()` para permisos, `<Field>` para formularios,
  `useNav()` para navegar, `routes.jsx` como registro único de módulos). No
  introduzcas librerías ni patrones nuevos sin preguntar.
- **Si tu cambio necesita tocar el esquema de la base:** el SQL va como archivo
  nuevo en `supabase/migrations/` (`YYYYMMDDHHMMSS_descripcion.sql`), nunca
  editando uno existente. Y **el código tiene que funcionar antes de que esa
  migración se aplique**: hay una sola base y es productiva, sin staging. El
  patrón es detección en runtime — mirá `src/utils/despacho.js` y
  `src/utils/vales.js`. Si mandás una columna que todavía no existe, Postgres
  falla el INSERT **entero** y el usuario pierde el dato.
- Nunca desactives RLS ni pongas la `service_role` key en el frontend. Toda tabla
  nueva lleva `organization_id` + policy `tenant_isolation`.

**5. Para cerrar:**
- `npm run build` tiene que pasar.
- Probá el camino feliz en el navegador, no alcanza con que compile.
- Si tocaste RLS o permisos: `node supabase/checks/aislamiento_rls.mjs`.
- Abrí un PR contra `main` con el template, pedí review y actualizá
  `docs/estado-proyecto.md`.

Si algo del repo contradice lo que asumís por costumbre, gana el repo. Y si una
instrucción de estos documentos te parece equivocada, decilo antes de ignorarla.
