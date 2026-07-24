# Cómo trabajamos en Vanderbus

Este documento es el contrato de trabajo entre las personas que tocan este repo.
Si algo acá contradice lo que hacías antes, gana este documento.

- **Arquitectura, modelo de datos y convenciones de código:** `.claude/skills/vanderbus-app.md` (leerlo antes de tocar nada).
- **Reglas duras para agentes de IA:** `CLAUDE.md`.
- **Estado actual y quién está en qué:** `docs/estado-proyecto.md`.

---

## 1. Setup desde cero

Requisitos: Node 20+ y Git.

```bash
git clone https://github.com/vanderbustransporte/vanderbus-app.git
cd vanderbus-app
npm install
cp .env.example .env      # en PowerShell: Copy-Item .env.example .env
```

Completar `.env` con los valores reales (pedírselos a quien ya los tenga — **no se
versionan y no se mandan por canales públicos**). Sin `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY` la app tira un error explícito al arrancar, a propósito.

```bash
npm run dev     # http://localhost:5173 (si está ocupado, Vite salta al 5174)
npm run build   # tiene que pasar antes de abrir un PR
```

No hay backend que levantar. El frontend habla directo a Supabase.

---

## 2. Ramas

`main` es el tronco y siempre tiene que buildear. **No se commitea directo a `main`.**

```bash
git checkout main
git pull
git checkout -b feat/finanzas-export-pdf
```

Nomenclatura: `feat/…`, `fix/…`, `chore/…`, `docs/…` + un slug corto en kebab-case.

**Ramas cortas.** Una rama que vive más de 2 o 3 días contra un repo con dos
personas activas termina en un merge doloroso. Si una feature es grande, partila
en pedazos que se puedan mergear solos (así se hicieron las fases B/C/D del plan
de producto).

Antes de abrir el PR, traer `main` encima:

```bash
git fetch origin
git rebase origin/main      # o merge, pero rebase mantiene el historial legible
npm run build
```

---

## 3. Commits

Formato: `tipo(alcance): descripción en minúscula y en presente`.

```
feat(viajes): filtro por chofer en la grilla
fix(gps): el mapa no centraba con un solo punto
chore(repo): actualizar dependencias
```

El cuerpo del commit es para el **porqué**, no para el qué (el diff ya dice el qué).
Los bugs sutiles de este proyecto (fechas UTC, uuid `''`, horas mezcladas) se
entienden meses después solo si el commit explicó el síntoma.

---

## 4. Pull requests

Todo cambio entra por PR contra `main`, incluso los chicos.

- Descripción según `.github/pull_request_template.md`.
- El check de build de GitHub Actions tiene que estar en verde.
- **Se pide review a la otra persona.** No es burocracia: es el único mecanismo
  que tenemos para que los dos sepamos qué pasó en el repo. Si el cambio es
  urgente y la otra persona no está, se mergea y se avisa por chat, pero se avisa.
- Mergear con **Squash and merge** salvo que los commits individuales valgan la
  pena por separado.
- Borrar la rama después de mergear.

---

## 5. Migraciones de base de datos — LA PARTE DELICADA

La base es **una sola y es productiva**. No hay ambiente de staging. Esto tiene
dos consecuencias que no son negociables:

**a) El SQL se versiona siempre.** Todo cambio de esquema va como archivo nuevo en
`supabase/migrations/` con el formato `YYYYMMDDHHMMSS_descripcion.sql`. Nunca se
edita una migración ya aplicada: se escribe una nueva encima.

**b) El código tiene que funcionar ANTES de que la migración esté aplicada.**
Quien escribe el SQL no siempre es quien lo aplica en Supabase, así que entre el
merge del código y la aplicación de la migración hay una ventana donde la app
corre contra un esquema viejo. Si el código asume la columna nueva, la app se
rompe en producción durante esa ventana.

El patrón ya establecido en el repo es **detección en runtime** (ver
`src/utils/despacho.js` y `src/utils/choferes.js`):

- Se hace un `select` de prueba contra la columna/tabla nueva, con la promesa cacheada.
- Error `42703` = columna inexistente. Error `42P01` = tabla inexistente.
- Si no está aplicada: se oculta la UI nueva y **se sacan esos campos del payload
  al guardar** (mandar una columna que no existe hace fallar el INSERT entero, no
  solo ese campo).

Cuando abras un PR con migración, decilo en la descripción y avisá por chat.
Anotá la migración pendiente en `docs/estado-proyecto.md` hasta que esté aplicada.

**Nunca:** desactivar RLS, poner la `service_role` key en el frontend, o crear una
tabla sin `organization_id` + `tenant_isolation`.

---

## 6. Verificación antes de mergear

Mínimo obligatorio:

1. `npm run build` pasa.
2. Probaste el camino feliz en el navegador (`npm run dev`), no solo que compile.

Si el cambio toca RLS, permisos o multi-tenancy, corré además los checks de
`supabase/checks/` (scripts Node que se conectan con las credenciales de `.env`):

```bash
node supabase/checks/aislamiento_rls.mjs
node supabase/checks/permisos_seccion_check.mjs
```

`supabase/checks/rls_audit.sql` se corre a mano en el SQL editor de Supabase y
lista las tablas sin RLS: cero filas es lo esperado.

---

## 7. Cómo no pisarnos

Con dos personas en paralelo, el problema no son los archivos de módulo (cada
módulo es un archivo, y en general cada uno toca los suyos). El problema son los
archivos que **todo el mundo necesita tocar**:

| Archivo | Por qué duele |
|---|---|
| `src/routes.jsx` | Registro único de módulos. Dos features nuevas = dos filas nuevas = conflicto casi seguro |
| `src/index.css` | Design system entero en un archivo |
| `src/store/useStore.js` | Lista de tablas y sincronización |
| `src/context/AuthContext.jsx` | Sesión y permisos |
| `package.json` / `package-lock.json` | Instalar deps en dos ramas a la vez |
| `supabase/migrations/` | Dos migraciones con timestamps cercanos, orden ambiguo |

Reglas prácticas:

1. **Declarar el área antes de empezar.** Un mensaje de chat o una línea en
   `docs/estado-proyecto.md` alcanza: "arranco Finanzas / export contable".
2. Si vas a tocar uno de los archivos de la tabla, avisá y hacelo en un commit
   chico y aislado, para que el conflicto sea trivial de resolver.
3. Instalar una dependencia nueva: avisar. Después del merge, la otra persona
   corre `npm install`.
4. Rebasar seguido contra `main`. Un conflicto de un día se resuelve; uno de dos
   semanas se sufre.
5. Los conflictos de `package-lock.json` no se resuelven a mano: se toma la
   versión de `main` y se corre `npm install` de nuevo.

---

## 8. Seguridad — límites que no se cruzan

- La `service_role` key **nunca** en el frontend ni en el repo. Solo vive en las
  Edge Functions, que corren en los servidores de Supabase.
- RLS activo en todas las tablas. La anon key es pública por diseño (Vite la mete
  en el bundle); la barrera real es RLS, no el secreto de la key.
- `.env` no se commitea. Está en `.gitignore`; si alguna vez aparece en un
  `git status`, algo se rompió — no lo fuerces con `git add -f`.
- Toda tabla nueva: `organization_id` + policy `tenant_isolation` + probarla con
  `supabase/checks/aislamiento_rls.mjs`.
