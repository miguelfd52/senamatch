-- =============================================================================
-- SENA MATCH v3 · 0001 · Extensiones y catálogos institucionales
-- =============================================================================
-- Los catálogos no los escribe el usuario: se cargan por administración o desde
-- el portal de Datos Abiertos del SENA. Sofia Plus NO expone API pública, así
-- que la matrícula no se valida contra el sistema: se valida con correo
-- institucional + padrón de fichas por centro (tabla `roster`) + aval humano.
-- =============================================================================

-- Supabase aloja las extensiones en el esquema `extensions`. Por eso todas las
-- funciones de estas migraciones llevan `search_path = public, extensions`.
create schema if not exists extensions;
set search_path = public, extensions;

create extension if not exists pgcrypto      with schema extensions;  -- gen_random_uuid()
create extension if not exists citext        with schema extensions;  -- correos sin distinción de mayúsculas
create extension if not exists pg_trgm       with schema extensions;  -- búsqueda difusa
create extension if not exists unaccent      with schema extensions;  -- búsqueda sin tildes
create extension if not exists cube          with schema extensions;  -- requisito de earthdistance
create extension if not exists earthdistance with schema extensions;  -- distancia en metros sin PostGIS

-- pg_cron se habilita desde el panel: Database > Extensions > pg_cron.
-- El archivo 0008 lo usa si está disponible y no falla si no lo está.


-- -----------------------------------------------------------------------------
-- Centros de formación (el centro es la unidad de visibilidad de toda la app)
-- -----------------------------------------------------------------------------
create table if not exists public.centers (
  id        smallint primary key,          -- código oficial del centro
  name      text     not null,
  regional  text     not null,
  city      text     not null,
  lat       double precision,
  lng       double precision,
  active    boolean  not null default true
);

comment on table public.centers is
  'Catálogo de centros. lat/lng son la sede: sirven de origen para el radio de '
  'los parches cuando el usuario no comparte ubicación.';


-- -----------------------------------------------------------------------------
-- Programas de formación
-- -----------------------------------------------------------------------------
create table if not exists public.programs (
  code      text primary key,              -- código del programa
  name      text not null,
  level     text check (level in ('tecnico','tecnologo','especializacion','complementaria')),
  area      text,                          -- red de conocimiento
  active    boolean not null default true
);


-- -----------------------------------------------------------------------------
-- Intereses (los usa el cálculo de afinidad; el usuario elige, no inventa)
-- -----------------------------------------------------------------------------
create table if not exists public.interests (
  id       smallint generated always as identity primary key,
  slug     citext unique not null check (slug ~ '^[a-z0-9-]{2,40}$'),
  name     text   not null,
  category text   not null check (category in
             ('deporte','arte','estudio','comida','tecnologia','social','bienestar')),
  active   boolean not null default true
);


-- -----------------------------------------------------------------------------
-- Padrón: la única fuente que confirma que una ficha existe en un centro.
-- Se carga por importación administrativa (CSV de coordinación académica).
-- -----------------------------------------------------------------------------
create table if not exists public.roster (
  center_id    smallint not null references public.centers(id),
  ficha        text     not null check (ficha ~ '^[0-9]{6,8}$'),
  program_code text     references public.programs(code),
  jornada      text     check (jornada in ('manana','tarde','noche','madrugada','virtual')),
  starts_on    date,
  ends_on      date,
  primary key (center_id, ficha)
);


-- -----------------------------------------------------------------------------
-- Configuración por centro: cada centro decide qué habilita. Los interruptores
-- sensibles (modo cita, parches mixtos) nacen en false a propósito.
-- -----------------------------------------------------------------------------
create table if not exists public.center_config (
  center_id                smallint primary key references public.centers(id) on delete cascade,

  modo_cita_aprendices     boolean not null default false,  -- swipe romántico entre aprendices mayores de edad
  modo_cita_equipo         boolean not null default false,  -- ídem entre funcionarios
  parches_mixtos           boolean not null default false,  -- un parche donde conviven roles (solo lo crea staff)
  radio_max_metros         integer not null default 3000 check (radio_max_metros between 200 and 50000),
  cupo_max_parche          smallint not null default 30 check (cupo_max_parche between 2 and 200),
  parches_por_dia          smallint not null default 3 check (parches_por_dia between 1 and 20),
  swipes_por_dia           smallint not null default 60 check (swipes_por_dia between 10 and 500),
  horas_vida_chat_parche   smallint not null default 24 check (horas_vida_chat_parche between 1 and 168),

  updated_at               timestamptz not null default now()
);

comment on table public.center_config is
  'Interruptor institucional. El modo cita está apagado por defecto: se enciende '
  'por centro cuando bienestar lo aprueba, nunca por decisión del equipo de producto.';


-- -----------------------------------------------------------------------------
-- Semilla mínima de desarrollo (reemplazar con datos reales antes del piloto)
-- -----------------------------------------------------------------------------
insert into public.centers (id, name, regional, city, lat, lng) values
  (9101, 'Centro de Servicios Financieros', 'Distrito Capital', 'Bogotá',  4.6486, -74.0870),
  (9207, 'Centro de Diseño y Metrología',   'Distrito Capital', 'Bogotá',  4.6097, -74.0817),
  (9302, 'Centro de Comercio',              'Antioquia',        'Medellín', 6.2518, -75.5636)
on conflict (id) do nothing;

insert into public.center_config (center_id) select id from public.centers
on conflict (center_id) do nothing;

insert into public.interests (slug, name, category) values
  ('futbol','Fútbol','deporte'), ('gym','Gimnasio','deporte'), ('ciclismo','Ciclismo','deporte'),
  ('musica','Música','arte'), ('fotografia','Fotografía','arte'), ('baile','Baile','arte'),
  ('desayunos','Desayunos','comida'), ('cafe','Café','comida'),
  ('programacion','Programación','tecnologia'), ('diseno','Diseño','tecnologia'),
  ('ingles','Inglés','estudio'), ('emprendimiento','Emprendimiento','estudio'),
  ('videojuegos','Videojuegos','social'), ('voluntariado','Voluntariado','bienestar')
on conflict (slug) do nothing;
