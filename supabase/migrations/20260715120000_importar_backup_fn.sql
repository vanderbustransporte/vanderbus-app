-- Fase 3 (auditoría, punto 13) — import de backup transaccional.
--
-- Reemplaza el import del frontend (useStore.importData), que hacía por tabla
-- delete() + insert() sueltos vía REST y ADEMÁS no chequeaba los errores: un
-- fallo a mitad de camino dejaba tablas ya vaciadas sin sus datos nuevos y el
-- usuario veía "importado correctamente" igual. Acá todo corre dentro de UNA
-- función (= una transacción): si cualquier fila falla, se revierte todo y
-- los datos quedan exactamente como estaban.
--
-- Semántica (la misma del import viejo): REEMPLAZO TOTAL. Cada tabla del
-- backup pisa la tabla completa de la org; una tabla ausente en el JSON se
-- vacía. organization_id se fuerza SIEMPRE a la org del llamador (importar
-- el backup de otra empresa lo mete en la tuya, no te da acceso a la suya).
-- id y created_at ausentes se completan con defaults (uuid / hora argentina),
-- igual que hacía el frontend.
--
-- Seguridad: SIN security definer → corre como el llamador y RLS aplica
-- (tenant_isolation: solo borra/inserta filas de current_org_id(); una org
-- suspendida tiene current_org_id() null y la guarda corta antes de tocar
-- nada). Cualquier miembro de la org puede ejecutarla — igual que antes:
-- RLS no distingue roles para escribir y el gate de owner está en la UI.
--
-- Devuelve {"tabla": filas_insertadas, ...} para que la UI informe el resumen.
--
-- Verificación de salida: supabase/checks/importar_backup_check.mjs
-- (anon denegado, reemplazo total, atomicidad ante fila inválida, org spoof
-- ignorado, defaults de id/created_at).
--
-- Es idempotente.

create or replace function public.importar_backup(p_data jsonb)
returns jsonb
language plpgsql
volatile
set search_path = public
as $$
declare
  -- Orden de INSERT: vehiculos primero (los DELETE van al revés) por si
  -- algún día las tablas de movimientos ganan FKs a vehiculos.
  tablas constant text[] := array['vehiculos','combustible','mantenimiento',
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
    -- las ausentes toman su DEFAULT — igual que el insert por REST de antes.
    -- (populate_recordset con select * las pondría en null y rompería los
    -- not null con default, p. ej. vehiculos.activo.) Claves desconocidas
    -- del JSON se ignoran.
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
