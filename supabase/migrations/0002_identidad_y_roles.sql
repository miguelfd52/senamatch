set search_path = public, extensions;

-- =============================================================================
-- SENA MATCH v3 · 0002 · Identidad: perfiles, roles y esferas
-- =============================================================================
-- Tres reglas que esta migración hace cumplir en la base, no en el cliente:
--
--   1. El rol NUNCA llega del formulario de registro. Se deriva del dominio del
--      correo institucional ya verificado por OTP (ver handle_new_user()).
--   2. La esfera (aprendices | equipo) es columna generada a partir del rol.
--      No se puede editar. De ella cuelga toda la separación de mundos.
--   3. La edad se guarda como fecha de nacimiento, no como número. El modo cita
--      consulta la edad calculada; un menor jamás entra en ese mazo.
-- =============================================================================

create type public.account_role as enum
  ('aprendiz','egresado','instructor','bienestar','moderador','admin');

create type public.sphere as enum ('aprendices','equipo');

create type public.verify_level as enum
  ('correo','ficha','institucional');   -- correo = OTP; ficha = padrón; institucional = aval humano

create type public.profile_status as enum ('activo','pausado','suspendido','eliminado');

-- Para qué usa la app cada persona. Es explícito y multiselección: sin intención
-- declarada no hay mazo, y solo hay match si ambas partes marcaron lo mismo.
create type public.intent as enum ('cita','amistad','estudio','deporte','colegas');


-- -----------------------------------------------------------------------------
-- Perfiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,

  email         citext unique not null,
  handle        citext unique not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  full_name     text not null check (char_length(full_name) between 3 and 80),

  -- Gobernados por el servidor. El cliente no tiene GRANT de UPDATE sobre estas
  -- tres columnas: ver 0007_rls.sql.
  role          public.account_role not null default 'aprendiz',
  verification  public.verify_level not null default 'correo',
  status        public.profile_status not null default 'activo',

  -- Columna generada: la esfera es consecuencia del rol, no una opción.
  esfera        public.sphere not null
                generated always as (
                  case when role in ('aprendiz','egresado')
                       then 'aprendices'::public.sphere
                       else 'equipo'::public.sphere end
                ) stored,

  birth_date    date check (
                  birth_date is null
                  or (birth_date <= current_date - interval '14 years'
                  and birth_date >= current_date - interval '100 years')),

  -- Ubicación institucional
  center_id     smallint references public.centers(id),
  program_code  text     references public.programs(code),
  ficha         text     check (ficha ~ '^[0-9]{6,8}$'),
  jornada       text     check (jornada in ('manana','tarde','noche','madrugada','virtual')),
  etapa         text     check (etapa in ('lectiva','productiva','egresado')),
  area          text,                     -- red de conocimiento del instructor
  cargo         text,                     -- Instructor, Coordinador, Bienestar...

  -- Perfil social
  bio           text check (char_length(bio) <= 500),
  avatar_path   text,                     -- ruta en Storage, nunca URL firmada
  fotos         text[] not null default '{}' check (cardinality(fotos) <= 6),

  -- Intenciones activas. Sin esto el mazo devuelve vacío.
  intenciones   public.intent[] not null default '{}',

  -- Última ubicación aproximada (redondeada a ~100 m antes de guardar; ver 0005)
  last_lat      double precision check (last_lat between -90 and 90),
  last_lng      double precision check (last_lng between -180 and 180),
  last_geo_at   timestamptz,

  -- Reputación de parches: quien confirma y no llega, pierde acceso a cupos.
  asistencias   integer not null default 0 check (asistencias >= 0),
  inasistencias integer not null default 0 check (inasistencias >= 0),

  onboarding_completed_at timestamptz,
  last_active_at timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index profiles_center_idx on public.profiles (center_id) where status = 'activo';
create index profiles_esfera_idx on public.profiles (esfera, center_id);
create index profiles_intent_idx on public.profiles using gin (intenciones);
create index profiles_activo_idx on public.profiles (last_active_at desc);

