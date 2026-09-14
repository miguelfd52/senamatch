-- =============================================================================
-- SENA MATCH · Esquema para Supabase
-- =============================================================================
-- Pega este archivo COMPLETO en el editor SQL de tu proyecto de Supabase y
-- ejecútalo una vez. Es idempotente: puedes volver a correrlo sin romper nada.
--
-- Qué establece, en el mismo orden en que importa:
--
--   1. El rol sale del dominio del correo, no del formulario. Un correo que no
--      sea @misena.edu.co o @sena.edu.co NO crea cuenta: el trigger lanza
--      excepción y Supabase Auth aborta el registro.
--   2. La esfera (aprendices | equipo) es columna generada a partir del rol.
--      Ninguna consulta la cruza, empezando por el SELECT de `perfiles`.
--   3. RLS en todas las tablas. Las que solo escribe el servidor —matches,
--      participantes de un parche, mensajes— no tienen política de INSERT: se
--      escriben desde funciones SECURITY DEFINER que validan antes.
--   4. El cupo de un parche se resuelve con la fila bloqueada (FOR UPDATE), así
--      que dos personas no entran al mismo último cupo.
--
-- Después de ejecutarlo: Database > Replication > supabase_realtime debe
-- incluir perfiles, parches y chats (este archivo lo intenta automáticamente).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext   with schema extensions;

set search_path = public, extensions;


-- =============================================================================
-- 1 · PERFILES
-- =============================================================================
create table if not exists public.perfiles (
  id            uuid primary key references auth.users(id) on delete cascade,

  nombre        text not null check (char_length(nombre) between 2 and 80),
  correo        citext not null unique,

  -- Gobernadas por el servidor: el cliente no tiene GRANT de escritura (ver §8).
  rol           text not null default 'aprendiz'
                check (rol in ('aprendiz','egresado','instructor','bienestar','moderador','admin')),
  estado        text not null default 'activo'
                check (estado in ('activo','pausado','suspendido')),

  -- Consecuencia del rol, no una opción editable.
  esfera        text not null generated always as (
                  case when rol in ('aprendiz','egresado') then 'aprendices' else 'equipo' end
                ) stored,

  centro        smallint,
  programa      text,
  ficha         text check (ficha is null or ficha ~ '^[0-9]{4,8}$'),
  jornada       text check (jornada is null or jornada in ('manana','tarde','noche','virtual')),
  nacimiento    date check (nacimiento is null or nacimiento <= current_date - interval '13 years'),
  bio           text check (bio is null or char_length(bio) <= 400),

  intereses     text[] not null default '{}',
  intenciones   text[] not null default '{}',

  avatar_emoji  text check (avatar_emoji is null or char_length(avatar_emoji) <= 8),
  avatar_color  text check (avatar_color is null or avatar_color ~ '^#[0-9A-Fa-f]{6}$'),

  asistencias   integer not null default 0 check (asistencias >= 0),
  inasistencias integer not null default 0 check (inasistencias >= 0),

  demo          boolean not null default false,
  creado        timestamptz not null default now(),
  visto         timestamptz not null default now()
);

create index if not exists perfiles_centro_idx on public.perfiles (centro, esfera)
  where estado = 'activo';

comment on column public.perfiles.esfera is
  'aprendices | equipo. Frontera dura: el descubrimiento 1 a 1 nunca la cruza.';


-- =============================================================================
-- 2 · RESTO DE TABLAS
-- =============================================================================

-- Un documento por persona con todo lo que ha evaluado. Solo lo lee su dueño.
create table if not exists public.swipes (
  perfil        uuid primary key references public.perfiles(id) on delete cascade,
  por_intencion jsonb not null default '{}',
  ts            timestamptz not null default now()
);

create table if not exists public.matches (
  id         text primary key,                 -- <a>__<b>__<intencion>, orden canónico
  a          uuid not null references public.perfiles(id) on delete cascade,
  b          uuid not null references public.perfiles(id) on delete cascade,
  intencion  text not null,
  activo     boolean not null default true,
  creado     timestamptz not null default now(),
  check (a < b)
);
create index if not exists matches_a_idx on public.matches (a) where activo;
create index if not exists matches_b_idx on public.matches (b) where activo;

