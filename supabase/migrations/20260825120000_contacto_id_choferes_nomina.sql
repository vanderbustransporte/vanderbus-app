-- Primer paso de "Contactos como fuente de verdad" (ver docs/estado-proyecto.md):
-- choferes y nomina ganan contacto_id para referenciar contactos en vez de
-- duplicar nombre/telefono/email a mano. Migración de esquema pura: al
-- 2026-08-25 las tres tablas (contactos, choferes, nomina) están vacías en
-- producción, así que no hace falta backfill ni resolución de duplicados.
--
-- contacto_id es NULLABLE en las dos tablas a propósito: no se fuerza a que
-- todo chofer o pago de nómina tenga un contacto asociado (por ejemplo, un
-- pago suelto sin legajo formal todavía). ON DELETE SET NULL: borrar un
-- contacto no debe romper ni arrastrar el borrado de choferes/nomina que lo
-- referencian, solo desvincularlos.
--
-- viajes.cliente queda afuera de este paso (fase 2, decisión del dueño
-- 2026-08-25): se mantiene como texto libre.
--
-- Es idempotente.

alter table public.choferes
  add column if not exists contacto_id text references public.contactos(id) on delete set null;

alter table public.nomina
  add column if not exists contacto_id text references public.contactos(id) on delete set null;

create index if not exists idx_choferes_contacto on public.choferes (contacto_id);
create index if not exists idx_nomina_contacto    on public.nomina (contacto_id);
