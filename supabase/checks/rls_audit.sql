-- Diagnóstico de RLS — correr en el SQL Editor de Supabase.
--
-- Lista TODAS las tablas de public con su estado de RLS y cuántas policies tienen.
-- Cómo leer el resultado:
--   rls_activo = false           → 🔴 TABLA ABIERTA. Cualquiera con la anon key la
--                                    lee/escribe. Es el bug de notificaciones/
--                                    ubicaciones_gps. NINGUNA tabla debería estar así.
--   rls_activo = true, policies=0 → ⚠️ RLS activo pero sin policy = "deny all":
--                                    segura, pero la app no puede leerla. Falta la
--                                    policy tenant_isolation.
--   rls_activo = true, policies≥1 → ✅ ok (revisar que la policy sea por org).
--
-- Correr esto antes de dar de alta cada cliente nuevo y cada vez que se cree una
-- tabla. Es el chequeo que hubiera atajado los dos leaks.

select
  c.relname                              as tabla,
  c.relrowsecurity                       as rls_activo,
  count(p.polname)                       as policies,
  string_agg(p.polname, ', ')            as nombres_policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'          -- solo tablas
group by c.relname, c.relrowsecurity
order by c.relrowsecurity asc, c.relname;   -- las abiertas (false) primero

-- Segunda pasada: la DEFINICIÓN de cada policy. El nombre solo no alcanza —
-- el caso `oportunidades` tenía una policy (op_auth_all) y aun así estaba
-- abierta: RLS desactivado a nivel tabla, y la policy sin filtro por org.
-- Cómo leer el resultado:
--   filtra_por_org = false → ⚠️ la policy NO menciona organization_id ni
--                             current_org_id(): un usuario logueado de otra
--                             empresa pasa igual. Reemplazar por tenant_isolation.
--   using/with_check = true (literal) → policy "todo permitido", mismo problema.

select
  tablename                                        as tabla,
  policyname                                       as policy,
  cmd,
  roles,
  qual                                             as using_expr,
  with_check,
  (coalesce(qual, '') || coalesce(with_check, ''))
    ilike '%organization_id%'                      as filtra_por_org
from pg_policies
where schemaname = 'public'
order by filtra_por_org asc, tablename;   -- las sospechosas primero
