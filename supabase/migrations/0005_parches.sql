set search_path = public, extensions;

-- =============================================================================
-- SENA MATCH v3 · 0005 · Parches: actividades grupales efímeras
-- =============================================================================
-- Un parche es una invitación con fecha, lugar, cupo y caducidad:
-- «¿Quién para desayunar en la cafetería a las 9:00?».
--
-- Decisiones de diseño que el código hace cumplir:
--   · Efímero de verdad: nace con `expires_at`; después de esa hora no admite
--     inscripciones y su chat se archiva (0008 lo hace por cron).
--   · El cupo se respeta bajo concurrencia: unirse_parche() bloquea la fila de
--     la actividad antes de contar. Sin eso, dos personas entran al último cupo.
--   · Un parche NO cruza esferas salvo que lo cree bienestar/instructor y el
--     centro tenga `parches_mixtos` encendido. Ese caso queda marcado y auditado.
--   · El contador de confirmados está desnormalizado y lo mantiene un trigger:
--     el feed necesita "quedan 2 cupos" sin contar filas en cada consulta.
-- =============================================================================

create type public.activity_kind as enum
  ('desayuno','almuerzo','cafe','estudio','deporte','integracion',
   'cultural','tramite','otro');

create type public.activity_visibility as enum
  ('centro','ficha','programa','enlace','institucional');

create type public.activity_status as enum
  ('abierto','lleno','cerrado','en_curso','finalizado','cancelado','vencido');

create type public.participant_status as enum
  ('solicitado','confirmado','rechazado','cancelado','asistio','no_asistio');


-- -----------------------------------------------------------------------------
-- Actividades
-- -----------------------------------------------------------------------------
create table public.activities (
  id            uuid primary key default gen_random_uuid(),
  host_id       uuid not null references public.profiles(id) on delete cascade,

  title         text not null check (char_length(title) between 5 and 80),
  description   text check (char_length(description) <= 600),
  kind          public.activity_kind not null,

  -- Alcance. `esfera` la fija un trigger a partir del anfitrión: no es editable.
  center_id     smallint not null references public.centers(id),
  esfera        public.sphere not null,
  mixto         boolean not null default false,
  visibility    public.activity_visibility not null default 'centro',
  ficha         text check (ficha ~ '^[0-9]{6,8}$'),
  program_code  text references public.programs(code),
  join_code     text unique check (join_code ~ '^[A-Z0-9]{6}$'),  -- solo si visibility='enlace'

  -- Dónde
  place_label   text not null check (char_length(place_label) between 3 and 80),
  lat           double precision check (lat between -90 and 90),
  lng           double precision check (lng between -180 and 180),

  -- Cuándo
  starts_at     timestamptz not null,
  duration_min  smallint not null default 60 check (duration_min between 15 and 480),
  expires_at    timestamptz not null
                generated always as (starts_at + make_interval(mins => duration_min)) stored,

  -- Cupo
  capacity      smallint not null check (capacity between 2 and 200),
  confirmados   smallint not null default 1 check (confirmados >= 0),
  aprobacion    boolean not null default false,   -- true = el anfitrión aprueba uno a uno
  solo_verificados boolean not null default false,

  status        public.activity_status not null default 'abierto',
  cancel_reason text check (char_length(cancel_reason) <= 200),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  check (starts_at > created_at - interval '5 minutes'),
  check (visibility <> 'enlace'    or join_code is not null),
  check (visibility <> 'ficha'     or ficha is not null),
  check (visibility <> 'programa'  or program_code is not null),
  check (not mixto or visibility = 'institucional')
);

create index activities_feed_idx on public.activities (center_id, esfera, starts_at)
  where status in ('abierto','lleno');
create index activities_host_idx on public.activities (host_id, created_at desc);
create index activities_vence_idx on public.activities (expires_at)
  where status in ('abierto','lleno','en_curso');
create index activities_geo_idx on public.activities
  using gist (ll_to_earth(lat, lng)) where lat is not null;

create trigger activities_touch
  before update on public.activities
  for each row execute function public.tg_touch_updated_at();

comment on table public.activities is
  'Parches. Efimeros por diseno: expires_at es columna generada y el cron de '
  '0008 los pasa a finalizado/vencido sin intervencion humana.';


