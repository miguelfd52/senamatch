set search_path = public, extensions;

-- =============================================================================
-- SENA MATCH v3 · 0003 · Visibilidad, bloqueos y reportes
-- =============================================================================
-- Este archivo concentra las funciones que deciden QUIÉN VE A QUIÉN. Todas las
-- políticas RLS de 0007 las llaman; ninguna regla de visibilidad se reimplementa
-- en el cliente (el cliente solo las repite para no mostrar botones inútiles).
--
-- La regla que no se negocia:
--   perfil.esfera('aprendices')  X  perfil.esfera('equipo')  = INVISIBLE
-- en swipe, en mazo, en chat 1 a 1 y en parche no institucional.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Lecturas del propio contexto (STABLE: el planificador las cachea por consulta)
-- -----------------------------------------------------------------------------
create or replace function public.mi_rol()
returns public.account_role
language sql stable security definer set search_path = public, extensions as $fn$
  select role from public.profiles where id = auth.uid();
$fn$;

create or replace function public.mi_esfera()
returns public.sphere
language sql stable security definer set search_path = public, extensions as $fn$
  select esfera from public.profiles where id = auth.uid();
$fn$;

create or replace function public.mi_centro()
returns smallint
language sql stable security definer set search_path = public, extensions as $fn$
  select center_id from public.profiles where id = auth.uid();
$fn$;

create or replace function public.es_staff()
returns boolean
language sql stable security definer set search_path = public, extensions as $fn$
  select coalesce(public.mi_rol() in ('instructor','bienestar','moderador','admin'), false);
$fn$;

create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = public, extensions as $fn$
  select coalesce(public.mi_rol() in ('moderador','admin'), false);
$fn$;

-- Participar = tener sesión, perfil activo, centro y onboarding cerrado.
create or replace function public.puede_participar()
returns boolean
language sql stable security definer set search_path = public, extensions as $fn$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and status = 'activo'
       and center_id is not null
       and onboarding_completed_at is not null
  );
$fn$;


-- -----------------------------------------------------------------------------
-- Edad. No hay columna `edad`: se calcula, y el modo cita depende de esto.
-- -----------------------------------------------------------------------------
create or replace function public.edad(p_id uuid)
returns integer
language sql stable security definer set search_path = public, extensions as $fn$
  select extract(year from age(current_date, birth_date))::int
    from public.profiles where id = p_id;
$fn$;

create or replace function public.es_mayor_de_edad(p_id uuid)
returns boolean
language sql stable security definer set search_path = public, extensions as $fn$
  select coalesce(public.edad(p_id) >= 18, false);
$fn$;


-- -----------------------------------------------------------------------------
-- Bloqueos. Simétricos en efecto: basta que exista en un sentido.
-- -----------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  reason     text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

create or replace function public.hay_bloqueo(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public, extensions as $fn$
  select exists (
    select 1 from public.blocks
     where (blocker_id = a and blocked_id = b)
        or (blocker_id = b and blocked_id = a)
  );
$fn$;


-- -----------------------------------------------------------------------------
-- Reportes y sanciones
-- -----------------------------------------------------------------------------
create type public.report_reason as enum
  ('acoso','contenido_sexual','suplantacion','spam','discurso_de_odio',
   'menor_en_modo_cita','cruce_de_rol','no_asistio','otro');

create type public.report_status as enum ('pendiente','en_revision','resuelto','descartado');

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles(id) on delete cascade,
  reported_id  uuid references public.profiles(id) on delete cascade,
  activity_id  uuid,                     -- FK diferida a activities (0005)
  message_id   uuid,                     -- FK diferida a messages (0006)
  reason       public.report_reason not null,
  detail       text check (char_length(detail) <= 1000),
  status       public.report_status not null default 'pendiente',
  resolved_by  uuid references public.profiles(id),
  resolved_at  timestamptz,
  resolution   text check (char_length(resolution) <= 1000),
  created_at   timestamptz not null default now(),
  check (reported_id is not null or activity_id is not null)
);

create index reports_pendientes_idx on public.reports (status, created_at desc)
  where status in ('pendiente','en_revision');
create index reports_reported_idx on public.reports (reported_id);

-- Un reporte por reportante/reportado/día: corta las oleadas de reportes.
create unique index reports_antiflood_idx
  on public.reports (reporter_id, reported_id, (created_at::date))
  where reported_id is not null;


-- -----------------------------------------------------------------------------
-- Bitácora de moderación. Toda acción de staff queda escrita.
-- -----------------------------------------------------------------------------
create table public.moderation_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid not null references public.profiles(id),
  target_id   uuid references public.profiles(id),
  action      text not null,
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index moderation_log_target_idx on public.moderation_log (target_id, created_at desc);