create table if not exists public.parches (
  id            text primary key,
  anfitrion     uuid not null references public.perfiles(id) on delete cascade,
  titulo        text not null check (char_length(titulo) between 5 and 80),
  descripcion   text check (descripcion is null or char_length(descripcion) <= 400),
  tipo          text not null,
  lugar         text not null check (char_length(lugar) between 3 and 80),
  inicio        timestamptz not null,
  duracion      smallint not null default 60 check (duracion between 15 and 480),
  cupo          smallint not null check (cupo between 2 and 200),
  centro        smallint not null,
  esfera        text not null check (esfera in ('aprendices','equipo')),
  mixto         boolean not null default false,
  aprobacion    boolean not null default false,
  codigo        text unique,
  estado        text not null default 'abierto'
                check (estado in ('abierto','cancelado','finalizado')),
  participantes jsonb not null default '[]',   -- [{id, rol, desde}]
  solicitudes   jsonb not null default '[]',   -- [{id, nota, ts}]
  asistencia    jsonb,                         -- {llegaron:[], faltaron:[], ts}
  creado        timestamptz not null default now()
);
create index if not exists parches_feed_idx on public.parches (centro, esfera, inicio)
  where estado = 'abierto';

create table if not exists public.chats (
  id        text primary key,
  tipo      text not null check (tipo in ('match','parche')),
  titulo    text,
  miembros  uuid[] not null default '{}',
  mensajes  jsonb not null default '[]',       -- [{de, txt, ts}]  máx. 200
  creado    timestamptz not null default now(),
  ultimo    timestamptz not null default now()
);
create index if not exists chats_miembros_idx on public.chats using gin (miembros);

create table if not exists public.bloqueos (
  perfil uuid primary key references public.perfiles(id) on delete cascade,
  ids    uuid[] not null default '{}',
  ts     timestamptz not null default now()
);

create table if not exists public.reportes (
  id      text primary key,
  de      uuid not null references public.perfiles(id) on delete cascade,
  sobre   uuid references public.perfiles(id) on delete cascade,
  motivo  text not null,
  detalle text check (detalle is null or char_length(detalle) <= 800),
  estado  text not null default 'pendiente'
          check (estado in ('pendiente','en_revision','resuelto','descartado')),
  ts      timestamptz not null default now()
);

create table if not exists public.config (
  id     text primary key,
  datos  jsonb not null default '{}'
);

-- El modo cita nace apagado. Se enciende a conciencia, no por defecto.
insert into public.config (id, datos)
values ('centro', '{"modoCita": false}'::jsonb)
on conflict (id) do nothing;


-- =============================================================================
-- 3 · IDENTIDAD: el rol lo decide el dominio del correo
-- =============================================================================
create or replace function public.rol_por_dominio(p_correo text)
returns text language sql immutable as $fn$
  select case
    when lower(p_correo) like '%@misena.edu.co' then 'aprendiz'
    when lower(p_correo) like '%@sena.edu.co'   then 'instructor'
    else null
  end;
$fn$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, extensions, auth as $fn$
declare v_rol text;
begin
  v_rol := public.rol_por_dominio(new.email);

  if v_rol is null then
    raise exception 'Solo se admiten correos @misena.edu.co o @sena.edu.co'
      using errcode = '22023';
  end if;

  insert into public.perfiles (id, correo, nombre, rol)
  values (new.id, new.email, split_part(new.email, '@', 1), v_rol)
  on conflict (id) do nothing;

  return new;
end $fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =============================================================================
-- 4 · AYUDAS DE VISIBILIDAD
-- =============================================================================
create or replace function public.mi_centro()
returns smallint language sql stable security definer
set search_path = public, extensions as $fn$
  select centro from public.perfiles where id = auth.uid();
$fn$;

create or replace function public.mi_esfera()
returns text language sql stable security definer
set search_path = public, extensions as $fn$
  select esfera from public.perfiles where id = auth.uid();
$fn$;

create or replace function public.es_staff()
returns boolean language sql stable security definer
set search_path = public, extensions as $fn$
  select coalesce((select rol from public.perfiles where id = auth.uid())
                  in ('bienestar','moderador','admin'), false);
$fn$;

-- El bloqueo es simétrico en efecto: basta que exista en un sentido.
create or replace function public.hay_bloqueo(p_a uuid, p_b uuid)
returns boolean language sql stable security definer
set search_path = public, extensions as $fn$
  select exists (
    select 1 from public.bloqueos
     where (perfil = p_a and p_b = any(ids))
        or (perfil = p_b and p_a = any(ids))
  );
