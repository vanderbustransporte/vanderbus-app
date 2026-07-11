-- Fase 2 (auditoría, punto 11a) — agregaciones del Dashboard server-side.
--
-- dashboard_resumen() calcula en Postgres lo que el Dashboard computaba en el
-- browser recorriendo TODAS las filas: serie de 6 meses (ingresos vs gastos
-- amplios), distribución de gastos del mes actual y últimos registros.
-- "Gastos amplios" = gastos + combustible + mantenimiento + nómina (misma
-- definición intencional del Dashboard, distinta de Finanzas — ver Dashboard.jsx).
--
-- Seguridad: language sql SIN security definer → corre como el llamador y las
-- policies de RLS (organization_id = current_org_id()) filtran solas. Un anon
-- o una org suspendida reciben todo en cero, no datos ajenos.
--
-- Legado: los montos y fechas son columnas TEXT. monto() castea con guarda de
-- regex (acepta coma o punto decimal) y devuelve 0 ante basura, igual que el
-- parseFloat(r.importe) || 0 del frontend.
--
-- Es idempotente.

create or replace function public.monto(t text)
returns numeric
language sql
immutable
as $$
  select case
    when t ~ '^\s*-?[0-9]+([.,][0-9]+)?\s*$' then replace(trim(t), ',', '.')::numeric
    else 0
  end;
$$;

create or replace function public.dashboard_resumen()
returns jsonb
language sql
stable
as $$
with costos as (
  select substr(fecha, 1, 7) as mes, public.monto(importe) as monto, 'combustible' as cat
    from public.combustible where fecha is not null
  union all
  select substr(fecha, 1, 7), public.monto(costo), 'mantenimiento'
    from public.mantenimiento where fecha is not null
  union all
  select substr(fecha, 1, 7), public.monto(importe), 'nomina'
    from public.nomina where fecha is not null
  union all
  select substr(fecha, 1, 7), public.monto(importe), 'otros'
    from public.gastos where fecha is not null
),
ing as (
  select substr(fecha, 1, 7) as mes, public.monto(importe) as monto
    from public.ingresos where fecha is not null
),
meses as (
  select to_char(date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')
                 - (interval '1 month' * n), 'YYYY-MM') as mes
  from generate_series(0, 5) n
),
serie as (
  select m.mes,
         coalesce((select sum(monto) from ing    where ing.mes = m.mes), 0) as ingresos,
         coalesce((select sum(monto) from costos where costos.mes = m.mes), 0) as gastos
  from meses m
),
pie as (
  select cat, sum(monto) as total
  from costos
  where mes = to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM')
  group by cat
),
ultimos as (
  select
    (select to_jsonb(x) from (select importe, fecha           from public.ingresos      where fecha is not null order by fecha desc limit 1) x) as servicio,
    (select to_jsonb(x) from (select descripcion, fecha       from public.mantenimiento where fecha is not null order by fecha desc limit 1) x) as mantenimiento,
    (select to_jsonb(x) from (select importe, empleado, fecha from public.nomina        where fecha is not null order by fecha desc limit 1) x) as nomina
)
select jsonb_build_object(
  'meses',   (select jsonb_agg(jsonb_build_object('mes', mes, 'ingresos', ingresos, 'gastos', gastos) order by mes) from serie),
  'pie',     coalesce((select jsonb_object_agg(cat, total) from pie), '{}'::jsonb),
  'ultimos', (select jsonb_build_object('servicio', servicio, 'mantenimiento', mantenimiento, 'nomina', nomina) from ultimos)
);
$$;

revoke all on function public.monto(text) from public, anon;
grant execute on function public.monto(text) to authenticated;
revoke all on function public.dashboard_resumen() from public, anon;
grant execute on function public.dashboard_resumen() to authenticated;
