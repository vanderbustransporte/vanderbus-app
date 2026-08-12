-- Catálogo de referencia GLOBAL de fichas técnicas de vehículos.
--
-- Reemplaza como fuente de datos al catálogo hardcodeado src/data/motores.js:
-- en vez de un array de valores "de referencia" redondeados, una tabla curada,
-- con TRAZABILIDAD de cada dato (de dónde salió, quién lo verificó) y de la que
-- el usuario elige marca → modelo → año → versión para prellenar la ficha de SU
-- unidad, gratis y sin llamar a ninguna API.
--
-- ── Por qué es la EXCEPCIÓN al modelo por empresa ───────────────────────────
-- Un Scania R450 2021 tiene el mismo motor para todos los clientes de la
-- plataforma: es un dato de fábrica, no del negocio de nadie. Por eso esta tabla
-- NO tiene organization_id y NO usa el aislamiento por tenant. Es de LECTURA para
-- todos los autenticados y de ESCRITURA sólo para service_role (siembra admin y,
-- más adelante, el fallback de la Edge Function que cachea acá lo que lee de un
-- PDF). Un usuario común no escribe esta tabla: si carga specs a mano, van a la
-- ficha de su propio vehículo (per-tenant), no acá. Así un dato malo de un tenant
-- no lo ven todos.
--
-- ── Unidad del consumo ──────────────────────────────────────────────────────
-- Todos los consumo_*_l100 son L/100km CON LA UNIDAD VACÍA (a tara), igual que
-- las columnas de `vehiculos`: el peso de la carga lo suma el modelo. NO es km/L.
-- Verificado contra src/utils/consumo.js (litros = l100 * dist / 100).
--
-- Es idempotente.

-- ── Normalización para la clave y el lookup del caché ───────────────────────
-- lower + saca acentos (translate, sin depender de la extensión unaccent) +
-- colapsa cualquier no-alfanumérico a un espacio. Resuelve "Mercedes-Benz" vs
-- "Mercedes Benz" vs "mercedes  benz". IMMUTABLE para poder usarla en columnas
-- generadas y en el índice único.
create or replace function public.normalizar_ref(t text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    translate(lower(coalesce(t, '')),
              'áéíóúàèìòùäëïöüâêîôûãõñç',
              'aeiouaeiouaeiouaeiouaonc'),
    '[^a-z0-9]+', ' ', 'g'))
$$;

-- ── Tabla ───────────────────────────────────────────────────────────────────
create table if not exists public.vehiculos_referencia (
  id            text primary key default gen_random_uuid()::text,

  -- ── Clave natural: marca + modelo + año + versión (versión OBLIGATORIA) ─────
  -- Mismo modelo/año cambia de motor, PBT y tanque según la versión, así que la
  -- versión es parte de la identidad, no un adorno.
  marca         text    not null,
  modelo        text    not null,
  anio          integer not null,
  version       text    not null,
  -- Normalizados (generados por Postgres) para el lookup y la unicidad
  -- case/acento-insensible. La app NO los escribe: son GENERATED ALWAYS.
  marca_norm    text generated always as (public.normalizar_ref(marca))   stored,
  modelo_norm   text generated always as (public.normalizar_ref(modelo))  stored,
  version_norm  text generated always as (public.normalizar_ref(version)) stored,

  -- ── Specs que ALIMENTAN EL ESTIMADOR (src/utils/consumo.js) ────────────────
  clase              text,     -- ← estimador: auto|pickup|furgon|chasis_liviano|chasis_mediano|camion_pesado|tractor_semi (data/clases.js)
  motor              text,     -- ← estimador (motor_desc): ej '2.3 dCi G9U 130 cv'
  cilindrada_l       numeric,  -- ← estimador (motor_cilindrada_l): litros
  potencia_cv        numeric,  --   informativo
  tipo_combustible   text,     -- ← estimador (motor_combustible): diesel|nafta|gnc|hibrido
  consumo_urbano_l100 numeric, -- ← estimador: L/100km VACÍO
  consumo_ruta_l100   numeric, -- ← estimador: L/100km VACÍO
  consumo_mixto_l100  numeric, -- ← estimador: L/100km VACÍO (si es lo único, deriva urbano/ruta)
  fuente_consumo     text,     -- ← estimador: cómo se obtuvo el L/100km → dispara corrección
                               --   (homologado|fabricante|benchmark_flota|estimado_clase). NO confundir con `fuente` (trazabilidad).
  capacidad_tanque_l numeric,  -- ← estimador (tanque_l)
  carroceria         text,     -- ← estimador: playo|con_lona|furgon_cerrado|tanque|portacontenedor|volcador|n_a (sugerencia; la real es por unidad)
  pbt_kg             numeric,  -- ← estimador: peso bruto total admitido
  tara_kg            numeric,  -- ← estimador: peso de la unidad vacía
  carga_util_kg      numeric,  -- ← estimador (carga_max_kg)

  -- ── Trazabilidad (el doble check) ──────────────────────────────────────────
  fuente          text,        -- de dónde salió la ficha: 'Manual Renault Master 2023', etc.
  fuente_url      text,        -- nullable
  pagina          text,        -- nullable: página del documento fuente
  fecha_extraccion date default current_date,
  extraido_por    text not null default 'humano'
                    check (extraido_por in ('humano', 'ia')),
  verificado      boolean not null default false,
  verificado_por  text,        -- nullable: quién hizo el doble check
  notas           text,        -- nullable

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint anio_razonable check (anio between 1950 and 2100)
);

-- Unicidad e índices de lookup en una sola pasada: el índice único sobre los
-- normalizados también sirve los prefijos marca / marca+modelo / marca+modelo+año
-- que arman las listas encadenadas de la UI. Cae sobre las NORMALIZADAS, no sobre
-- las de display: "Mercedes-Benz" y "Mercedes Benz" normalizan igual → una fila.
create unique index if not exists uq_vehiculos_referencia
  on public.vehiculos_referencia (marca_norm, modelo_norm, anio, version_norm);

-- ── updated_at automático ───────────────────────────────────────────────────
create or replace function public.vehiculos_referencia_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_vehiculos_referencia_touch on public.vehiculos_referencia;
create trigger trg_vehiculos_referencia_touch
  before update on public.vehiculos_referencia
  for each row execute function public.vehiculos_referencia_touch();

-- ── RLS: EXCEPCIÓN al modelo por tenant ─────────────────────────────────────
alter table public.vehiculos_referencia enable row level security;

-- Lectura: cualquier usuario autenticado. Es referencia global.
drop policy if exists ref_lectura_global on public.vehiculos_referencia;
create policy ref_lectura_global on public.vehiculos_referencia
  for select to authenticated
  using (true);

-- Escritura (INSERT/UPDATE/DELETE): SIN políticas para `authenticated` a
-- propósito. Sin policy, la operación queda denegada para anon/authenticated.
-- La escritura la hace SÓLO service_role (que bypassea RLS): la siembra admin
-- desde el SQL editor / un seed, y a futuro el fallback de la Edge Function
-- extraer-ficha-tecnica cacheando acá lo que extrae. El cliente NUNCA escribe.
