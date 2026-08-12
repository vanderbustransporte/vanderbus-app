-- Documentos técnicos por vehículo (manual del fabricante, ficha comercial).
--
-- Para qué: el consumo y los pesos de una unidad están en su manual o en la
-- ficha técnica comercial. Esta migración deja subir ese PDF, guardarlo por
-- empresa y consultarlo desde la ficha del vehículo. La extracción asistida de
-- datos (Edge Function `extraer-ficha-tecnica`) lee de acá.
--
-- ── Un manual pertenece a la empresa que lo subió ───────────────────────────
--
-- NO hay biblioteca compartida entre organizaciones y no debe haberla: son
-- documentos con copyright del fabricante. Que un cliente suba el manual de su
-- propia unidad y lo consulte es uso propio; redistribuirlo a otros clientes de
-- la plataforma es otra cosa. El aislamiento es por `organization_id` en la
-- tabla Y por la primera carpeta del path en Storage.
--
-- ── Storage ─────────────────────────────────────────────────────────────────
--
-- Bucket privado `vehiculo-docs`, particionado `<organization_id>/<vehiculo_id>/
-- <archivo>`. Las policies de storage.objects comparan la PRIMERA carpeta del
-- path contra current_org_id(): sin eso, cualquier usuario autenticado podría
-- leer los objetos de otra empresa aunque la fila de metadatos esté protegida.
-- El acceso se hace siempre con signed URLs de vida corta desde el frontend.
--
-- Backup: `importar_backup` NO toca esta tabla. El backup es un JSON de filas y
-- los PDFs viven en Storage; restaurar las filas sin los archivos dejaría
-- registros apuntando a objetos inexistentes. Se documenta y se deja afuera a
-- propósito.
--
-- Detección desde el frontend: error 42P01 al consultar la tabla
-- (src/utils/docsVehiculo.js). Hasta que esté aplicada, la ficha del vehículo no
-- muestra la sección de documentos.
--
-- Es idempotente.

-- ── Tabla de metadatos ──────────────────────────────────────────────────────
create table if not exists public.vehiculo_docs (
  id              text primary key default gen_random_uuid()::text,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehiculo_id     uuid references public.vehiculos(id) on delete cascade,
  tipo            text,   -- 'manual' | 'ficha_tecnica' | 'otro'
  nombre          text,   -- nombre original del archivo, para mostrar
  storage_path    text,   -- ruta dentro del bucket
  tamano_bytes    text,   -- text por el legado de números como string
  paginas         text,   -- se completa cuando se indexa el PDF
  notas           text,
  created_at      text default to_char(now() at time zone 'America/Argentina/Buenos_Aires',
                                       'YYYY-MM-DD HH24:MI:SS')
);

create index if not exists idx_vehiculo_docs_org on public.vehiculo_docs (organization_id);
create index if not exists idx_vehiculo_docs_veh on public.vehiculo_docs (vehiculo_id);

-- ── RLS: aislamiento por empresa (patrón de las 19 tablas) ──────────────────
alter table public.vehiculo_docs enable row level security;

drop policy if exists tenant_isolation on public.vehiculo_docs;
create policy tenant_isolation on public.vehiculo_docs
  for all to authenticated
  using      (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- ── RLS: permisos por sección 'vehiculo' (restrictivas, patrón 20260715140000) ─
-- Los documentos de una unidad son parte de su ficha: quien puede ver la flota
-- los ve, quien puede editarla los sube y los borra.
drop policy if exists perm_vehiculo_docs_select on public.vehiculo_docs;
create policy perm_vehiculo_docs_select on public.vehiculo_docs
  as restrictive for select to authenticated
  using (public.tiene_permiso('vehiculo', 'ver'));

drop policy if exists perm_vehiculo_docs_insert on public.vehiculo_docs;
create policy perm_vehiculo_docs_insert on public.vehiculo_docs
  as restrictive for insert to authenticated
  with check (public.tiene_permiso('vehiculo', 'editar'));

drop policy if exists perm_vehiculo_docs_update on public.vehiculo_docs;
create policy perm_vehiculo_docs_update on public.vehiculo_docs
  as restrictive for update to authenticated
  using      (public.tiene_permiso('vehiculo', 'editar'))
  with check (public.tiene_permiso('vehiculo', 'editar'));

drop policy if exists perm_vehiculo_docs_delete on public.vehiculo_docs;
create policy perm_vehiculo_docs_delete on public.vehiculo_docs
  as restrictive for delete to authenticated
  using (public.tiene_permiso('vehiculo', 'editar'));

-- ── Bucket privado ──────────────────────────────────────────────────────────
-- 30 MB por archivo: un manual de camión escaneado pesa, pero más que eso casi
-- siempre es un escaneo sin comprimir que además no tiene texto extraíble.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehiculo-docs', 'vehiculo-docs', false, 31457280, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── RLS de los objetos ──────────────────────────────────────────────────────
-- La primera carpeta del path es la organización. `storage.foldername(name)`
-- devuelve el array de carpetas; [1] es la primera.
drop policy if exists vehiculo_docs_select on storage.objects;
create policy vehiculo_docs_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vehiculo-docs'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.tiene_permiso('vehiculo', 'ver')
  );

drop policy if exists vehiculo_docs_insert on storage.objects;
create policy vehiculo_docs_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vehiculo-docs'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.tiene_permiso('vehiculo', 'editar')
  );

drop policy if exists vehiculo_docs_delete on storage.objects;
create policy vehiculo_docs_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vehiculo-docs'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.tiene_permiso('vehiculo', 'editar')
  );

-- No hay policy de UPDATE a propósito: un documento no se edita, se borra y se
-- sube de nuevo (así el path siempre corresponde al archivo que está).