$fn$;

create or replace function public.edad(p_id uuid)
returns integer language sql stable security definer
set search_path = public, extensions as $fn$
  select extract(year from age(current_date, nacimiento))::int
    from public.perfiles where id = p_id;
$fn$;

create or replace function public.modo_cita_activo()
returns boolean language sql stable security definer
set search_path = public, extensions as $fn$
  select coalesce((select (datos ->> 'modoCita')::boolean from public.config where id = 'centro'), false);
$fn$;

/* La puerta única del descubrimiento 1 a 1: las seis compuertas. */
create or replace function public.puedo_ver(p_otro uuid, p_intencion text)
returns boolean
language plpgsql stable security definer set search_path = public, extensions as $fn$
declare yo public.perfiles; otro public.perfiles;
begin
  select * into yo   from public.perfiles where id = auth.uid();
  select * into otro from public.perfiles where id = p_otro;
  if yo.id is null or otro.id is null or yo.id = otro.id then return false; end if;

  if yo.estado <> 'activo' or otro.estado <> 'activo' then return false; end if;
  if yo.esfera <> otro.esfera then return false; end if;              -- la frontera
  if yo.centro is distinct from otro.centro then return false; end if;
  if not (p_intencion = any (yo.intenciones)) then return false; end if;
  if not (p_intencion = any (otro.intenciones)) then return false; end if;
  if public.hay_bloqueo(yo.id, otro.id) then return false; end if;

  if p_intencion = 'cita' then
    if not public.modo_cita_activo() then return false; end if;
    if coalesce(public.edad(yo.id), 0) < 18 then return false; end if;
    if coalesce(public.edad(otro.id), 0) < 18 then return false; end if;
  end if;

  if p_intencion = 'colegas' and (yo.esfera <> 'equipo' or otro.esfera <> 'equipo')
    then return false; end if;

  return true;
end $fn$;


-- =============================================================================
-- 5 · SWIPE Y MATCH  (el cliente nunca escribe en `matches`)
-- =============================================================================
create or replace function public.registrar_swipe(
  p_otro uuid, p_intencion text, p_dir text
)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_yo    uuid := auth.uid();
  v_map   jsonb;
  v_otro  jsonb;
  v_id    text;
  v_a     uuid;
  v_b     uuid;
  v_nom   text;
begin
  if v_yo is null then raise exception 'sin sesion' using errcode = '28000'; end if;
  if p_dir not in ('like','pass') then raise exception 'direccion invalida'; end if;
  if not public.puedo_ver(p_otro, p_intencion) then
    raise exception 'ese perfil no esta disponible' using errcode = '42501';
  end if;

  insert into public.swipes (perfil, por_intencion) values (v_yo, '{}'::jsonb)
  on conflict (perfil) do nothing;

  update public.swipes
     set por_intencion = jsonb_set(
           por_intencion,
           array[p_intencion],
           coalesce(por_intencion -> p_intencion, '{}'::jsonb)
             || jsonb_build_object(p_otro::text, p_dir),
           true),
         ts = now()
   where perfil = v_yo;

  if p_dir = 'pass' then return jsonb_build_object('match', false); end if;

  -- ¿Reciprocidad? Se bloquea la fila del otro para que dos «me interesa»
  -- simultáneos no creen dos matches.
  select por_intencion into v_map from public.swipes where perfil = p_otro for update;
  v_otro := coalesce(v_map -> p_intencion, '{}'::jsonb);
  if coalesce(v_otro ->> v_yo::text, '') <> 'like' then
    return jsonb_build_object('match', false);
  end if;

  v_a := least(v_yo, p_otro); v_b := greatest(v_yo, p_otro);
  v_id := v_a::text || '__' || v_b::text || '__' || p_intencion;

  insert into public.matches (id, a, b, intencion) values (v_id, v_a, v_b, p_intencion)
  on conflict (id) do update set activo = true;

  select nombre into v_nom from public.perfiles where id = v_yo;

  insert into public.chats (id, tipo, titulo, miembros, mensajes)
  values (v_id, 'match', '', array[v_yo, p_otro],
          jsonb_build_array(jsonb_build_object(
            'de', null, 'txt', 'Coincidieron en ' || p_intencion || '.',
            'ts', (extract(epoch from now())*1000)::bigint)))
  on conflict (id) do nothing;

  return jsonb_build_object('match', true, 'chat', v_id);
