-- Seguridad — cerrar la auto-escalada de rol/permisos en `profiles`.
--
-- Hallazgo (2026-07-15, verificado por REST contra prod): la policy de UPDATE de
-- `profiles` permitía a un usuario cambiar su PROPIA fila, incluidas las columnas
-- `rol` y `permisos`. Es decir, cualquier staff podía ejecutar desde la consola
--   supabase.from('profiles').update({ rol: 'owner' }).eq('id', <su id>)
-- y auto-promoverse a owner (o darse permisos sobre cualquier sección). El único
-- cambio ya bloqueado era `organization_id` (salto entre empresas).
--
-- La autorización owner/staff y los permisos por sección eran, hasta acá, solo
-- del frontend: RLS aislaba entre empresas pero no dentro de la empresa.
--
-- ── Estado real de las policies de `profiles` (leído de pg_policies, 2026-07-15) ─
-- Las 3 viven en el dashboard, no en el repo:
--   ver_perfiles_de_mi_org  SELECT  using (organization_id = current_org_id())
--   editar_mi_perfil        UPDATE  using (id = auth.uid())                         ← el agujero
--   owner_actualiza_perfiles UPDATE using (organization_id = current_org_id() AND is_owner())
--                                   with check (organization_id = current_org_id())
-- `editar_mi_perfil` deja a cualquiera actualizar su propia fila sin restringir
-- columnas → de ahí sale la escalada de rol/permisos. Las dos policies de UPDATE
-- son PERMISIVAS (se combinan con OR): basta que una se cumpla.
--
-- ── Enfoque ──────────────────────────────────────────────────────────────────
-- NO se tocan las policies existentes (no dropear lo que no está versionado y
-- cubre el SELECT + el flujo owner). Se AGREGA una policy RESTRICTIVA de
-- solo-UPDATE: las restrictivas se combinan con AND sobre el OR de las
-- permisivas, así que el efecto neto para UPDATE pasa a ser
--   (id = auth.uid() OR (org AND is_owner()))  AND  is_owner()
--   - Un no-owner: is_owner() es false -> 0 filas afectadas. Muerta la escalada
--     (incluye el update de la propia fila vía editar_mi_perfil).
--   - Un owner: sigue editando rol/permisos de los usuarios de su empresa
--     (owner_actualiza_perfiles). organization_id sigue bloqueado por el
--     with check de esa policy.
--   - Crear-Usuario / provisionar_empresa corren con service_role o security
--     definer -> saltan RLS, no los afecta.
--
-- Reutiliza la función `is_owner()` que ya usa owner_actualiza_perfiles (no se
-- crea una nueva). Único efecto colateral: un no-owner ya no puede actualizar
-- NI su propia fila (hoy no hay ningún flujo que lo haga; si se agrega uno de
-- auto-servicio, va por RPC o se ajusta esta policy).
--
-- Deuda relacionada (fuera de alcance): los permisos por sección (puedeVer/
-- puedeEditar) siguen sin enforcement a nivel base en las tablas operativas;
-- esta migración cierra solo la escalada de rol, que es lo más grave.
--
-- Es idempotente. Depende de que exista public.is_owner() (ya presente en prod).

drop policy if exists profiles_solo_owner_escribe on public.profiles;
create policy profiles_solo_owner_escribe on public.profiles
  as restrictive
  for update
  to authenticated
  using      (public.is_owner())
  with check (public.is_owner());