-- -----------------------------------------------------------------------------
-- Participantes
-- -----------------------------------------------------------------------------
create table public.activity_participants (
  activity_id  uuid not null references public.activities(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  rol          text not null default 'asistente'
               check (rol in ('anfitrion','copiloto','asistente')),
  status       public.participant_status not null default 'solicitado',
  nota         text check (char_length(nota) <= 200),
  joined_at    timestamptz not null default now(),
  decided_at   timestamptz,
  primary key (activity_id, profile_id)
);

create index activity_participants_profile_idx
  on public.activity_participants (profile_id, status);
create index activity_participants_confirmados_idx
  on public.activity_participants (activity_id) where status = 'confirmado';

-- FK que quedaron diferidas en 0003
alter table public.reports
  add constraint reports_activity_fk
  foreign key (activity_id) references public.activities(id) on delete cascade;


-- -----------------------------------------------------------------------------
-- La esfera del parche la decide el anfitrión, no el formulario
-- -----------------------------------------------------------------------------
create or replace function public.tg_activity_esfera()
returns trigger language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_host public.profiles;
  v_cfg  public.center_config;
begin
  select * into v_host from public.profiles where id = new.host_id;

  new.esfera    := v_host.esfera;
  new.center_id := coalesce(v_host.center_id, new.center_id);

  if new.mixto then
    select * into v_cfg from public.center_config where center_id = new.center_id;
    if not coalesce(v_cfg.parches_mixtos, false) then
      raise exception 'este centro no permite parches mixtos' using errcode = '42501';
    end if;
    if v_host.role not in ('instructor','bienestar','moderador','admin')
       or v_host.verification <> 'institucional' then
      raise exception 'solo bienestar o un instructor avalado crea parches mixtos'
        using errcode = '42501';
    end if;
  end if;

  return new;
end $fn$;

create trigger activities_esfera
  before insert on public.activities
  for each row execute function public.tg_activity_esfera();


-- -----------------------------------------------------------------------------
-- Contador de confirmados + paso automático a 'lleno'
-- -----------------------------------------------------------------------------
create or replace function public.tg_recontar_confirmados()
returns trigger language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_act uuid := coalesce(new.activity_id, old.activity_id);
  v_n   smallint;
begin
  select count(*)::smallint into v_n
    from public.activity_participants
   where activity_id = v_act and status in ('confirmado','asistio');

  update public.activities
     set confirmados = v_n,
         status = case
           when status in ('cancelado','finalizado','vencido','cerrado') then status
           when v_n >= capacity then 'lleno'::public.activity_status
           else 'abierto'::public.activity_status
         end
   where id = v_act;

  return null;
end $fn$;

create trigger activity_participants_recuento
  after insert or update of status or delete on public.activity_participants
  for each row execute function public.tg_recontar_confirmados();


-- =============================================================================
-- ¿Puedo ver este parche?
-- =============================================================================
create or replace function public.puedo_ver_parche(p_act uuid)
returns boolean
language plpgsql stable security definer set search_path = public, extensions as $fn$
declare
  a  public.activities;
  yo public.profiles;
begin
  select * into a  from public.activities where id = p_act;
  select * into yo from public.profiles   where id = auth.uid();
  if a.id is null or yo.id is null then return false; end if;

  -- Quien ya está dentro siempre lo ve, aunque cambien las reglas después.
  if exists (select 1 from public.activity_participants
              where activity_id = p_act and profile_id = yo.id
                and status in ('solicitado','confirmado','asistio')) then
    return true;
  end if;

  if yo.status <> 'activo' then return false; end if;
  if a.center_id is distinct from yo.center_id then return false; end if;
  if public.hay_bloqueo(yo.id, a.host_id) then return false; end if;

  -- Frontera de esferas: solo la cruza un parche institucional mixto.
  if not a.mixto and a.esfera <> yo.esfera then return false; end if;

  return case a.visibility
    when 'centro'        then true
    when 'institucional' then true
    when 'ficha'         then a.ficha        = yo.ficha
    when 'programa'      then a.program_code = yo.program_code
    when 'enlace'        then false          -- solo por código, ver unirse_por_codigo()
    else false
  end;
end $fn$;


-- =============================================================================
-- Crear un parche
-- =============================================================================
create or replace function public.crear_parche(
  p_title        text,
  p_kind         public.activity_kind,
  p_place_label  text,
  p_starts_at    timestamptz,
  p_capacity     smallint,
  p_description  text default null,
  p_duration_min smallint default 60,
  p_visibility   public.activity_visibility default 'centro',
  p_lat          double precision default null,
  p_lng          double precision default null,
  p_aprobacion   boolean default false,
  p_mixto        boolean default false
)
returns public.activities
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_me   uuid := auth.uid();
  v_yo   public.profiles;
  v_cfg  public.center_config;
  v_hoy  integer;
  v_act  public.activities;
begin
  if not public.puede_participar() then
    raise exception 'completa tu perfil antes de crear un parche' using errcode = '42501';
  end if;

  select * into v_yo  from public.profiles     where id = v_me;
  select * into v_cfg from public.center_config where center_id = v_yo.center_id;

  if p_starts_at < now() - interval '5 minutes' then
    raise exception 'la hora del parche ya paso' using errcode = '22023';
  end if;
  if p_starts_at > now() + interval '14 days' then
    raise exception 'un parche se publica con maximo 14 dias de anticipacion'
      using errcode = '22023';
  end if;
  if p_capacity > coalesce(v_cfg.cupo_max_parche, 30) then
    raise exception 'el cupo maximo en este centro es %', v_cfg.cupo_max_parche
      using errcode = '22023';
  end if;

  select count(*) into v_hoy from public.activities
   where host_id = v_me and created_at >= date_trunc('day', now())
     and status <> 'cancelado';

  if v_hoy >= coalesce(v_cfg.parches_por_dia, 3) then
    raise exception 'ya publicaste % parches hoy', v_hoy using errcode = '53400';
  end if;

  insert into public.activities (
    host_id, title, description, kind, center_id, esfera, mixto, visibility,
    ficha, program_code, join_code, place_label, lat, lng,
    starts_at, duration_min, capacity, aprobacion
  ) values (
    v_me, p_title, p_description, p_kind, v_yo.center_id, v_yo.esfera, p_mixto,
    case when p_mixto then 'institucional'::public.activity_visibility else p_visibility end,
    case when p_visibility = 'ficha'    then v_yo.ficha        end,
    case when p_visibility = 'programa' then v_yo.program_code end,
    case when p_visibility = 'enlace'
         then upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)) end,
    p_place_label,
    -- La ubicación se redondea a ~100 m: nadie necesita la coordenada exacta.
    round(p_lat::numeric, 3)::double precision,
    round(p_lng::numeric, 3)::double precision,
    p_starts_at, p_duration_min, p_capacity, p_aprobacion
  )
  returning * into v_act;

  insert into public.activity_participants (activity_id, profile_id, rol, status, decided_at)
  values (v_act.id, v_me, 'anfitrion', 'confirmado', now());

  return v_act;