comment on column public.profiles.esfera is
  'aprendices | equipo. Frontera dura: el descubrimiento 1 a 1 nunca la cruza.';
comment on column public.profiles.intenciones is
  'Lo que la persona vino a buscar. El match exige coincidencia de intención, '
  'asi que un estudio nunca hace match con un cita.';


-- -----------------------------------------------------------------------------
-- Intereses del perfil (insumo del cálculo de afinidad)
-- -----------------------------------------------------------------------------
create table public.profile_interests (
  profile_id  uuid     not null references public.profiles(id) on delete cascade,
  interest_id smallint not null references public.interests(id) on delete cascade,
  primary key (profile_id, interest_id)
);

create index profile_interests_interest_idx on public.profile_interests (interest_id);


-- -----------------------------------------------------------------------------
-- Rol a partir del dominio institucional. Única fuente de verdad del rol.
-- -----------------------------------------------------------------------------
create or replace function public.rol_por_dominio(p_email text)
returns public.account_role
language sql immutable as $fn$
  select case
    when lower(p_email) like '%@misena.edu.co' then 'aprendiz'::public.account_role
    when lower(p_email) like '%@sena.edu.co'   then 'instructor'::public.account_role
    else null
  end;
$fn$;

comment on function public.rol_por_dominio is
  'misena.edu.co pertenece a aprendices; sena.edu.co a funcionarios. Un correo '
  'de funcionario entra como instructor SIN verificacion institucional: hasta '
  'que coordinacion lo avale no ve la seccion exclusiva del equipo.';


-- -----------------------------------------------------------------------------
-- Alta de cuenta. SECURITY DEFINER sobre auth.users: es el único punto donde se
-- escribe `role`, y solo lee del cliente el nombre, saneado.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, extensions, auth as $fn$
declare
  v_role   public.account_role;
  v_handle citext;
  v_nombre text;
begin
  v_role := public.rol_por_dominio(new.email);

  if v_role is null then
    raise exception 'Solo se admiten correos @misena.edu.co o @sena.edu.co'
      using errcode = '22023';
  end if;

  v_nombre := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  v_nombre := coalesce(v_nombre, split_part(new.email, '@', 1));

  -- Handle base a partir del correo, único por sufijo numérico.
  v_handle := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g');
  v_handle := left(coalesce(nullif(v_handle, ''), 'usuario'), 16);
  if char_length(v_handle) < 3 then
    v_handle := v_handle || '000';
  end if;

  while exists (select 1 from public.profiles where handle = v_handle) loop
    v_handle := left(v_handle, 15) || floor(random() * 10)::text;
  end loop;

  insert into public.profiles (id, email, handle, full_name, role)
  values (new.id, new.email, v_handle, left(v_nombre, 80), v_role);

  return new;
end $fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at := now();
  return new;
end $fn$;

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.tg_touch_updated_at();


-- -----------------------------------------------------------------------------
-- Verificación por padrón: sube de 'correo' a 'ficha' si el par centro+ficha
-- existe. SECURITY DEFINER porque `roster` no es legible por el cliente.
-- -----------------------------------------------------------------------------
create or replace function public.verificar_ficha(p_center smallint, p_ficha text)
returns public.verify_level
language plpgsql security definer set search_path = public, extensions as $fn$
declare v_ok boolean;
begin
  if auth.uid() is null then
    raise exception 'sin sesion' using errcode = '28000';
  end if;

  select exists (
    select 1 from public.roster
     where center_id = p_center
       and ficha = p_ficha
       and (ends_on is null or ends_on >= current_date)
  ) into v_ok;

  if not v_ok then
    raise exception 'La ficha % no aparece activa en ese centro', p_ficha
      using errcode = '22023';
  end if;

  update public.profiles
     set center_id    = p_center,
         ficha        = p_ficha,
         program_code = coalesce(program_code,
                          (select program_code from public.roster
                            where center_id = p_center and ficha = p_ficha)),
         verification = greatest(verification, 'ficha'::public.verify_level)
   where id = auth.uid();

  return 'ficha';
end $fn$;
