set search_path = public, extensions;

-- =============================================================================
-- SENA MATCH v3 · 0007 · Row Level Security y permisos de columna
-- =============================================================================
-- Regla de oro del proyecto: la clave pública de Supabase está a la vista en el
-- bundle del cliente. Todo lo que la base permita a `authenticated`, lo puede
-- hacer cualquiera con esa clave y curl. Por eso:
--
--   · RLS habilitada en TODAS las tablas, sin excepción.
--   · Las tablas que solo escribe el servidor (matches, swipes, activities,
--     activity_participants, roster) no tienen política de INSERT: se escriben
--     desde funciones SECURITY DEFINER, que corren como dueño y saltan RLS.
--   · Las columnas de gobierno (role, verification, status, esfera) se protegen
--     con GRANT de columna, no con un CHECK que el cliente pueda esquivar.
--   · Toda política de UPDATE lleva WITH CHECK además de USING. Sin WITH CHECK,
--     una fila que hoy puedes editar te deja escribir en ella un valor que
--     mañana no podrías ver.
-- =============================================================================

alter table public.centers               enable row level security;
alter table public.programs              enable row level security;
alter table public.interests             enable row level security;
alter table public.center_config         enable row level security;
alter table public.roster                enable row level security;
alter table public.profiles              enable row level security;
alter table public.profile_interests     enable row level security;
alter table public.blocks                enable row level security;
alter table public.reports               enable row level security;
alter table public.moderation_log        enable row level security;
alter table public.swipes                enable row level security;
alter table public.matches               enable row level security;
alter table public.activities            enable row level security;
alter table public.activity_participants enable row level security;
alter table public.conversations         enable row level security;
alter table public.conversation_members  enable row level security;
alter table public.messages              enable row level security;


-- -----------------------------------------------------------------------------
-- Catálogos: lectura para cualquiera con sesión, escritura solo por migración
-- -----------------------------------------------------------------------------
create policy centers_lectura   on public.centers   for select to authenticated using (true);
create policy programs_lectura  on public.programs  for select to authenticated using (true);
create policy interests_lectura on public.interests for select to authenticated using (active);

create policy center_config_lectura on public.center_config
  for select to authenticated using (center_id = public.mi_centro());

-- El padrón no lo lee nadie desde el cliente: solo verificar_ficha().
revoke all on public.roster from anon, authenticated;


-- -----------------------------------------------------------------------------
-- Perfiles
-- -----------------------------------------------------------------------------
create policy profiles_lectura on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.es_admin()
    or (
      status = 'activo'
      and center_id = public.mi_centro()
      and esfera    = public.mi_esfera()      -- la frontera también aplica al SELECT
      and not public.hay_bloqueo(auth.uid(), id)
    )
  );

create policy profiles_propio_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No hay política de INSERT ni de DELETE: la cuenta la crea handle_new_user()
-- y se da de baja con status = 'eliminado'.

-- Columnas de gobierno: el cliente ni siquiera tiene el GRANT.
revoke update on public.profiles from authenticated;
grant  update (full_name, handle, bio, avatar_path, fotos, birth_date, jornada,
               etapa, program_code, area, cargo, intenciones,
               last_lat, last_lng, last_geo_at,
               onboarding_completed_at, last_active_at)
  on public.profiles to authenticated;

comment on policy profiles_lectura on public.profiles is
  'Un aprendiz no puede leer NI UNA FILA de un funcionario, y viceversa. '
  'La separacion de mundos empieza en el SELECT, no en la interfaz.';


create policy profile_interests_lectura on public.profile_interests
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id));

create policy profile_interests_propios on public.profile_interests
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());


-- -----------------------------------------------------------------------------
-- Bloqueos y reportes
-- -----------------------------------------------------------------------------
create policy blocks_propios on public.blocks
  for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid() and blocked_id <> auth.uid());

create policy reports_crear on public.reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

create policy reports_lectura on public.reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.es_admin());

create policy reports_moderacion on public.reports
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());

create policy moderation_log_lectura on public.moderation_log
  for select to authenticated using (public.es_admin());


-- -----------------------------------------------------------------------------
-- Swipes y matches: lectura sí, escritura nunca desde el cliente
-- -----------------------------------------------------------------------------
create policy swipes_propios on public.swipes
  for select to authenticated using (swiper_id = auth.uid());

create policy matches_participante on public.matches
  for select to authenticated
  using (auth.uid() in (a_id, b_id));

