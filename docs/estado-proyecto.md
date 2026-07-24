# Estado del proyecto

Documento vivo. **Actualizarlo es parte de terminar una tarea**, no un extra.
Última actualización: 2026-07-24.

---

## Quién está en qué

| Persona | Área que está tocando | Rama | Desde |
|---|---|---|---|
| Diego | Notificaciones (todo a la campana, baja de la sección) | `notificaciones/centro-campana` | 2026-07-24 |
| Diego | Estimador de consumo de combustible por viaje | `combustible/estimador-consumo` | 2026-07-24 |
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

Al 2026-07-24 estaban todas aplicadas (despacho, choferes, tracking público,
tracking público org fix, vales de combustible). Después de eso se sumaron tres,
todas del estimador de consumo y **todas pendientes**. Se aplican en orden:

| Migración | ¿Aplicada? | Qué prende |
|---|---|---|
| `20260724120000_consumo_estimado.sql` | ❌ **NO** | Estimador base: consumo urbano/ruta, tara, carga útil, distancia y tipo de recorrido del viaje |
| `20260724130000_consumo_ficha_extendida.sql` | ❌ **NO** | Ficha técnica completa (clase, motor, fuente del consumo, PBT, carrocería, tanque, ralentí), topografía y horas de ralentí del viaje, y `combustible.tanque_lleno` (el insumo del motor de calibración) |
| `20260724140000_vehiculo_docs.sql` | ❌ **NO** | Tabla `vehiculo_docs` + bucket privado `vehiculo-docs`: subir y consultar el manual / ficha técnica de cada unidad |

Cada una se detecta por separado y la app tolera cualquier combinación: sin
ninguna funciona exactamente como hoy, con la primera sola estima igual que
antes, y así. Lo que falta se oculta solo y **no se manda al guardar** — mandar
una columna inexistente haría fallar el guardado entero (`consumoDisponible()` /
`fichaExtDisponible()` en `src/utils/consumo.js`, `docsDisponible()` en
`src/utils/docsVehiculo.js`). Aplicarlas es lo único que hace falta: no hay que
tocar código.

**Edge Function `extraer-ficha-tecnica`** (lectura asistida del PDF): además de
la migración `...140000`, hay que
1. cargar el secreto: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref <ref>`
2. desplegarla: `supabase functions deploy extraer-ficha-tecnica --project-ref <ref>`

Sin eso el botón “Leer datos” devuelve un error legible y todo lo demás anda
igual. La lógica pura (qué páginas se mandan al modelo, qué valores se aceptan)
se prueba sin desplegar nada y sin gastar una llamada a la API:
`node --experimental-strip-types supabase/checks/extraccion_ficha_check.mjs`.

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
  adjuntar remitos/fotos a un **viaje**. El patrón de Storage ya está resuelto y
  probado en `vehiculo-docs` (bucket privado particionado por empresa + RLS sobre
  `storage.objects`, migración `20260724140000`): copiarlo.
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
