-- Seguridad — enforcement de los permisos por sección a nivel base.
--
-- Contexto: cada usuario tiene profiles.permisos (jsonb) con nivel por sección
-- ('ninguno'|'ver'|'editar'). Hasta acá eso lo leía SOLO el frontend
-- (puedeVer/puedeEditar): RLS aislaba entre empresas pero cualquier usuario
-- autenticado podía leer/escribir TODAS las tablas de su org por REST directo,
-- sin importar sus permisos. Esta migración vuelve los permisos una barrera real.
--
-- ── Enfoque ──────────────────────────────────────────────────────────────────
-- Igual que 20260715130000 (profiles): NO se tocan las policies de aislamiento
-- por empresa (tenant_isolation), que viven en el dashboard y son la garantía de
-- multi-tenancy. Se AGREGAN policies RESTRICTIVAS que se combinan con AND sobre
-- las permisivas. Modo de falla seguro: un error acá deniega de más (nadie ve lo
-- que no debe), nunca abre una fuga entre empresas — el aislamiento sigue intacto
-- debajo.
--
-- Por tabla se agregan hasta 4 policies restrictivas:
--   SELECT           -> exige <seccion>:ver
--   INSERT/UPDATE/DELETE -> exige <seccion>:editar
-- ('editar' implica 'ver'; ver tiene_permiso). Un owner pasa siempre (is_owner()).
-- service_role (Edge Functions: gps-ingesta, detectar-viajes-gps, Crear-Usuario)
-- saltea RLS por completo → la ingesta GPS y el alta de usuarios no se afectan.
-- Una org suspendida ya está cerrada por current_org_id()=null en la permisiva.
--
-- ── Mapeo sección → tabla ────────────────────────────────────────────────────
-- Estándar (select=ver, write=editar): combustible, mantenimiento, viajes,
--   nomina, gastos(finanzas), marketing, contactos, y las 3 de GPS(seguimiento).
-- Especiales:
--   * ingresos: la maneja finanzas, PERO el módulo Viajes inserta un ingreso al
--     marcar un viaje "Realizado". Para no romper ese flujo (ni el dedup, que
--     necesita LEER los ingresos ya creados), ingresos se abre a finanzas OR
--     viajes. Contrapartida asumida: un usuario de viajes ve los ingresos.
--   * vehiculos: es dato de REFERENCIA que leen viajes, combustible,
--     mantenimiento y GPS para mostrar patente/alias. Restringir su SELECT
--     rompería esos módulos → SELECT queda abierto (solo aislamiento por org);
--     solo se gatea la ESCRITURA con vehiculo:editar (incluye archivar, que es
--     un update).
--
-- Es idempotente.

-- ── Helper: ¿el usuario logueado tiene <nivel> en <seccion>? ──────────────────
-- security definer + lectura de la propia fila (saltea RLS, no recursa). Un owner
-- pasa siempre. Sección sin entrada en el jsonb -> false (sin permiso).
create or replace function public.tiene_permiso(p_seccion text, p_nivel text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_owner() then true
    when p_nivel = 'ver' then
      coalesce((select (permisos ->> p_seccion) in ('ver', 'editar')
                  from public.profiles where id = auth.uid()), false)
    when p_nivel = 'editar' then
      coalesce((select (permisos ->> p_seccion) = 'editar'
                  from public.profiles where id = auth.uid()), false)
    else false
  end
$$;

revoke all on function public.tiene_permiso(text, text) from public, anon;
grant execute on function public.tiene_permiso(text, text) to authenticated;

-- ── Tablas estándar: select=ver, insert/update/delete=editar ─────────────────
do $$
declare
  rec jsonb;
  tbl text;
  sec text;
  estandar constant jsonb := '[
    {"t":"combustible",     "s":"combustible"},
    {"t":"mantenimiento",   "s":"mantenimiento"},
    {"t":"viajes",          "s":"viajes"},
    {"t":"nomina",          "s":"nomina"},
    {"t":"gastos",          "s":"finanzas"},
    {"t":"marketing",       "s":"marketing"},
    {"t":"contactos",       "s":"contactos"},
    {"t":"ubicaciones_gps", "s":"seguimiento"},
    {"t":"viajes_gps",      "s":"seguimiento"},
    {"t":"dispositivos_gps","s":"seguimiento"}
  ]'::jsonb;
