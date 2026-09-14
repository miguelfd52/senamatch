set search_path = public, extensions;

-- =============================================================================
-- SENA MATCH v3 · 0004 · Swipe, afinidad y match
-- =============================================================================
-- Dos fallas del prototipo que aquí quedan cerradas:
--
--   1. El cliente creaba el match. Ahora `matches` no tiene política de INSERT:
--      la única vía es swipe(), que comprueba reciprocidad dentro de la misma
--      transacción y con la fila del otro bloqueada.
--   2. UNIQUE(user1_id, user2_id) dejaba guardar (A,B) y (B,A) como dos matches.
--      Ahora la pareja se normaliza a orden canónico a_id < b_id.
--
-- Y se añade la regla de producto: el match exige MISMA INTENCIÓN. Nadie acaba
-- en una conversación de citas por haber marcado "grupo de estudio".
-- =============================================================================

create type public.swipe_dir as enum ('pass','like','super');

create table public.swipes (
  swiper_id  uuid not null references public.profiles(id) on delete cascade,
  swiped_id  uuid not null references public.profiles(id) on delete cascade,
  intent     public.intent not null,
  direction  public.swipe_dir not null,
  created_at timestamptz not null default now(),
  primary key (swiper_id, swiped_id, intent),
  check (swiper_id <> swiped_id)
);

create index swipes_recibidos_idx on public.swipes (swiped_id, intent)
  where direction in ('like','super');
create index swipes_diarios_idx on public.swipes (swiper_id, created_at desc);


create table public.matches (
  id         uuid primary key default gen_random_uuid(),
  a_id       uuid not null references public.profiles(id) on delete cascade,
  b_id       uuid not null references public.profiles(id) on delete cascade,
  intent     public.intent not null,
  activo     boolean not null default true,
  cerrado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (a_id < b_id),                       -- orden canónico: una pareja, una fila
  unique (a_id, b_id, intent)
);

create index matches_a_idx on public.matches (a_id) where activo;
create index matches_b_idx on public.matches (b_id) where activo;

comment on table public.matches is
  'Sin politica de INSERT. La unica escritura viene de swipe(), SECURITY DEFINER.';


-- -----------------------------------------------------------------------------
-- Afinidad 0..100. Determinista, barata y explicable: el usuario ve por qué le
-- salió esa persona ("mismo centro · 3 intereses en común · misma jornada").
-- -----------------------------------------------------------------------------
create or replace function public.afinidad(p_a uuid, p_b uuid)
returns smallint
language sql stable security definer set search_path = public, extensions as $fn$
  with a as (select * from public.profiles where id = p_a),
       b as (select * from public.profiles where id = p_b),
       comunes as (
         select count(*)::int as n
           from public.profile_interests ia
           join public.profile_interests ib on ib.interest_id = ia.interest_id
          where ia.profile_id = p_a and ib.profile_id = p_b
       ),
       total as (
         select greatest(count(distinct interest_id), 1)::int as n
           from public.profile_interests
          where profile_id in (p_a, p_b)
       )
  select least(100, greatest(0,
      -- mismo centro: 25
      (case when a.center_id is not distinct from b.center_id then 25 else 0 end)
      -- intereses compartidos (Jaccard): hasta 35
    + (select round(35.0 * comunes.n / total.n)::int from comunes, total)
      -- misma jornada: 12  (poder coincidir en la cafetería vale más que la edad)
    + (case when a.jornada is not distinct from b.jornada and a.jornada is not null
            then 12 else 0 end)
      -- mismo programa 10, misma área 6
    + (case when a.program_code is not distinct from b.program_code and a.program_code is not null then 10
            when a.area is not distinct from b.area and a.area is not null then 6
            else 0 end)
      -- cercanía física < 1 km: 10
    + (case when a.last_lat is not null and b.last_lat is not null
              and earth_distance(ll_to_earth(a.last_lat, a.last_lng),
                                 ll_to_earth(b.last_lat, b.last_lng)) < 1000
            then 10 else 0 end)
      -- actividad reciente: 8 si estuvo en línea en las últimas 48 h
    + (case when b.last_active_at > now() - interval '48 hours' then 8 else 0 end)
  ))::smallint
  from a, b;
$fn$;