end $fn$;


-- =============================================================================
-- Unirse: el punto crítico de concurrencia
-- =============================================================================
create or replace function public.unirse_parche(p_act uuid, p_nota text default null)
returns public.activity_participants
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_me  uuid := auth.uid();
  v_yo  public.profiles;
  a     public.activities;
  v_n   smallint;
  v_row public.activity_participants;
begin
  if not public.puede_participar() then
    raise exception 'completa tu perfil antes de unirte' using errcode = '42501';
  end if;
  if not public.puedo_ver_parche(p_act) then
    raise exception 'ese parche no esta disponible para ti' using errcode = '42501';
  end if;

  -- El candado: nadie más cuenta cupos de esta actividad hasta que terminemos.
  select * into a from public.activities where id = p_act for update;

  if a.status not in ('abierto','lleno') then
    raise exception 'el parche esta %', a.status using errcode = '22023';
  end if;
  if a.starts_at <= now() then
    raise exception 'el parche ya empezo' using errcode = '22023';
  end if;

  select * into v_yo from public.profiles where id = v_me;
  if a.solo_verificados and v_yo.verification = 'correo' then
    raise exception 'este parche pide verificacion de ficha' using errcode = '42501';
  end if;

  -- Reputación: tres plantones seguidos y solo entras a parches con aprobación.
  if v_yo.inasistencias >= 3 and v_yo.inasistencias > v_yo.asistencias and not a.aprobacion then
    raise exception 'tienes % inasistencias: pide cupo en parches con aprobacion',
      v_yo.inasistencias using errcode = '42501';
  end if;

  select count(*)::smallint into v_n
    from public.activity_participants
   where activity_id = p_act and status in ('confirmado','asistio');

  if v_n >= a.capacity and not a.aprobacion then
    raise exception 'no quedan cupos' using errcode = '53400';
  end if;

  insert into public.activity_participants (activity_id, profile_id, status, nota, decided_at)
  values (p_act, v_me,
          case when a.aprobacion then 'solicitado' else 'confirmado' end,
          p_nota,
          case when a.aprobacion then null else now() end)
  -- Quien se salió puede volver; a quien rechazaron, no lo reinscribe un reintento.
  on conflict (activity_id, profile_id) do update
     set status     = excluded.status,
         nota       = excluded.nota,
         decided_at = excluded.decided_at
   where activity_participants.status = 'cancelado'
  returning * into v_row;

  if v_row.profile_id is null then
    select * into v_row from public.activity_participants
     where activity_id = p_act and profile_id = v_me;
  end if;

  return v_row;
