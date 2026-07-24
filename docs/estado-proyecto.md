# Estado del proyecto

Documento vivo. **Actualizarlo es parte de terminar una tarea**, no un extra.
Última actualización: 2026-07-24.

---

## Quién está en qué

| Persona | Área que está tocando | Rama | Desde |
|---|---|---|---|
| Diego | — | — | — |
| Nico | — | — | — |

> Completar antes de empezar a trabajar. Es el mecanismo barato para no pisarnos
> (ver sección 7 de `CONTRIBUTING.md`).

---

## Dónde está el código

- `main` es el tronco y está al día: el 2026-07-24 se mergeó `redesign/fase-1`
  completa (13 commits: router + deep links, command palette, Finanzas, despacho,
  choferes, estados vacíos, tracking público, vales de combustible).
- La rama `redesign/fase-1` quedó igual que `main`. **No trabajar más sobre ella:**
  ramas nuevas salen de `main`.

---

## Migraciones — estado de aplicación

La base es productiva y única. El código puede estar mergeado antes de que la
migración esté aplicada: por eso el código tiene que tolerar el esquema viejo
(ver `CONTRIBUTING.md` §5).

**Al 2026-07-24 no hay migraciones pendientes: todas las de `supabase/migrations/`
están aplicadas.** Las últimas cinco (despacho, choferes, tracking público,
tracking público org fix, vales de combustible) se confirmaron aplicadas ese día.

Cuando se sume una migración nueva, anotarla acá con estado hasta que se aplique:

| Migración | ¿Aplicada en Supabase? |
|---|---|
| — | — |

---

## Pendientes que no dependen del código

1. **Repo público → privado.** `vanderbustransporte/vanderbus-app` es público hoy.
   Solo lo puede cambiar la cuenta owner (`vanderbustransporte`), cuyo mail
   administra Nico. La cuenta de Diego (`montanarodiego`) tiene push pero no admin.
2. **Rotar la anon key de Supabase.** Estuvo expuesta en un repo público. Rotarla
   implica actualizar el `.env` de cada persona y cualquier automatización de n8n
   que la use. Hacerlo *después* de pasar el repo a privado.
3. **Dar acceso de colaborador a la otra persona** en el repo (Settings →
   Collaborators), también desde la cuenta owner.

---

## Próximo en el roadmap de producto

Plan completo en `docs/plan-producto-tms.md`. Lo inmediato:

- **Documentos adjuntos (Supabase Storage)** — la mitad pendiente de la Fase D:
  adjuntar remitos/fotos a un viaje. Es lo que sigue.
- Tarifas por empresa desde `org_settings` (hoy hay valores hardcodeados).
- Onboarding self-service para empresas nuevas.

Roadmap técnico detallado y lo ya hecho: `.claude/skills/vanderbus-app.md`.

---

## Deuda conocida

- `vite.config.js` todavía define `apiPlugin()` (un `/api/viajes` en memoria del
  dev server), vestigio del Express jubilado. No lo usa nadie. Confirmar y borrar.
- Restos de la plantilla Vite sin usar en `src/` (`counter.ts`, `main.ts`, `style.css`).
- Tabla `vehiculo` (singular) y `ubicaciones` / `geofences` / `oportunidades` son
  vestigiales. Están cerradas con RLS. No usarlas.
- Datos legacy: montos como string, fechas en formatos mezclados, horas en 12h y
  24h conviviendo, viajes con `tipo: 'Mudanza'`/`'Flete'`. **Se normalizan al leer,
  no se migran.** Ver convenciones en `.claude/skills/vanderbus-app.md`.
