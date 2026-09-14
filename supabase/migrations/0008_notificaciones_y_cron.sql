set search_path = public, extensions;

-- =============================================================================
-- SENA MATCH v3 · 0008 · Notificaciones, tiempo real y tareas programadas
-- =============================================================================
-- Lo efímero necesita un reloj. Sin estas tareas, un parche de las 9:00 sigue
-- "abierto" a las 11:00 y su chat grupal se vuelve un grupo de WhatsApp eterno,
-- que es justo lo que la app viene a evitar.
-- =============================================================================

create type public.notification_kind as enum
  ('match','mensaje','parche_nuevo','parche_solicitud','parche_confirmado',
   'parche_recordatorio','parche_cancelado','moderacion');

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind       public.notification_kind not null,
  title      text not null check (char_length(title) <= 120),
  body       text check (char_length(body) <= 300),
  data       jsonb not null default '{}',   -- {conversation_id, activity_id, match_id}
  leida_at   timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_pendientes_idx
  on public.notifications (profile_id, created_at desc) where leida_at is null;

alter table public.notifications enable row level security;

create policy notifications_propias on public.notifications
  for select to authenticated using (profile_id = auth.uid());

create policy notifications_marcar on public.notifications
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

revoke insert, delete on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant  update (leida_at) on public.notifications to authenticated;


-- -----------------------------------------------------------------------------
-- Disparadores de notificación
-- -----------------------------------------------------------------------------
create or replace function public.tg_notificar_match()
returns trigger language plpgsql security definer set search_path = public, extensions as $fn$
begin
  insert into public.notifications (profile_id, kind, title, body, data)
  select p.id,
         'match',
         'Nuevo match',
         (select full_name from public.profiles where id =
            case when p.id = new.a_id then new.b_id else new.a_id end)
         || ' también te eligió en modo ' || new.intent::text,
         jsonb_build_object('match_id', new.id)
    from (select new.a_id as id union all select new.b_id) p;
  return null;
end $fn$;

create trigger matches_notificar
  after insert on public.matches
  for each row execute function public.tg_notificar_match();


create or replace function public.tg_notificar_mensaje()
returns trigger language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if new.kind = 'sistema' then return null; end if;

  insert into public.notifications (profile_id, kind, title, body, data)
  select cm.profile_id,
         'mensaje',
         coalesce((select full_name from public.profiles where id = new.sender_id), 'Alguien'),
         left(coalesce(new.body, 'Envió un archivo'), 120),
         jsonb_build_object('conversation_id', new.conversation_id)
    from public.conversation_members cm
   where cm.conversation_id = new.conversation_id
     and cm.profile_id <> new.sender_id
     and cm.salio_at is null
     and not cm.silenciada;

  return null;
end $fn$;

create trigger messages_notificar
  after insert on public.messages
  for each row execute function public.tg_notificar_mensaje();


create or replace function public.tg_notificar_parche()
returns trigger language plpgsql security definer set search_path = public, extensions as $fn$
declare a public.activities;
begin
  select * into a from public.activities where id = new.activity_id;

  if new.status = 'solicitado' then
    insert into public.notifications (profile_id, kind, title, body, data)
    values (a.host_id, 'parche_solicitud', 'Alguien quiere entrar a tu parche',
            a.title, jsonb_build_object('activity_id', a.id));

  elsif new.status = 'confirmado' and new.rol <> 'anfitrion' then
    insert into public.notifications (profile_id, kind, title, body, data)
    values (new.profile_id, 'parche_confirmado', 'Cupo confirmado',
            a.title || ' · ' || a.place_label,
            jsonb_build_object('activity_id', a.id));
  end if;

  return null;
end $fn$;

create trigger activity_participants_notificar
  after insert or update of status on public.activity_participants
  for each row execute function public.tg_notificar_parche();


