-- =============================================================================
-- SENA MATCH v3 · Pruebas que fallan si vuelve un agujero
-- =============================================================================
-- Ejecutar con:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 01_esferas_y_rls.test.sql
-- Cada bloque levanta EXCEPTION si la regla se rompió. Si el archivo termina sin
-- error, el esquema cumple las cuatro invariantes que sostienen el producto.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- -----------------------------------------------------------------------------
-- 1. RLS habilitada en todas las tablas de `public`. Sin excepciones.
-- -----------------------------------------------------------------------------
do $$
declare v_faltan text;
begin
  select string_agg(c.relname, ', ') into v_faltan
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

  if v_faltan is not null then
    raise exception 'Tablas sin RLS: %', v_faltan;
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 2. Ninguna política de UPDATE sin WITH CHECK.
--    (Sin WITH CHECK se puede escribir en una fila un valor que no podrías ver.)
-- -----------------------------------------------------------------------------
do $$
declare v_malas text;
begin
  select string_agg(policyname || ' en ' || tablename, ', ') into v_malas
    from pg_policies
   where schemaname = 'public' and cmd = 'UPDATE' and with_check is null;

  if v_malas is not null then
    raise exception 'Politicas UPDATE sin WITH CHECK: %', v_malas;
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 3. Las tablas que solo escribe el servidor no aceptan escritura del cliente.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  v_priv text;
begin
  foreach t in array array['matches','swipes','activities','activity_participants',
                           'conversations','notifications','roster']
  loop
    select string_agg(privilege_type, ',') into v_priv
      from information_schema.role_table_grants
     where table_schema = 'public' and table_name = t
       and grantee = 'authenticated'
       and privilege_type in ('INSERT','DELETE');

    if v_priv is not null then
      raise exception 'authenticated todavia tiene % sobre %', v_priv, t;
    end if;
  end loop;
end $$;


-- -----------------------------------------------------------------------------
-- 4. El rol no es escribible desde el cliente.
-- -----------------------------------------------------------------------------
do $$
declare v_cols text;
begin
  select string_agg(column_name, ', ') into v_cols
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'profiles'
     and grantee = 'authenticated' and privilege_type = 'UPDATE'
     and column_name in ('role','verification','status','esfera','email',
                         'asistencias','inasistencias');

  if v_cols is not null then
    raise exception 'El cliente puede escribir columnas de gobierno: %', v_cols;
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 5. La frontera de esferas: dos perfiles de esferas distintas nunca se ven.
-- -----------------------------------------------------------------------------
do $$
declare
  v_aprendiz uuid := '11111111-1111-1111-1111-111111111111';
  v_docente  uuid := '22222222-2222-2222-2222-222222222222';
  v_visible  boolean;
begin
  insert into auth.users (id, email) values
    (v_aprendiz, 'prueba.aprendiz@misena.edu.co'),
    (v_docente,  'prueba.docente@sena.edu.co')
  on conflict do nothing;

  update public.profiles
     set center_id = 9101, birth_date = current_date - interval '25 years',
         intenciones = array['cita','amistad']::public.intent[],
         onboarding_completed_at = now()
   where id in (v_aprendiz, v_docente);

  -- Se simula la sesión del aprendiz.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_aprendiz::text)::text, true);

  select public.puedo_ver_perfil(v_docente, 'amistad') into v_visible;
  if v_visible then
    raise exception 'FALLA CRITICA: un aprendiz ve a un instructor en el mazo';
  end if;

  select public.puedo_ver_perfil(v_docente, 'cita') into v_visible;
  if v_visible then
    raise exception 'FALLA CRITICA: cruce de rol en modo cita';
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 6. Modo cita: apagado por defecto y cerrado a menores de edad.
-- -----------------------------------------------------------------------------
do $$
declare v_encendido boolean;
begin
  select bool_or(modo_cita_aprendices or modo_cita_equipo or parches_mixtos)
    into v_encendido from public.center_config;

  if coalesce(v_encendido, false) then
    raise exception 'Un centro tiene interruptores sensibles encendidos por defecto';
  end if;
end $$;

rollback;

\echo 'Todas las invariantes se cumplen.'
