set search_path = public, extensions;

-- =============================================================================
-- SENA MATCH v3 · 0006 · Conversaciones: 1 a 1 del match y grupal del parche
-- =============================================================================
-- Una sola tabla de conversaciones para los dos casos. Lo que cambia es de qué
-- cuelga (`match_id` o `activity_id`) y quién entra:
--
--   · match  -> dos miembros, creados por el trigger del match. Nadie más entra.
--   · parche -> el anfitrión al crear, y cada persona AL CONFIRMAR su cupo.
--               Al salirse, deja de ser miembro y deja de leer lo nuevo.
--
-- No existe "escribirle a alguien sin match". Los mensajes se leen y escriben
-- solo por membresía, comprobada en RLS (0007), nunca por parámetro del cliente.
-- =============================================================================

create type public.conversation_kind as enum ('match','parche');
create type public.message_kind      as enum ('texto','imagen','ubicacion','sistema');

create table public.conversations (
  id            uuid primary key default gen_random_uuid(),
  kind          public.conversation_kind not null,
  match_id      uuid unique references public.matches(id)    on delete cascade,
  activity_id   uuid unique references public.activities(id) on delete cascade,
  archivada     boolean not null default false,
  last_message_at timestamptz,
  created_at    timestamptz not null default now(),
  check (
    (kind = 'match'  and match_id is not null and activity_id is null) or
    (kind = 'parche' and activity_id is not null and match_id is null)
  )
);

create index conversations_actividad_idx on public.conversations (last_message_at desc nulls last);


create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  rol             text not null default 'miembro' check (rol in ('miembro','anfitrion')),
  last_read_at    timestamptz not null default now(),
  silenciada      boolean not null default false,
  salio_at        timestamptz,
  primary key (conversation_id, profile_id)
);

create index conversation_members_profile_idx
  on public.conversation_members (profile_id) where salio_at is null;


create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid references public.profiles(id) on delete set null,
  kind            public.message_kind not null default 'texto',
  body            text check (char_length(body) <= 2000),
  attachment_path text,
  lat             double precision,
  lng             double precision,
  created_at      timestamptz not null default now(),
  edited_at       timestamptz,
  deleted_at      timestamptz,
  check (kind <> 'texto'  or char_length(coalesce(body, '')) > 0),
  check (kind <> 'imagen' or attachment_path is not null),
  check (kind <> 'sistema' or sender_id is null)
);

create index messages_conv_idx on public.messages (conversation_id, created_at desc);

alter table public.reports
  add constraint reports_message_fk
  foreign key (message_id) references public.messages(id) on delete set null;


-- -----------------------------------------------------------------------------
-- Pertenencia. La usan todas las políticas de 0007.
-- -----------------------------------------------------------------------------
create or replace function public.soy_miembro_conv(p_conv uuid)
returns boolean
language sql stable security definer set search_path = public, extensions as $fn$
  select exists (
    select 1 from public.conversation_members
     where conversation_id = p_conv
       and profile_id = auth.uid()
       and salio_at is null
  );
$fn$;


-- -----------------------------------------------------------------------------
-- Un match nace con su conversación y sus dos miembros
-- -----------------------------------------------------------------------------
create or replace function public.tg_conv_de_match()
returns trigger language plpgsql security definer set search_path = public, extensions as $fn$
declare v_conv uuid;
begin
  insert into public.conversations (kind, match_id) values ('match', new.id)
  on conflict (match_id) do update set archivada = false
  returning id into v_conv;

  insert into public.conversation_members (conversation_id, profile_id)
  values (v_conv, new.a_id), (v_conv, new.b_id)
  on conflict (conversation_id, profile_id) do update set salio_at = null;

  insert into public.messages (conversation_id, kind, body)
  values (v_conv, 'sistema',
          'Hicieron match en modo ' || new.intent::text || '. Escriban con respeto.');

  return null;
end $fn$;

create trigger matches_conversacion
  after insert on public.matches
  for each row execute function public.tg_conv_de_match();


-- Cerrar el match archiva el chat: deja de recibir mensajes (ver RLS en 0007).
create or replace function public.tg_archivar_conv_match()
returns trigger language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if old.activo and not new.activo then
    update public.conversations set archivada = true where match_id = new.id;
  end if;
  return null;
end $fn$;

