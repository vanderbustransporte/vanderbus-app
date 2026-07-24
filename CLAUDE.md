# Vanderbus App

## Skill principal — leer SIEMPRE antes de trabajar
Always read and apply the skill at .claude/skills/vanderbus-app.md before making any changes.
This skill contains the complete architecture, conventions, data model, and roadmap of the project.

## Trabajo compartido
Este repo lo tocan dos personas en paralelo. Antes de commitear leer `CONTRIBUTING.md`:
ramas cortas desde `main`, PR con review, **nunca commitear directo a `main`**.
El estado compartido (migraciones pendientes de aplicar, quién está tocando qué)
está en `docs/estado-proyecto.md` — actualizarlo es parte de terminar la tarea.

## Reglas generales
- El backend Express (server/) está JUBILADO. No reactivarlo. El frontend habla directo a Supabase.
- Nunca meter la service_role key de Supabase en el frontend.
- RLS está activo en Supabase. No desactivarlo.
- Los IDs se generan con genId() de src/utils/format.js (excepto vehiculos que usan crypto.randomUUID()).
- Las fechas van siempre en formato ISO YYYY-MM-DD. Usar todayISO() de src/utils/fecha.js.
- Los montos se guardan como strings en la base (legado). Parsear con parseFloat(r.importe) || 0.
- Para permisos usar useAuth() → puedeVer('seccion') y puedeEditar('seccion').
- Para datos usar useStore() → data.tabla y update('tabla', nuevoArray).