begin
  for rec in select * from jsonb_array_elements(estandar) loop
    tbl := rec ->> 't';
    sec := rec ->> 's';
    execute format('drop policy if exists %I on public.%I', 'perm_'||tbl||'_select', tbl);
    execute format('drop policy if exists %I on public.%I', 'perm_'||tbl||'_insert', tbl);
    execute format('drop policy if exists %I on public.%I', 'perm_'||tbl||'_update', tbl);
    execute format('drop policy if exists %I on public.%I', 'perm_'||tbl||'_delete', tbl);
    execute format(
      'create policy %I on public.%I as restrictive for select to authenticated using (public.tiene_permiso(%L, ''ver''))',
      'perm_'||tbl||'_select', tbl, sec);
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated with check (public.tiene_permiso(%L, ''editar''))',
      'perm_'||tbl||'_insert', tbl, sec);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using (public.tiene_permiso(%L, ''editar'')) with check (public.tiene_permiso(%L, ''editar''))',
      'perm_'||tbl||'_update', tbl, sec, sec);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using (public.tiene_permiso(%L, ''editar''))',
      'perm_'||tbl||'_delete', tbl, sec);
  end loop;
end $$;

-- ── ingresos: finanzas OR viajes (por el flujo de Viajes → ingreso) ──────────
drop policy if exists perm_ingresos_select on public.ingresos;
create policy perm_ingresos_select on public.ingresos
  as restrictive for select to authenticated
  using (public.tiene_permiso('finanzas', 'ver') or public.tiene_permiso('viajes', 'ver'));

drop policy if exists perm_ingresos_insert on public.ingresos;
create policy perm_ingresos_insert on public.ingresos
  as restrictive for insert to authenticated
  with check (public.tiene_permiso('finanzas', 'editar') or public.tiene_permiso('viajes', 'editar'));

drop policy if exists perm_ingresos_update on public.ingresos;
create policy perm_ingresos_update on public.ingresos
  as restrictive for update to authenticated
  using      (public.tiene_permiso('finanzas', 'editar') or public.tiene_permiso('viajes', 'editar'))
  with check (public.tiene_permiso('finanzas', 'editar') or public.tiene_permiso('viajes', 'editar'));

drop policy if exists perm_ingresos_delete on public.ingresos;
create policy perm_ingresos_delete on public.ingresos
  as restrictive for delete to authenticated
  using (public.tiene_permiso('finanzas', 'editar') or public.tiene_permiso('viajes', 'editar'));

-- ── vehiculos: dato de referencia. SELECT abierto (solo aislamiento por org),
--    solo la escritura se gatea con vehiculo:editar. ────────────────────────────
drop policy if exists perm_vehiculos_insert on public.vehiculos;
create policy perm_vehiculos_insert on public.vehiculos
  as restrictive for insert to authenticated
  with check (public.tiene_permiso('vehiculo', 'editar'));

drop policy if exists perm_vehiculos_update on public.vehiculos;
create policy perm_vehiculos_update on public.vehiculos
  as restrictive for update to authenticated
  using      (public.tiene_permiso('vehiculo', 'editar'))
  with check (public.tiene_permiso('vehiculo', 'editar'));

drop policy if exists perm_vehiculos_delete on public.vehiculos;
create policy perm_vehiculos_delete on public.vehiculos
  as restrictive for delete to authenticated
  using (public.tiene_permiso('vehiculo', 'editar'));