end $fn$;

/* Quién me marcó y aún no le respondo. Es SECURITY DEFINER porque `swipes`
   solo lo lee su dueño: nadie puede raspar quién marcó a quién. */
create or replace function public.me_marcaron()
returns table (perfil uuid, intencion text)
language plpgsql stable security definer set search_path = public, extensions as $fn$
declare r record; k text; v_mio jsonb;
begin
  select por_intencion into v_mio from public.swipes where perfil = auth.uid();
  v_mio := coalesce(v_mio, '{}'::jsonb);

  for r in select s.perfil, s.por_intencion from public.swipes s where s.perfil <> auth.uid()
  loop
    for k in select jsonb_object_keys(r.por_intencion)
    loop
      if coalesce((r.por_intencion -> k) ->> auth.uid()::text, '') = 'like'
         and coalesce((v_mio -> k) ->> r.perfil::text, '') = ''
         and public.puedo_ver(r.perfil, k) then
        perfil := r.perfil; intencion := k; return next;
      end if;
    end loop;
  end loop;
end $fn$;


-- =============================================================================
-- 6 · PARCHES
-- =============================================================================
create or replace function public.puedo_ver_parche(p_id text)
returns boolean
language plpgsql stable security definer set search_path = public, extensions as $fn$
declare a public.parches; yo public.perfiles;
begin
  select * into a  from public.parches where id = p_id;
  select * into yo from public.perfiles where id = auth.uid();
  if a.id is null or yo.id is null then return false; end if;

  if exists (select 1 from jsonb_array_elements(a.participantes) e
              where e ->> 'id' = yo.id::text) then return true; end if;

  if yo.estado <> 'activo' then return false; end if;
  if a.centro is distinct from yo.centro then return false; end if;
  if not a.mixto and a.esfera <> yo.esfera then return false; end if;
  if public.hay_bloqueo(yo.id, a.anfitrion) then return false; end if;
  return true;
end $fn$;

create or replace function public.crear_parche(p_datos jsonb)
returns public.parches
language plpgsql security definer set search_path = public, extensions as $fn$
declare yo public.perfiles; v_id text; v_cod text; v_row public.parches; v_hoy int;
begin
  select * into yo from public.perfiles where id = auth.uid();
  if yo.id is null then raise exception 'sin sesion' using errcode = '28000'; end if;
  if yo.centro is null then raise exception 'completa tu perfil primero' using errcode = '42501'; end if;

  select count(*) into v_hoy from public.parches
   where anfitrion = yo.id and creado >= date_trunc('day', now()) and estado <> 'cancelado';
  if v_hoy >= 5 then
    raise exception 'ya publicaste % parches hoy', v_hoy using errcode = '53400';
  end if;

  if (p_datos ->> 'mixto')::boolean and yo.rol not in ('instructor','bienestar','moderador','admin') then
    raise exception 'solo bienestar o un instructor publica parches institucionales'
      using errcode = '42501';
  end if;

  v_id  := 'p' || replace(gen_random_uuid()::text, '-', '');
  v_cod := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));

  insert into public.parches (
    id, anfitrion, titulo, descripcion, tipo, lugar, inicio, duracion, cupo,
    centro, esfera, mixto, aprobacion, codigo, participantes
  ) values (
    v_id, yo.id,
    p_datos ->> 'titulo', nullif(p_datos ->> 'descripcion', ''), p_datos ->> 'tipo',
    p_datos ->> 'lugar', (p_datos ->> 'inicio')::timestamptz,
    coalesce((p_datos ->> 'duracion')::smallint, 60), (p_datos ->> 'cupo')::smallint,
    yo.centro, yo.esfera,
    coalesce((p_datos ->> 'mixto')::boolean, false),
    coalesce((p_datos ->> 'aprobacion')::boolean, false),
    v_cod,
    jsonb_build_array(jsonb_build_object('id', yo.id::text, 'rol', 'anfitrion',
                                         'desde', (extract(epoch from now())*1000)::bigint))
  ) returning * into v_row;

  insert into public.chats (id, tipo, titulo, miembros, mensajes)
  values (v_id, 'parche', v_row.titulo, array[yo.id],
          jsonb_build_array(jsonb_build_object('de', null,
            'txt', v_row.titulo || ' · ' || v_row.lugar,
            'ts', (extract(epoch from now())*1000)::bigint)));

  return v_row;