end $fn$;


-- -----------------------------------------------------------------------------
-- Unirse con código (visibility = 'enlace'). No pasa por puedo_ver_parche()
-- —el código ES la llave— pero sigue exigiendo mismo centro y esfera.
-- -----------------------------------------------------------------------------
create or replace function public.unirse_por_codigo(p_code text)
returns public.activity_participants
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  a    public.activities;
  v_yo public.profiles;
  v_n  smallint;
  v_row public.activity_participants;
begin
  if not public.puede_participar() then
    raise exception 'completa tu perfil antes de unirte' using errcode = '42501';
  end if;

  select * into a from public.activities
   where join_code = upper(p_code) for update;

  if a.id is null or a.status not in ('abierto','lleno') or a.expires_at <= now() then
    raise exception 'codigo invalido o parche cerrado' using errcode = '22023';
  end if;

  select * into v_yo from public.profiles where id = auth.uid();

  if a.center_id is distinct from v_yo.center_id then
    raise exception 'ese parche es de otro centro' using errcode = '42501';
  end if;
  if not a.mixto and a.esfera <> v_yo.esfera then
    raise exception 'ese parche no corresponde a tu perfil' using errcode = '42501';
  end if;
  if public.hay_bloqueo(v_yo.id, a.host_id) then
    raise exception 'no puedes unirte a este parche' using errcode = '42501';
  end if;

  select count(*)::smallint into v_n
    from public.activity_participants
   where activity_id = a.id and status in ('confirmado','asistio');

  if v_n >= a.capacity and not a.aprobacion then
    raise exception 'no quedan cupos' using errcode = '53400';
  end if;

  insert into public.activity_participants (activity_id, profile_id, status, decided_at)
  values (a.id, v_yo.id,
          case when a.aprobacion then 'solicitado' else 'confirmado' end,
          case when a.aprobacion then null else now() end)
  on conflict (activity_id, profile_id) do update
     set status = excluded.status, decided_at = excluded.decided_at
   where activity_participants.status = 'cancelado'
  returning * into v_row;

  if v_row.profile_id is null then
    select * into v_row from public.activity_participants
     where activity_id = a.id and profile_id = v_yo.id;
  end if;

  return v_row;
end $fn$;


