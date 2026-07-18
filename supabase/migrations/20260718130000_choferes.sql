-- Fase C del plan de producto (docs/plan-producto-tms.md): choferes como
-- entidad con legajo — datos de contacto + vencimientos (licencia,
-- habilitación LNH/CNRT, psicofísico) que se enchufan al sistema de
-- notificaciones existente (tipo 'vencimiento', ya permitido por el CHECK de
-- notificaciones.tipo: NO hace falta tocarlo).
--
-- El frontend detecta si esta migración está aplicada consultando la tabla
-- (error 42P01 = no existe; src/utils/choferes.js). Hasta entonces el módulo
-- Choferes muestra el aviso de migración pendiente y el store trata la tabla
-- como vacía (y la excluye de la suscripción Realtime para no romper el canal).
--
-- Convenciones que se respetan (ver .claude/skills/vanderbus-app.md):
--   - id TEXT generado por genId() en el frontend (default por si falta).
--   - fechas como TEXT 'YYYY-MM-DD'; created_at TEXT hora argentina.
--   - soft delete con activo=false (igual que vehiculos).
--
-- Es idempotente.

-- ── Tabla ────────────────────────────────────────────────────────────────────
create table if not exists public.choferes (
  id                 text primary key default gen_random_uuid()::text,
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  nombre             text,
  dni                text,
  celular            text,
  email              text,
  licencia_categoria text,   -- ej: C1, E1
  licencia_venc      text,   -- 'YYYY-MM-DD'
  habilitacion_venc  text,   -- LNH / CNRT, 'YYYY-MM-DD'
  psicofisico_venc   text,   -- 'YYYY-MM-DD'
  notas              text,
  activo             boolean not null default true,
  created_at         text default to_char(now() at time zone 'America/Argentina/Buenos_Aires',
                                          'YYYY-MM-DD HH24:MI:SS')
);

create index if not exists idx_choferes_org on public.choferes (organization_id);

-- ── RLS: aislamiento por empresa (permisiva) ─────────────────────────────────
alter table public.choferes enable row level security;

drop policy if exists tenant_isolation on public.choferes;
create policy tenant_isolation on public.choferes
  for all to authenticated
  using      (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- ── RLS: permisos por sección 'choferes' (restrictivas, patrón 20260715140000) ─
drop policy if exists perm_choferes_select on public.choferes;
create policy perm_choferes_select on public.choferes
  as restrictive for select to authenticated
  using (public.tiene_permiso('choferes', 'ver'));

drop policy if exists perm_choferes_insert on public.choferes;
create policy perm_choferes_insert on public.choferes
  as restrictive for insert to authenticated
  with check (public.tiene_permiso('choferes', 'editar'));

drop policy if exists perm_choferes_update on public.choferes;
create policy perm_choferes_update on public.choferes
  as restrictive for update to authenticated
  using      (public.tiene_permiso('choferes', 'editar'))
  with check (public.tiene_permiso('choferes', 'editar'));

drop policy if exists perm_choferes_delete on public.choferes;
create policy perm_choferes_delete on public.choferes
  as restrictive for delete to authenticated
  using (public.tiene_permiso('choferes', 'editar'));

-- ── Realtime ─────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'choferes'
  ) then
    alter publication supabase_realtime add table public.choferes;
  end if;
end $$;

-- ── importar_backup: sumar choferes al reemplazo total ───────────────────────
-- Copia de 20260715120000 con 'choferes' en el array de tablas. Un backup viejo
-- sin la clave 'choferes' vacía la tabla (misma semántica de reemplazo total
-- que el resto). El RPC anterior ignoraba claves desconocidas, así que un
-- frontend nuevo contra el RPC viejo no rompe (solo no restaura choferes).
create or replace function public.importar_backup(p_data jsonb)
returns jsonb
language plpgsql
volatile
set search_path = public
as $$
declare
  tablas constant text[] := array['vehiculos','choferes','combustible','mantenimiento',
    'contactos','nomina','ingresos','gastos','marketing','viajes'];
  v_org uuid := public.current_org_id();
  v_now text := to_char(now() at time zone 'America/Argentina/Buenos_Aires',
                        'YYYY-MM-DD HH24:MI:SS');
  t text;
  v_rows jsonb;
  v_patched jsonb;
  v_cols text;
  v_resumen jsonb := '{}'::jsonb;
begin
  if v_org is null then
    raise exception 'Sin organización activa' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'p_data debe ser un objeto {tabla: [filas...]}';
  end if;

  -- Validar TODO el payload antes de borrar nada (fail fast).
  foreach t in array tablas loop
    v_rows := coalesce(p_data -> t, '[]'::jsonb);
    if jsonb_typeof(v_rows) <> 'array' then
      raise exception '"%" debe ser una lista de filas', t;
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_rows) e
      where jsonb_typeof(e.value) <> 'object'
    ) then
      raise exception '"%" tiene elementos que no son filas', t;
    end if;
  end loop;

  for i in reverse array_length(tablas, 1) .. 1 loop
    execute format('delete from public.%I where organization_id = $1', tablas[i])
      using v_org;
  end loop;

  foreach t in array tablas loop
    v_rows := coalesce(p_data -> t, '[]'::jsonb);
    select coalesce(jsonb_agg(
             e.value || jsonb_build_object(
               'organization_id', v_org,
               'id', coalesce(nullif(e.value ->> 'id', ''), gen_random_uuid()::text),
               'created_at', coalesce(nullif(e.value ->> 'created_at', ''), v_now)
             )), '[]'::jsonb)
      into v_patched
      from jsonb_array_elements(v_rows) e;
    -- Insertar SOLO las columnas presentes en el archivo (∩ las de la tabla):
    -- las ausentes toman su DEFAULT (p. ej. choferes.activo, vehiculos.activo).
    select string_agg(quote_ident(c.column_name), ',' order by c.ordinal_position)
      into v_cols
      from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = t
       and (c.column_name in ('organization_id', 'id', 'created_at')  -- siempre en v_patched
            or exists (
              select 1 from jsonb_array_elements(v_rows) e
              where e.value ? c.column_name));
    execute format(
      'insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1)',
      t, v_cols, v_cols, t) using v_patched;
    v_resumen := v_resumen || jsonb_build_object(t, jsonb_array_length(v_rows));
  end loop;

  return v_resumen;
end;
$$;

revoke all on function public.importar_backup(jsonb) from public, anon;
grant execute on function public.importar_backup(jsonb) to authenticated;