end $fn$;

/* El cupo bajo concurrencia: la fila del parche queda bloqueada antes de contar. */
create or replace function public.entrar_parche(p_id text, p_nota text default '')
returns jsonb
language plpgsql security definer set search_path = public, extensions as $fn$
declare a public.parches; yo public.perfiles; v_n int; v_faltas int;
begin
  select * into yo from public.perfiles where id = auth.uid();
  if yo.id is null then raise exception 'sin sesion' using errcode = '28000'; end if;
  if not public.puedo_ver_parche(p_id) then
    raise exception 'ese parche no esta disponible para ti' using errcode = '42501';
  end if;

  select * into a from public.parches where id = p_id for update;
  if a.estado <> 'abierto' then raise exception 'el parche esta %', a.estado; end if;
  if a.inicio <= now() then raise exception 'el parche ya empezo'; end if;

  if exists (select 1 from jsonb_array_elements(a.participantes) e
              where e ->> 'id' = yo.id::text) then
    return jsonb_build_object('estado', 'confirmado');
  end if;

  v_faltas := yo.inasistencias;
  if v_faltas >= 3 and v_faltas > yo.asistencias and not a.aprobacion then
    raise exception 'tienes % inasistencias: solo puedes pedir cupo en parches con aprobacion',
      v_faltas using errcode = '42501';
  end if;

  if a.aprobacion then
    update public.parches
       set solicitudes = (
             select coalesce(jsonb_agg(e), '[]'::jsonb)
               from jsonb_array_elements(solicitudes) e
              where e ->> 'id' <> yo.id::text
           ) || jsonb_build_array(jsonb_build_object(
                  'id', yo.id::text, 'nota', coalesce(p_nota, ''),
                  'ts', (extract(epoch from now())*1000)::bigint))
     where id = p_id;
    return jsonb_build_object('estado', 'solicitado');
  end if;

  select jsonb_array_length(a.participantes) into v_n;
  if v_n >= a.cupo then raise exception 'no quedan cupos' using errcode = '53400'; end if;

  update public.parches
     set participantes = participantes || jsonb_build_array(jsonb_build_object(
           'id', yo.id::text, 'rol', 'asistente',
           'desde', (extract(epoch from now())*1000)::bigint))
   where id = p_id;

  perform public.agregar_miembro_chat(p_id, yo.id);
  perform public.mensaje_sistema(p_id, split_part(yo.nombre, ' ', 1) || ' se unió.');

  return jsonb_build_object('estado', 'confirmado');
end $fn$;

create or replace function public.salir_parche(p_id text)
returns void
language plpgsql security definer set search_path = public, extensions as $fn$
declare yo public.perfiles;
begin
  select * into yo from public.perfiles where id = auth.uid();
  update public.parches
     set participantes = (select coalesce(jsonb_agg(e), '[]'::jsonb)
                            from jsonb_array_elements(participantes) e
                           where e ->> 'id' <> yo.id::text)
   where id = p_id and anfitrion <> yo.id;
  if not found then return; end if;

  update public.chats set miembros = array_remove(miembros, yo.id) where id = p_id;
  perform public.mensaje_sistema(p_id, split_part(yo.nombre, ' ', 1) || ' ya no va.');
end $fn$;

create or replace function public.decidir_solicitud(p_id text, p_quien uuid, p_aprobar boolean)
returns void
language plpgsql security definer set search_path = public, extensions as $fn$
declare a public.parches; v_nom text;
begin
  select * into a from public.parches where id = p_id for update;
  if a.anfitrion <> auth.uid() then
    raise exception 'solo el anfitrion decide' using errcode = '42501';
  end if;

  update public.parches
     set solicitudes = (select coalesce(jsonb_agg(e), '[]'::jsonb)
                          from jsonb_array_elements(solicitudes) e
                         where e ->> 'id' <> p_quien::text)
   where id = p_id;

  if p_aprobar then
    if jsonb_array_length(a.participantes) >= a.cupo then
      raise exception 'no quedan cupos' using errcode = '53400';
    end if;
    update public.parches
       set participantes = participantes || jsonb_build_array(jsonb_build_object(
             'id', p_quien::text, 'rol', 'asistente',
             'desde', (extract(epoch from now())*1000)::bigint))
     where id = p_id;
    perform public.agregar_miembro_chat(p_id, p_quien);
    select nombre into v_nom from public.perfiles where id = p_quien;
    perform public.mensaje_sistema(p_id, split_part(coalesce(v_nom,'Alguien'), ' ', 1) || ' entró al parche.');
  end if;
