-- Fase 2 (auditoría, punto 11c) — Realtime para las tablas de datos.
--
-- Agrega las tablas del store a la publicación supabase_realtime para que el
-- frontend reemplace el poll ciego de 30s por una suscripción postgres_changes
-- (filtrada por organization_id y además gateada por RLS del lado del server).
--
-- Nota sobre DELETE (verificado empíricamente): los eventos de borrado solo
-- traen la primary key (replica identity default) y Supabase los entrega SIN
-- aplicar el filtro por organization_id → todas las sesiones suscriptas a la
-- tabla refrescan, incluso las de otras orgs (solo ven sus propios datos por
-- RLS; el costo es un refetch de más). El poll de respaldo del store (5 min)
-- queda como red de seguridad ante cortes de conexión.
--
-- Es idempotente.

do $$
declare
  t text;
begin
  foreach t in array array[
    'vehiculos', 'combustible', 'mantenimiento', 'viajes', 'contactos',
    'nomina', 'ingresos', 'gastos', 'marketing', 'org_settings'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