-- =============================================================================
-- Reloj: caducar parches y archivar sus chats
-- =============================================================================
create or replace function public.caducar_parches()
returns integer
language plpgsql security definer set search_path = public, extensions as $fn$
declare v_n integer := 0;
begin
  -- En curso
  update public.activities
     set status = 'en_curso'
   where status in ('abierto','lleno')
     and starts_at <= now() and expires_at > now();

  -- Terminó y el anfitrión nunca marcó asistencia: se vence sin castigar a nadie.
  with vencidos as (
    update public.activities
       set status = 'vencido'
     where status in ('abierto','lleno','en_curso')
       and expires_at <= now()
    returning id
  )
  select count(*) into v_n from vencidos;

  -- El chat sobrevive unas horas para repartir la cuenta y las fotos, y se cierra.
  update public.conversations c
     set archivada = true
    from public.activities a, public.center_config cfg
   where c.activity_id = a.id
     and cfg.center_id = a.center_id
     and not c.archivada
     and (a.status in ('cancelado')
          or a.expires_at + make_interval(hours => cfg.horas_vida_chat_parche) <= now());

  return v_n;
end $fn$;


-- Recordatorio 30 minutos antes. Idempotente: no repite si ya lo mandó.
create or replace function public.recordar_parches()
returns integer
language plpgsql security definer set search_path = public, extensions as $fn$
declare v_n integer;
begin
  with pendientes as (
    select ap.profile_id, a.id, a.title, a.place_label, a.starts_at
      from public.activities a
      join public.activity_participants ap
        on ap.activity_id = a.id and ap.status = 'confirmado'
     where a.status in ('abierto','lleno')
       and a.starts_at between now() and now() + interval '30 minutes'
       and not exists (
         select 1 from public.notifications n
          where n.profile_id = ap.profile_id
            and n.kind = 'parche_recordatorio'
            and n.data ->> 'activity_id' = a.id::text
       )
  ), insertadas as (
    insert into public.notifications (profile_id, kind, title, body, data)
    select profile_id, 'parche_recordatorio', 'Tu parche empieza pronto',
           title || ' · ' || place_label ||
           ' · ' || to_char(starts_at at time zone 'America/Bogota', 'HH24:MI'),
           jsonb_build_object('activity_id', id)
      from pendientes
    returning 1
  )
  select count(*) into v_n from insertadas;

  return v_n;
end $fn$;


-- Higiene: los swipes viejos no aportan y engordan el índice del mazo.
create or replace function public.purgar_datos_viejos()
returns void
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  delete from public.swipes
   where direction = 'pass' and created_at < now() - interval '90 days';

  delete from public.notifications
   where leida_at is not null and created_at < now() - interval '30 days';

  delete from public.messages
   where deleted_at is not null and deleted_at < now() - interval '30 days';
end $fn$;


-- -----------------------------------------------------------------------------
-- Programación. pg_cron se habilita en Database > Extensions; si no está,
-- esta migración no falla y las funciones se llaman desde una Edge Function.
-- -----------------------------------------------------------------------------
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('sena-caducar-parches',  '*/5 * * * *',  'select public.caducar_parches();');
    perform cron.schedule('sena-recordar-parches', '*/5 * * * *',  'select public.recordar_parches();');
    perform cron.schedule('sena-purgar',           '17 4 * * *',   'select public.purgar_datos_viejos();');
  else
    raise notice 'pg_cron no está instalado: programa caducar_parches() y recordar_parches() cada 5 min por otro medio.';
  end if;
end $cron$;


-- -----------------------------------------------------------------------------
-- Tiempo real (WebSocket de Supabase Realtime). Solo lo que la interfaz observa.
-- RLS sigue aplicando: cada quien recibe únicamente lo que podría leer con SELECT.
-- -----------------------------------------------------------------------------
do $rt$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
    alter publication supabase_realtime add table public.notifications;
    alter publication supabase_realtime add table public.activities;
    alter publication supabase_realtime add table public.activity_participants;
  end if;
exception when duplicate_object then
  null;
end $rt$;