end $fn$;

create or replace function public.cancelar_parche(p_id text)
returns void
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  update public.parches set estado = 'cancelado'
   where id = p_id and (anfitrion = auth.uid() or public.es_staff());
  if not found then
    raise exception 'solo el anfitrion o moderación cancela' using errcode = '42501';
  end if;
  perform public.mensaje_sistema(p_id, 'El anfitrión canceló el parche.');
end $fn$;

create or replace function public.marcar_asistencia(p_id text, p_llegaron uuid[])
returns void
language plpgsql security definer set search_path = public, extensions as $fn$
declare a public.parches; v_todos uuid[]; v_faltaron uuid[];
begin
  select * into a from public.parches where id = p_id;
  if a.anfitrion <> auth.uid() then
    raise exception 'solo el anfitrion marca asistencia' using errcode = '42501';
  end if;
  if a.inicio > now() then raise exception 'el parche todavia no empieza'; end if;

  select array_agg((e ->> 'id')::uuid) into v_todos
    from jsonb_array_elements(a.participantes) e
   where e ->> 'id' <> a.anfitrion::text;
  v_todos := coalesce(v_todos, '{}');

  select array_agg(x) into v_faltaron
    from unnest(v_todos) x where not (x = any(coalesce(p_llegaron, '{}')));
  v_faltaron := coalesce(v_faltaron, '{}');

  update public.parches
     set asistencia = jsonb_build_object(
           'llegaron', to_jsonb(coalesce(p_llegaron,'{}'::uuid[])),
           'faltaron', to_jsonb(v_faltaron),
           'ts', (extract(epoch from now())*1000)::bigint),
         estado = 'finalizado'
   where id = p_id;

  update public.perfiles set asistencias = asistencias + 1
   where id = any (coalesce(p_llegaron, '{}'));
  update public.perfiles set inasistencias = inasistencias + 1
   where id = any (v_faltaron);
end $fn$;


-- =============================================================================
-- 7 · CHAT  (los mensajes se añaden en el servidor: nadie pisa a nadie)
-- =============================================================================
create or replace function public.agregar_miembro_chat(p_chat text, p_perfil uuid)
returns void language sql security definer
set search_path = public, extensions as $fn$
  update public.chats
     set miembros = (select array_agg(distinct x) from unnest(miembros || p_perfil) x)
   where id = p_chat;
$fn$;

create or replace function public.mensaje_sistema(p_chat text, p_txt text)
returns void language sql security definer
set search_path = public, extensions as $fn$
  update public.chats
     set mensajes = (
           select coalesce(jsonb_agg(e), '[]'::jsonb) from (
             select e from jsonb_array_elements(
               mensajes || jsonb_build_array(jsonb_build_object(
                 'de', null, 'txt', p_txt,
                 'ts', (extract(epoch from now())*1000)::bigint))) e
             offset greatest(jsonb_array_length(mensajes) + 1 - 200, 0)
           ) t),
         ultimo = now()
   where id = p_chat;
$fn$;

create or replace function public.enviar_mensaje(p_chat text, p_txt text)
returns void
language plpgsql security definer set search_path = public, extensions as $fn$
declare c public.chats; m public.matches;
begin
  select * into c from public.chats where id = p_chat for update;
  if c.id is null then raise exception 'chat inexistente'; end if;
  if not (auth.uid() = any (c.miembros)) then
    raise exception 'no participas en esta conversacion' using errcode = '42501';
  end if;
  if char_length(coalesce(p_txt,'')) = 0 or char_length(p_txt) > 500 then
    raise exception 'mensaje vacio o demasiado largo';
  end if;

  if c.tipo = 'match' then
    select * into m from public.matches where id = p_chat;
    if not coalesce(m.activo, false) then raise exception 'esta conversacion esta cerrada'; end if;
    if public.hay_bloqueo(m.a, m.b) then
      raise exception 'no puedes escribir aqui' using errcode = '42501';
    end if;
  end if;

  update public.chats
     set mensajes = (
           select coalesce(jsonb_agg(e), '[]'::jsonb) from (
             select e from jsonb_array_elements(
               mensajes || jsonb_build_array(jsonb_build_object(
                 'de', auth.uid()::text, 'txt', p_txt,
                 'ts', (extract(epoch from now())*1000)::bigint))) e
             offset greatest(jsonb_array_length(mensajes) + 1 - 200, 0)
           ) t),
         ultimo = now()
   where id = p_chat;
