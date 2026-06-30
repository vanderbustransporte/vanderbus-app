# Tarea para Claude Code — Setup inicial del repositorio para Diego

Hacé estas dos cosas, en orden:

## 1) Actualizar CLAUDE.md (reemplazar completamente)

Reemplazá el contenido de `CLAUDE.md` con esto:

```markdown
# Vanderbus App

## Skill principal — leer SIEMPRE antes de trabajar
Always read and apply the skill at .claude/skills/vanderbus-app.md before making any changes.
This skill contains the complete architecture, conventions, data model, and roadmap of the project.

## Reglas generales
- El backend Express (server/) está JUBILADO. No reactivarlo. El frontend habla directo a Supabase.
- Nunca meter la service_role key de Supabase en el frontend.
- RLS está activo en Supabase. No desactivarlo.
- Los IDs se generan con genId() de src/utils/format.js (excepto vehiculos que usan crypto.randomUUID()).
- Las fechas van siempre en formato ISO YYYY-MM-DD. Usar todayISO() de src/utils/fecha.js.
- Los montos se guardan como strings en la base (legado). Parsear con parseFloat(r.importe) || 0.
- Para permisos usar useAuth() → puedeVer('seccion') y puedeEditar('seccion').
- Para datos usar useStore() → data.tabla y update('tabla', nuevoArray).
```

## 2) Instalar la skill en .claude/skills/

Creá el archivo `.claude/skills/vanderbus-app.md` con el contenido del archivo `vanderbus-skill.md` que está en el mismo directorio donde se encuentra este prompt.

Si el directorio `.claude/skills/` no existe, crearlo.

---

No toques nada más. Cuando termines avisame qué archivos creaste/modificaste.