revoke insert, update, delete on public.swipes, public.matches from authenticated;

comment on table public.swipes is
  'Sin INSERT desde el cliente: la unica via es swipe(), que aplica cupo diario, '
  'visibilidad y reciprocidad en una sola transaccion.';


-- -----------------------------------------------------------------------------
-- Parches
-- -----------------------------------------------------------------------------
create policy activities_lectura on public.activities
  for select to authenticated
  using (host_id = auth.uid() or public.es_admin() or public.puedo_ver_parche(id));

-- El anfitrión retoca su parche; el alcance, el cupo y la esfera no se tocan.
create policy activities_host_update on public.activities
  for update to authenticated
  using (host_id = auth.uid() and status in ('abierto','lleno'))
  with check (host_id = auth.uid());

revoke insert, delete on public.activities from authenticated;
revoke update on public.activities from authenticated;
grant  update (title, description, place_label, aprobacion, solo_verificados)
  on public.activities to authenticated;


create policy activity_participants_lectura on public.activity_participants
  for select to authenticated
  using (
    profile_id = auth.uid()
    or public.es_admin()
    or exists (select 1 from public.activities a
                where a.id = activity_id
                  and (a.host_id = auth.uid() or public.puedo_ver_parche(a.id)))
  );

revoke insert, update, delete on public.activity_participants from authenticated;


-- -----------------------------------------------------------------------------
-- Conversaciones y mensajes
-- -----------------------------------------------------------------------------
create policy conversations_miembro on public.conversations
  for select to authenticated using (public.soy_miembro_conv(id));

-- Las conversaciones nacen de un trigger (match o parche), nunca de una llamada.
revoke insert, update, delete on public.conversations from authenticated;

create policy conversation_members_lectura on public.conversation_members
  for select to authenticated using (public.soy_miembro_conv(conversation_id));

create policy conversation_members_propio on public.conversation_members
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

revoke insert, delete on public.conversation_members from authenticated;
revoke update on public.conversation_members from authenticated;
grant  update (last_read_at, silenciada) on public.conversation_members to authenticated;


-- ¿Puedo escribir aquí? Miembro + conversación viva + sin bloqueo de por medio.
create or replace function public.puedo_escribir_conv(p_conv uuid)
returns boolean
language plpgsql stable security definer set search_path = public, extensions as $fn$
declare
  c    public.conversations;
  m    public.matches;
  a    public.activities;
  otro uuid;
begin
  select * into c from public.conversations where id = p_conv;
  if c.id is null or c.archivada then return false; end if;
  if not public.soy_miembro_conv(p_conv) then return false; end if;

  if c.kind = 'match' then
    select * into m from public.matches where id = c.match_id;
    if not m.activo then return false; end if;
    otro := case when m.a_id = auth.uid() then m.b_id else m.a_id end;
    return not public.hay_bloqueo(auth.uid(), otro);
  end if;

  select * into a from public.activities where id = c.activity_id;
  -- El chat del parche muere con el parche (0008 lo archiva por cron).
  return a.status not in ('cancelado','vencido');
end $fn$;


create policy messages_lectura on public.messages
  for select to authenticated
  using (public.soy_miembro_conv(conversation_id));

create policy messages_escritura on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.puedo_escribir_conv(conversation_id)
  );

-- Solo se edita lo propio, y solo para corregir o borrar.
create policy messages_propio_update on public.messages
  for update to authenticated
  using (sender_id = auth.uid() and created_at > now() - interval '15 minutes')
  with check (sender_id = auth.uid());

revoke update on public.messages from authenticated;
grant  update (body, edited_at, deleted_at) on public.messages to authenticated;
revoke delete on public.messages from authenticated;


-- -----------------------------------------------------------------------------
-- Ejecución de funciones: solo lo que el cliente debe poder llamar
-- -----------------------------------------------------------------------------
revoke execute on function public.admin_cambiar_estado(uuid, public.profile_status, text) from authenticated;
revoke execute on function public.admin_avalar_instructor(uuid, text) from authenticated;
grant  execute on function public.admin_cambiar_estado(uuid, public.profile_status, text) to authenticated;
grant  execute on function public.admin_avalar_instructor(uuid, text) to authenticated;
-- (Ambas verifican es_admin() por dentro; el GRANT las deja llamables y la
--  función decide. Así el error es "42501 requiere rol admin" y no un 404.)