-- -----------------------------------------------------------------------------
-- Cambio de estado de una cuenta. El panel de administración NO hace UPDATE
-- directo sobre profiles: pasa por aquí, que verifica rol y deja rastro.
-- -----------------------------------------------------------------------------
create or replace function public.admin_cambiar_estado(
  p_target uuid,
  p_status public.profile_status,
  p_motivo text default null
)
returns void
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if not public.es_admin() then
    raise exception 'requiere rol moderador o admin' using errcode = '42501';
  end if;
  if p_target = auth.uid() then
    raise exception 'no puedes cambiar tu propio estado' using errcode = '42501';
  end if;

  update public.profiles set status = p_status where id = p_target;

  insert into public.moderation_log (actor_id, target_id, action, payload)
  values (auth.uid(), p_target, 'estado:' || p_status::text,
          jsonb_build_object('motivo', p_motivo));
end $fn$;


-- -----------------------------------------------------------------------------
-- Aval institucional de un instructor. Sin esto no entra a la sección Equipo.
-- -----------------------------------------------------------------------------
create or replace function public.admin_avalar_instructor(p_target uuid, p_cargo text)
returns void
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if not public.es_admin() then
    raise exception 'requiere rol moderador o admin' using errcode = '42501';
  end if;

  update public.profiles
     set verification = 'institucional',
         cargo        = coalesce(p_cargo, cargo)
   where id = p_target
     and role in ('instructor','bienestar');

  if not found then
    raise exception 'el perfil no es de un funcionario' using errcode = '22023';
  end if;

  insert into public.moderation_log (actor_id, target_id, action, payload)
  values (auth.uid(), p_target, 'aval_institucional', jsonb_build_object('cargo', p_cargo));
end $fn$;


-- =============================================================================
-- LA FUNCIÓN CENTRAL: ¿puede A ver el perfil de B para descubrimiento 1 a 1?
-- =============================================================================
create or replace function public.puedo_ver_perfil(p_otro uuid, p_intent public.intent)
returns boolean
language plpgsql stable security definer set search_path = public, extensions as $fn$
declare
  yo    public.profiles;
  otro  public.profiles;
  cfg   public.center_config;
begin
  select * into yo   from public.profiles where id = auth.uid();
  select * into otro from public.profiles where id = p_otro;

  if yo.id is null or otro.id is null then return false; end if;
  if yo.id = otro.id then return false; end if;

  -- 1. Ambas cuentas vivas y con onboarding cerrado.
  if yo.status <> 'activo' or otro.status <> 'activo' then return false; end if;
  if otro.onboarding_completed_at is null then return false; end if;

  -- 2. Frontera de esferas. Aquí muere cualquier cruce aprendiz <-> instructor.
  if yo.esfera <> otro.esfera then return false; end if;

  -- 3. Mismo centro de formación (el descubrimiento es local por diseño).
  if yo.center_id is distinct from otro.center_id then return false; end if;

  -- 4. Intención declarada por ambas partes.
  if not (p_intent = any (yo.intenciones)) then return false; end if;
  if not (p_intent = any (otro.intenciones)) then return false; end if;

  -- 5. Bloqueos.
  if public.hay_bloqueo(yo.id, otro.id) then return false; end if;

  -- 6. Reglas del modo cita.
  if p_intent = 'cita' then
    select * into cfg from public.center_config where center_id = yo.center_id;

    if yo.esfera = 'aprendices' and not coalesce(cfg.modo_cita_aprendices, false)
      then return false; end if;
    if yo.esfera = 'equipo' and not coalesce(cfg.modo_cita_equipo, false)
      then return false; end if;

    -- Ningún menor de edad entra al modo cita, ni como quien mira ni como visto.
    if not public.es_mayor_de_edad(yo.id) or not public.es_mayor_de_edad(otro.id)
      then return false; end if;
  end if;

  -- 7. 'colegas' es exclusivo de la esfera equipo con aval institucional.
  if p_intent = 'colegas' then
    if yo.esfera <> 'equipo' or otro.esfera <> 'equipo' then return false; end if;
    if yo.verification <> 'institucional' or otro.verification <> 'institucional'
      then return false; end if;
  end if;

  return true;
end $fn$;

comment on function public.puedo_ver_perfil is
  'Puerta unica del descubrimiento 1 a 1. Si esta funcion dice false, ni el mazo '
  'ni el swipe ni el match pueden ocurrir: 0004 y 0007 la invocan siempre.';