-- -----------------------------------------------------------------------------
-- El mazo. Devuelve solo perfiles que pasan puedo_ver_perfil() y que aún no han
-- sido evaluados con esa intención.
-- -----------------------------------------------------------------------------
create or replace function public.mazo(
  p_intent public.intent,
  p_limit  integer default 20
)
returns table (
  id           uuid,
  handle       citext,
  full_name    text,
  edad         integer,
  program_code text,
  jornada      text,
  bio          text,
  avatar_path  text,
  fotos        text[],
  intereses    text[],
  afinidad     smallint,
  te_dio_like  boolean
)
language sql stable security definer set search_path = public, extensions as $fn$
  select p.id,
         p.handle,
         p.full_name,
         public.edad(p.id),
         p.program_code,
         p.jornada,
         p.bio,
         p.avatar_path,
         p.fotos,
         coalesce(array_agg(i.name) filter (where i.name is not null), '{}'),
         public.afinidad(auth.uid(), p.id),
         exists (select 1 from public.swipes s
                  where s.swiper_id = p.id and s.swiped_id = auth.uid()
                    and s.intent = p_intent and s.direction in ('like','super'))
    from public.profiles p
    left join public.profile_interests pi on pi.profile_id = p.id
    left join public.interests i on i.id = pi.interest_id
   where public.puede_participar()
     and public.puedo_ver_perfil(p.id, p_intent)
     and not exists (select 1 from public.swipes s
                      where s.swiper_id = auth.uid() and s.swiped_id = p.id
                        and s.intent = p_intent)
   group by p.id
   order by 12 desc, 11 desc, p.last_active_at desc  -- te dio like > afinidad > actividad
   limit least(coalesce(p_limit, 20), 50);
$fn$;


-- -----------------------------------------------------------------------------
-- swipe(): única entrada de escritura. Aplica cupo diario, visibilidad y
-- reciprocidad, y crea el match si corresponde.
-- -----------------------------------------------------------------------------
create or replace function public.swipe(
  p_target uuid,
  p_intent public.intent,
  p_dir    public.swipe_dir
)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_me     uuid := auth.uid();
  v_cupo   smallint;
  v_hechos integer;
  v_match  public.matches;
  v_a      uuid;
  v_b      uuid;
begin
  if v_me is null then
    raise exception 'sin sesion' using errcode = '28000';
  end if;
  if not public.puede_participar() then
    raise exception 'completa tu perfil antes de descubrir personas' using errcode = '42501';
  end if;
  if not public.puedo_ver_perfil(p_target, p_intent) then
    raise exception 'ese perfil no esta disponible para esta intencion' using errcode = '42501';
  end if;

  -- Cupo diario por centro: frena el swipe compulsivo y el raspado de perfiles.
  select c.swipes_por_dia into v_cupo
    from public.center_config c
    join public.profiles pr on pr.center_id = c.center_id
   where pr.id = v_me;

  select count(*) into v_hechos
    from public.swipes
   where swiper_id = v_me and created_at >= date_trunc('day', now());

  if v_hechos >= coalesce(v_cupo, 60) then
    raise exception 'llegaste al limite de % swipes por hoy', coalesce(v_cupo, 60)
      using errcode = '53400';
  end if;

  insert into public.swipes (swiper_id, swiped_id, intent, direction)
  values (v_me, p_target, p_intent, p_dir)
  on conflict (swiper_id, swiped_id, intent) do nothing;

  if p_dir = 'pass' then
    return jsonb_build_object('match', false);
  end if;

  -- ¿Reciprocidad? Se bloquea la fila del otro swipe para que dos likes
  -- simultáneos no generen dos matches.
  perform 1 from public.swipes
    where swiper_id = p_target and swiped_id = v_me
      and intent = p_intent and direction in ('like','super')
    for update;

  if not found then
    return jsonb_build_object('match', false);
  end if;

  v_a := least(v_me, p_target);
  v_b := greatest(v_me, p_target);

  insert into public.matches (a_id, b_id, intent)
  values (v_a, v_b, p_intent)
  on conflict (a_id, b_id, intent) do update set activo = true
  returning * into v_match;

  return jsonb_build_object(
    'match', true,
    'match_id', v_match.id,
    'intent', v_match.intent,
    'con', p_target
  );
end $fn$;


-- -----------------------------------------------------------------------------
-- Deshacer un match. Cualquiera de los dos lo cierra; el chat se cierra con él.
-- -----------------------------------------------------------------------------
create or replace function public.cerrar_match(p_match uuid, p_bloquear boolean default false)
returns void
language plpgsql security definer set search_path = public, extensions as $fn$
declare v_m public.matches;
begin
  select * into v_m from public.matches where id = p_match;
  if not found then
    raise exception 'match inexistente' using errcode = '22023';
  end if;
  if auth.uid() not in (v_m.a_id, v_m.b_id) then
    raise exception 'no participas en ese match' using errcode = '42501';
  end if;

  update public.matches
     set activo = false, cerrado_por = auth.uid()
   where id = p_match;

  if p_bloquear then
    insert into public.blocks (blocker_id, blocked_id)
    values (auth.uid(), case when auth.uid() = v_m.a_id then v_m.b_id else v_m.a_id end)
    on conflict do nothing;
  end if;
end $fn$;
