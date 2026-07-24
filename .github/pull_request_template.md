## Qué hace

<!-- Una o dos frases. Si arregla un bug, cuál era el síntoma. -->

## Por qué

<!-- El contexto que no se ve en el diff. -->

## Cómo lo probé

<!-- No alcanza con "compila". Qué camino recorriste en el navegador. -->

- [ ] `npm run build` pasa
- [ ] Probado en el navegador (`npm run dev`)

## Base de datos

- [ ] No toca el esquema
- [ ] Incluye migración en `supabase/migrations/` — **avisada por chat y anotada en `docs/estado-proyecto.md`**
- [ ] El código funciona con la migración **sin aplicar** (detección en runtime, ver `CONTRIBUTING.md` §5)

## Multi-tenancy / seguridad

- [ ] No aplica
- [ ] Tabla nueva con `organization_id` + policy `tenant_isolation`
- [ ] Corrí `node supabase/checks/aislamiento_rls.mjs`

## Archivos calientes

<!-- Marcar si tocaste alguno; la otra persona puede tener conflictos. -->

- [ ] `src/routes.jsx`
- [ ] `src/index.css`
- [ ] `src/store/useStore.js`
- [ ] `package.json` / `package-lock.json` (la otra persona tiene que correr `npm install`)