create trigger matches_archivar
  after update of activo on public.matches
  for each row execute function public.tg_archivar_conv_match();


-- -----------------------------------------------------------------------------
-- Un parche nace con su chat grupal
-- -----------------------------------------------------------------------------
create or replace function public.tg_conv_de_parche()
returns trigger language plpgsql security definer set search_path = public, extensions as $fn$
declare v_conv uuid;
begin
  insert into public.conversations (kind, activity_id) values ('parche', new.id)
  returning id into v_conv;

  insert into public.messages (conversation_id, kind, body)
  values (v_conv, 'sistema',
          new.title || ' · ' || new.place_label || ' · ' ||
          to_char(new.starts_at at time zone 'America/Bogota', 'DD/MM HH24:MI'));

  return null;
end $fn$;

create trigger activities_conversacion
  after insert on public.activities
  for each row execute function public.tg_conv_de_parche();


-- -----------------------------------------------------------------------------
-- Confirmar cupo = entrar al chat. Salir o ser rechazado = salir del chat.
-- -----------------------------------------------------------------------------
create or replace function public.tg_sincronizar_miembros_parche()
returns trigger language plpgsql security definer set search_path = public, extensions as $fn$
declare v_conv uuid;
begin
  select id into v_conv from public.conversations where activity_id = new.activity_id;
  if v_conv is null then return null; end if;

  if new.status in ('confirmado','asistio') then
    insert into public.conversation_members (conversation_id, profile_id, rol)
    values (v_conv, new.profile_id,
            case when new.rol = 'anfitrion' then 'anfitrion' else 'miembro' end)
    on conflict (conversation_id, profile_id) do update set salio_at = null;

  elsif new.status in ('cancelado','rechazado') then
    update public.conversation_members
       set salio_at = now()
     where conversation_id = v_conv and profile_id = new.profile_id;
  end if;

  return null;
end $fn$;

create trigger activity_participants_chat
  after insert or update of status on public.activity_participants
  for each row execute function public.tg_sincronizar_miembros_parche();


-- -----------------------------------------------------------------------------
-- Marca de tiempo del último mensaje (ordena la bandeja sin subconsultas)
-- -----------------------------------------------------------------------------
create or replace function public.tg_touch_conversacion()
returns trigger language plpgsql security definer set search_path = public, extensions as $fn$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return null;
end $fn$;

create trigger messages_touch_conv
  after insert on public.messages
  for each row execute function public.tg_touch_conversacion();


-- -----------------------------------------------------------------------------
-- Bandeja de entrada: una consulta para toda la pantalla de chats
-- -----------------------------------------------------------------------------
create or replace view public.v_bandeja
with (security_invoker = true) as
select c.id                       as conversation_id,
       c.kind,
       c.archivada,
       c.last_message_at,
       cm.last_read_at,
       cm.silenciada,
       coalesce(a.title, otro.full_name)   as titulo,
       coalesce(null, otro.avatar_path)    as avatar_path,
       a.id                                as activity_id,
       a.starts_at,
       m.intent,
       (select count(*) from public.messages ms
         where ms.conversation_id = c.id
           and ms.created_at > cm.last_read_at
           and ms.deleted_at is null
           and coalesce(ms.sender_id, '00000000-0000-0000-0000-000000000000') <> auth.uid()
       ) as sin_leer,
       (select ms.body from public.messages ms
         where ms.conversation_id = c.id and ms.deleted_at is null
         order by ms.created_at desc limit 1) as ultimo_mensaje
  from public.conversations c
  join public.conversation_members cm
       on cm.conversation_id = c.id and cm.profile_id = auth.uid() and cm.salio_at is null
  left join public.activities a on a.id = c.activity_id
  left join public.matches    m on m.id = c.match_id
  left join public.profiles otro
       on c.kind = 'match'
      and otro.id = case when m.a_id = auth.uid() then m.b_id else m.a_id end;

comment on view public.v_bandeja is
  'security_invoker = true: la vista NO elude RLS, hereda los permisos de quien consulta.';


-- -----------------------------------------------------------------------------
-- Marcar leído
-- -----------------------------------------------------------------------------
create or replace function public.marcar_leido(p_conv uuid)
returns void
language sql security definer set search_path = public, extensions as $fn$
  update public.conversation_members
     set last_read_at = now()
   where conversation_id = p_conv and profile_id = auth.uid();
$fn$;
