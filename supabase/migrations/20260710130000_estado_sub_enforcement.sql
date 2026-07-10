-- Fase 1 — Enforcement del estado de suscripción (organizations.estado_sub).
--
-- Problema (auditoría 2026-07-10, Área 2): el schema documenta
-- `estado_sub ('activa'|'suspendida'|'cancelada')` pero NINGÚN código lo lee.
-- Una empresa que deja de pagar conserva acceso completo a la app y sus datos.
--
-- Esta migración:
--   1. Asegura la columna `organizations.estado_sub` (default 'activa' + CHECK).
--   2. Gatea `current_org_id()`: si la org del usuario NO está 'activa',
--      devuelve NULL. Como todas las policies `tenant_isolation` comparan
--      `organization_id = current_org_id()`, una org suspendida/cancelada
--      pierde lectura Y escritura en todas las tablas de una sola vez,
--      a nivel base de datos (falla cerrado, no depende del frontend).
--   3. Crea el RPC `estado_suscripcion()` para que el frontend sepa POR QUÉ
--      no ve datos y muestre la pantalla "cuenta suspendida". Es necesario
--      porque, con la org gateada, la propia fila de `organizations` deja de
--      ser legible vía RLS.
--
-- Reactivar un cliente: update organizations set estado_sub = 'activa' where id = ...;
--
-- Es idempotente: se puede correr más de una vez sin romper.

-- ── 1. Columna estado_sub (defensivo: puede ya existir) ───────────────────────
alter table public.organizations
  add column if not exists estado_sub text;

update public.organizations
   set estado_sub = 'activa'
 where estado_sub is null;

alter table public.organizations
  alter column estado_sub set default 'activa';

alter table public.organizations
  alter column estado_sub set not null;

alter table public.organizations
  drop constraint if exists organizations_estado_sub_check;

alter table public.organizations
  add constraint organizations_estado_sub_check
  check (estado_sub in ('activa', 'suspendida', 'cancelada'));

-- ── 2. Gate en current_org_id() ───────────────────────────────────────────────
-- ATENCIÓN: esta función es el corazón de TODAS las policies tenant_isolation.
-- A partir de acá, "tener org" y "tener org activa" son lo mismo para RLS.
--
-- Efecto colateral deseado: los defaults `organization_id default current_org_id()`
-- (ej. notificaciones) resuelven a NULL para una org suspendida y el insert
-- viola el NOT NULL → tampoco puede escribir por esa vía.
create or replace function public.current_org_id() returns uuid
  language sql stable security definer
  set search_path = public
as $$
  select p.organization_id
  from public.profiles p
  join public.organizations o on o.id = p.organization_id
  where p.id = auth.uid()
    and o.estado_sub = 'activa'
$$;

-- ── 3. RPC estado_suscripcion() para el frontend ──────────────────────────────
-- Devuelve el estado_sub de la org del usuario logueado SIN pasar por RLS
-- (security definer), justamente para poder informar la suspensión.
-- No filtra datos: solo expone el estado de la propia empresa del caller.
create or replace function public.estado_suscripcion() returns text
  language sql stable security definer
  set search_path = public
as $$
  select o.estado_sub
  from public.profiles p
  join public.organizations o on o.id = p.organization_id
  where p.id = auth.uid()
$$;

revoke all on function public.estado_suscripcion() from public;
revoke all on function public.estado_suscripcion() from anon;
grant execute on function public.estado_suscripcion() to authenticated;
