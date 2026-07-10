-- Fase 1 — `organizations` solo-lectura para los tenants.
--
-- Hallazgo 2026-07-10 (probe con el usuario real de la org B de prueba):
-- la policy de `organizations` permitía UPDATE de la propia fila, así que un
-- cliente podía, desde su sesión (REST con anon key + JWT):
--   - cambiarse el `plan` (verificado: update a 'premium-probe' PASÓ)
--     → bypass de billing cuando los planes limiten features;
--   - tocar su `estado_sub` (verificado: auto-suspenderse PASÓ; la
--     auto-REACTIVACIÓN sí queda bloqueada porque current_org_id() gateada
--     ya no ve la fila — falla cerrado, pero la escritura no debe existir).
--
-- El frontend NUNCA escribe organizations (verificado: cero referencias en
-- src/); las altas las hace crear_empresa() (SECURITY DEFINER, corre como el
-- dueño de la tabla → no pasa por RLS) y la administración va por SQL/dashboard
-- o, a futuro, una Edge Function con service_role. Nada legítimo se rompe.
--
-- Esta migración reemplaza TODAS las policies de organizations por una única
-- policy de SELECT de la propia org. Sin policies de INSERT/UPDATE/DELETE,
-- esas operaciones quedan denegadas para anon/authenticated.
--
-- Verificación de salida (suite: supabase/checks/aislamiento_rls.mjs, y a mano):
--   update organizations set plan='x' where id = <propia>  → 0 filas / 42501.
--
-- Es idempotente.

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'organizations'
  loop
    execute format('drop policy %I on public.organizations', pol.policyname);
  end loop;
end $$;

-- Lectura: cada tenant ve solo su propia organización (y solo si está activa,
-- porque current_org_id() ya viene gateada por estado_sub).
create policy tenant_read on public.organizations
  for select
  using (id = public.current_org_id());