-- -----------------------------------------------------------------------------
-- Salir / cancelar / aprobar / asistencia
-- -----------------------------------------------------------------------------
create or replace function public.salir_parche(p_act uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $fn$
declare a public.activities;
begin
  select * into a from public.activities where id = p_act;

  if a.host_id = auth.uid() then
    raise exception 'el anfitrion no sale: cancela el parche' using errcode = '22023';
  end if;

  update public.activity_participants
     set status = 'cancelado', decided_at = now()
   where activity_id = p_act and profile_id = auth.uid();
end $fn$;


create or replace function public.cancelar_parche(p_act uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  update public.activities
     set status = 'cancelado', cancel_reason = p_motivo
   where id = p_act
     and (host_id = auth.uid() or public.es_admin());

  if not found then
    raise exception 'solo el anfitrion o un moderador cancela' using errcode = '42501';
  end if;
end $fn$;


create or replace function public.decidir_solicitud(
  p_act uuid, p_profile uuid, p_aprobar boolean
)
returns void
language plpgsql security definer set search_path = public, extensions as $fn$
declare a public.activities;
begin
  select * into a from public.activities where id = p_act for update;

  if a.host_id <> auth.uid() then
    raise exception 'solo el anfitrion decide' using errcode = '42501';
  end if;
  if p_aprobar and a.confirmados >= a.capacity then
    raise exception 'no quedan cupos' using errcode = '53400';
  end if;

  update public.activity_participants
     set status = case when p_aprobar then 'confirmado' else 'rechazado' end::public.participant_status,
         decided_at = now()
   where activity_id = p_act and profile_id = p_profile and status = 'solicitado';
end $fn$;


-- Asistencia: la marca el anfitrión al cerrar el parche y mueve la reputación.
create or replace function public.marcar_asistencia(
  p_act uuid, p_asistieron uuid[]
)
returns void
language plpgsql security definer set search_path = public, extensions as $fn$
declare a public.activities;
begin
  select * into a from public.activities where id = p_act;
  if a.host_id <> auth.uid() then
    raise exception 'solo el anfitrion marca asistencia' using errcode = '42501';
  end if;
  if a.starts_at > now() then
    raise exception 'el parche todavia no empieza' using errcode = '22023';
  end if;

  update public.activity_participants p
     set status = case when p.profile_id = any (p_asistieron)
                       then 'asistio' else 'no_asistio' end::public.participant_status
   where p.activity_id = p_act and p.status = 'confirmado';

  update public.profiles pr
     set asistencias   = pr.asistencias   + (case when pr.id = any (p_asistieron) then 1 else 0 end),
         inasistencias = pr.inasistencias + (case when pr.id = any (p_asistieron) then 0 else 1 end)
    from public.activity_participants p
   where p.activity_id = p_act and p.profile_id = pr.id and p.rol <> 'anfitrion';

  update public.activities set status = 'finalizado' where id = p_act;
end $fn$;


-- =============================================================================
-- El feed: parches vivos, cerca, ordenados por lo que empieza primero
-- =============================================================================
create or replace function public.feed_parches(
  p_radio_m integer default null,
  p_kinds   public.activity_kind[] default null,
  p_desde   timestamptz default null,
  p_hasta   timestamptz default null,
  p_limit   integer default 30
)
returns table (
  id           uuid,
  title        text,
  kind         public.activity_kind,
  place_label  text,
  starts_at    timestamptz,
  capacity     smallint,
  confirmados  smallint,
  cupos_libres smallint,
  status       public.activity_status,
  aprobacion   boolean,
  host_id      uuid,
  host_nombre  text,
  host_avatar  text,
  distancia_m  integer,
  ya_estoy     boolean
)
language sql stable security definer set search_path = public, extensions as $fn$
  with yo as (
    select p.id, p.last_lat, p.last_lng, c.lat as clat, c.lng as clng,
           coalesce(cfg.radio_max_metros, 3000) as radio
      from public.profiles p
      left join public.centers c        on c.id = p.center_id
      left join public.center_config cfg on cfg.center_id = p.center_id
     where p.id = auth.uid()
  )
  select a.id, a.title, a.kind, a.place_label, a.starts_at,
         a.capacity, a.confirmados,
         greatest(a.capacity - a.confirmados, 0)::smallint,
         a.status, a.aprobacion,
         h.id, h.full_name, h.avatar_path,
         case when a.lat is null then null else
           earth_distance(
             ll_to_earth(coalesce(yo.last_lat, yo.clat), coalesce(yo.last_lng, yo.clng)),
             ll_to_earth(a.lat, a.lng)
           )::int
         end,
         exists (select 1 from public.activity_participants ap
                  where ap.activity_id = a.id and ap.profile_id = auth.uid()
                    and ap.status in ('solicitado','confirmado','asistio'))
    from public.activities a
    join public.profiles h on h.id = a.host_id
    cross join yo
   where a.status in ('abierto','lleno')
     and a.expires_at > now()
     and public.puedo_ver_parche(a.id)
     and (p_kinds is null or a.kind = any (p_kinds))
     and (p_desde  is null or a.starts_at >= p_desde)
     and (p_hasta  is null or a.starts_at <= p_hasta)
     and (
       a.lat is null
       or coalesce(yo.last_lat, yo.clat) is null
       or earth_distance(
            ll_to_earth(coalesce(yo.last_lat, yo.clat), coalesce(yo.last_lng, yo.clng)),
            ll_to_earth(a.lat, a.lng)
          ) <= least(coalesce(p_radio_m, yo.radio), yo.radio)
     )
   order by a.starts_at asc
   limit least(coalesce(p_limit, 30), 100);
$fn$;
