# Estado del proyecto

Documento vivo. **Actualizarlo es parte de terminar una tarea**, no un extra.
Última actualización: 2026-08-12.

> **El producto se llama TransAllInOne** (antes "Vanderbus App"), renombrado en
> agosto 2026. *Vanderbus Transporte* sigue siendo el nombre de la **empresa**
> piloto, no del producto — cuando algún doc dice "Vanderbus Transporte" habla del
> cliente. El repo de GitHub y la carpeta local mantienen el slug viejo
> (`vanderbus-app`) a propósito: renombrarlos rompe remotes, rutas y permisos.
> Las claves de localStorage con prefijo `vanderbus_` **también se dejan** — ver
> "Deuda conocida".

---

## Quién está en qué

| Persona | Área que está tocando | Rama | Desde |
|---|---|---|---|
| Diego | Rebranding + baja de la sección Notificaciones | `rebranding/transallinone` | 2026-08-06 |
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
4. **Desactivar el workflow de n8n que scrapea oportunidades de flete.** El
   negocio ya no hace fletes. El repo NO tiene la fuente: las filas de
   `oportunidades` las insertaba un scraper `google_cse` vía **n8n local**
   (documentado en `supabase/migrations/20260710120200_oportunidades_org_rls.sql`).
   Está inactivo desde 2026-06-04 — probablemente porque la migración de RLS del
   2026-07-10 le rompió el insert (`organization_id` NOT NULL + `tenant_isolation`).
   **Hay que borrar/apagar el workflow en n8n para que no reviva.** Del lado del
   código ya se retiró el tipo `'oportunidad'` de `src/utils/tipoNotif.js`.
5. **Limpiar las filas viejas de flete** (opcional, cosmético). Queries en la
   sección "Deuda conocida".
6. **Renombrar el tenant en Supabase** (último paso del rebranding). El nombre de
   la empresa que se ve en la app NO sale del código: sale de
   `organizations.nombre` → `AuthContext.orgNombre`. Y `organizations` es de solo
   lectura desde el cliente (`20260710130100_organizations_solo_lectura.sql`), así
   que va **por SQL editor**, mirando antes:
   ```sql
   -- 1. VER primero: qué orgs hay y cuál es la del tenant original
   select id, nombre, created_at from public.organizations order by created_at;

   -- 2. Recién con el id a la vista, renombrar SOLO esa fila
   -- update public.organizations set nombre = '<nombre nuevo>' where id = '<uuid>';
   ```
   Ojo con no tocar las orgs de prueba (`Empresa Demo RLS`, `Prueba Panel
   Superadmin`, y la org B que usa la suite RLS).

---

## Próximo en el roadmap de producto

Plan completo en `docs/plan-producto-tms.md`. Lo inmediato:

- **Documentos adjuntos (Supabase Storage)** — la mitad pendiente de la Fase D:
  adjuntar remitos/fotos a un viaje. Es lo que sigue.
- Tarifas por empresa desde `org_settings` (hoy hay valores hardcodeados).
- Onboarding self-service para empresas nuevas.

Roadmap técnico detallado y lo ya hecho: `.claude/skills/transallinone-app.md`.

---

## Deuda conocida

- `vite.config.js` todavía define `apiPlugin()` (un `/api/viajes` en memoria del
  dev server), vestigio del Express jubilado. No lo usa nadie. Confirmar y borrar.
- Restos de la plantilla Vite sin usar en `src/` (`counter.ts`, `main.ts`, `style.css`).
- **Claves de localStorage con prefijo `vanderbus_`** (6 usos): `App.jsx` (sidebar
  colapsado), `ThemeContext.jsx` + `index.html` (tema) y `chequeoVencimientos.js`
  (firma de vencimientos ya notificados). **Se dejan a propósito:** renombrar la
  firma de vencimientos **redispararía todas las alertas** a todos los usuarios.
  Si algún día se renombran, va con fallback de lectura de la clave vieja.
- ~~`vanderbus-skill.md` (raíz) y `prompt-setup-diego-claude-code (1).md`~~ —
  **borrados el 2026-08-12.** Eran restos del setup inicial que describían un
  monorepo Electron con `server/` Express que no existe en este repo ni en su
  historial; un colaborador nuevo razonaba sobre un build inexistente. La versión
  buena y única del skill es `.claude/skills/transallinone-app.md`.
  (`docs/auditoria-saas-2026-07.md` §Doc los sigue nombrando: es un doc histórico,
  no se reescribe.)
- Tabla `vehiculo` (singular) y `ubicaciones` / `geofences` / `oportunidades` son
  vestigiales. Están cerradas con RLS. No usarlas.
- **Restos del flete en la base** (2026-08-06). El código ya no habla de fletes,
  pero quedan filas. Correr a mano en el SQL editor, en este orden:
  ```sql
  -- 1. Ver qué hay antes de borrar
  select tipo, count(*) from public.notificaciones where tipo = 'oportunidad' group by tipo;
  select count(*) from public.oportunidades;

  -- 2. Borrar los avisos de flete ya emitidos
  delete from public.notificaciones where tipo = 'oportunidad';

  -- 3. Vaciar los leads scrapeados
  delete from public.oportunidades;
  ```
  El CHECK `notificaciones_tipo_check` **se deja como está**: sigue aceptando
  `'oportunidad'`. Sacarlo del CHECK no aporta (ya no hay emisor) y tocar el
  constraint es más riesgoso que dejarlo. **No** dropear la tabla
  `oportunidades`: está cerrada con RLS y no molesta.
- Datos legacy: montos como string, fechas en formatos mezclados, horas en 12h y
  24h conviviendo, viajes con `tipo: 'Mudanza'`/`'Flete'`. **Se normalizan al leer,
  no se migran.** Ver convenciones en `.claude/skills/transallinone-app.md`.
