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

La base es productiva y única. El código está mergeado; la migración puede no
estarlo. Confirmar con Nico antes de asumir que una columna existe.

| Migración | ¿Aplicada en Supabase? |
|---|---|
| `20260718120000_viajes_despacho.sql` | Sí |
| `20260718130000_choferes.sql` | Sí |
| `20260722120000_tracking_publico.sql` | Sí |
| `20260722130000_tracking_publico_org_fix.sql` | **Confirmar** |
| `20260722140000_combustible_vales.sql` | **Confirmar** |

Las dos últimas se escribieron el 2026-07-22 y no hay registro de que se hayan
aplicado. La de `tracking_publico_org_fix` **no es opcional**: cierra una fuga de
datos entre organizaciones en el link público de seguimiento (detalle en
`docs/auditoria-produccion-2026-07-22.md`).

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