end $fn$;


-- =============================================================================
-- 8 · RLS Y PERMISOS DE COLUMNA
-- =============================================================================
alter table public.perfiles enable row level security;
alter table public.swipes   enable row level security;
alter table public.matches  enable row level security;
alter table public.parches  enable row level security;
alter table public.chats    enable row level security;
alter table public.bloqueos enable row level security;
alter table public.reportes enable row level security;
alter table public.config   enable row level security;

drop policy if exists perfiles_lectura on public.perfiles;
create policy perfiles_lectura on public.perfiles for select to authenticated
using (
  id = auth.uid() or public.es_staff() or (
    estado = 'activo'
    and centro = public.mi_centro()
    and esfera = public.mi_esfera()          -- la frontera empieza en el SELECT
    and not public.hay_bloqueo(auth.uid(), id)
  )
);

drop policy if exists perfiles_propio on public.perfiles;
create policy perfiles_propio on public.perfiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

-- El perfil lo crea el trigger; el cliente no inserta ni borra filas ajenas.
drop policy if exists perfiles_borrar on public.perfiles;
create policy perfiles_borrar on public.perfiles for delete to authenticated
using (id = auth.uid());

revoke update on public.perfiles from authenticated;
grant  update (nombre, centro, programa, ficha, jornada, nacimiento, bio,
               intereses, intenciones, avatar_emoji, avatar_color, visto)
  on public.perfiles to authenticated;
revoke insert on public.perfiles from authenticated;

drop policy if exists swipes_propios on public.swipes;
create policy swipes_propios on public.swipes for select to authenticated
using (perfil = auth.uid());
revoke insert, update, delete on public.swipes from authenticated;

drop policy if exists matches_propios on public.matches;
create policy matches_propios on public.matches for select to authenticated
using (auth.uid() in (a, b));
revoke insert, update, delete on public.matches from authenticated;

drop policy if exists parches_lectura on public.parches;
create policy parches_lectura on public.parches for select to authenticated
using (anfitrion = auth.uid() or public.es_staff() or public.puedo_ver_parche(id));
revoke insert, update, delete on public.parches from authenticated;

drop policy if exists chats_miembro on public.chats;
create policy chats_miembro on public.chats for select to authenticated
using (auth.uid() = any (miembros));
revoke insert, update, delete on public.chats from authenticated;

drop policy if exists bloqueos_propios on public.bloqueos;
create policy bloqueos_propios on public.bloqueos for all to authenticated
using (perfil = auth.uid()) with check (perfil = auth.uid());

drop policy if exists reportes_crear on public.reportes;
create policy reportes_crear on public.reportes for insert to authenticated
with check (de = auth.uid());
drop policy if exists reportes_lectura on public.reportes;
create policy reportes_lectura on public.reportes for select to authenticated
using (de = auth.uid() or public.es_staff());
revoke update, delete on public.reportes from authenticated;

drop policy if exists config_lectura on public.config;
create policy config_lectura on public.config for select to authenticated using (true);
-- Encender el modo cita es decisión de bienestar, no de cualquier usuario.
drop policy if exists config_staff on public.config;
create policy config_staff on public.config for update to authenticated
using (public.es_staff()) with check (public.es_staff());
revoke insert, delete on public.config from authenticated;


-- =============================================================================
-- 9 · TIEMPO REAL
-- =============================================================================
do $rt$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.perfiles; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.parches;  exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.chats;    exception when duplicate_object then null; end;
  end if;
end $rt$;


-- =============================================================================
-- 10 · COMPROBACIÓN
-- =============================================================================
-- Debe devolver CERO filas. Si devuelve alguna, esa tabla quedó sin RLS.
select c.relname as tabla_sin_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
