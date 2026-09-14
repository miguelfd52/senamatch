# SENA Match v3 — Especificación de producto y arquitectura

**Red social híbrida para la comunidad SENA: descubrimiento 1 a 1 por afinidad + parches (planes grupales efímeros).**

Documento de trabajo · versión 3.0 · 8 de septiembre de 2026
Reemplaza el enfoque «solo profesional» de SENA Network v2 y recupera el
descubrimiento social, esta vez con las barreras de rol y edad escritas en la
base de datos.

---

## 0. Una advertencia que conviene leer antes de construir

Este documento diseña una app que incluye **modo cita** dentro de una
institución educativa donde conviven menores de edad, aprendices adultos e
instructores con poder de evaluación sobre ellos. Eso no es un detalle de
interfaz: es el riesgo principal del producto. La arquitectura responde con tres
barreras que **no viven en el cliente**, sino en Postgres:

| Riesgo | Barrera técnica | Dónde |
|---|---|---|
| Un instructor y un aprendiz terminan en una conversación privada | Columna generada `esfera`; ninguna consulta cruza la frontera, ni siquiera el `SELECT` de perfiles | `0002`, `0003`, `0007` |
| Un menor de edad aparece en el mazo romántico | `puedo_ver_perfil()` exige `edad >= 18` en ambas partes para `intent = 'cita'` | `0003` |
| El centro no aprobó el modo cita y se enciende igual | `center_config.modo_cita_aprendices` nace en `false`; sin ese interruptor el mazo devuelve vacío | `0001`, `0003` |

Además, dos límites del dominio que ya conocemos y siguen vigentes: **Sofia Plus
no expone API pública**, así que la matrícula se valida con correo institucional
+ padrón de fichas + aval humano; y **el nombre «SENA» y el verde `#39A900` son
marca institucional**, que requiere aval antes de cualquier piloto público.

---

## 1. Módulos principales

### 1.1 Mapa de la aplicación

```
                    ┌──────────────────────────────┐
                    │   Registro OTP institucional  │
                    │  @misena.edu.co / @sena.edu.co│
                    └──────────────┬───────────────┘
                                   │  el dominio decide el rol
                  ┌────────────────┴─────────────────┐
                  ▼                                  ▼
        ESFERA APRENDICES                     ESFERA EQUIPO
        (aprendiz, egresado)                  (instructor, bienestar)
                  │                                  │
    ┌─────────────┼─────────────┐        ┌───────────┴──────────┐
    ▼             ▼             ▼        ▼                      ▼
 Descubrir     Parches       Feed     Sala de profes         Parches
 (swipe)      grupales    del centro  (colegas)            del equipo
    │             │             │        │                      │
    └──────┬──────┴─────────────┘        └──────────┬───────────┘
           ▼                                        ▼
     Chat 1a1 + Chat de parche              Chat 1a1 + Chat de parche
                       (mismo motor, distinta membresía)
```

Las dos esferas comparten **todo el código** y **ninguna fila**.

### 1.2 Apartado Aprendices

| Pantalla | Qué hace | Fuente de datos |
|---|---|---|
| **Descubrir** | Mazo de perfiles del mismo centro, filtrado por la intención activa (`cita`, `amistad`, `estudio`, `deporte`). Cada tarjeta muestra el porqué: «mismo centro · 3 intereses en común · jornada mañana» | `mazo(intent, limit)` |
| **Matches** | Lista de coincidencias por intención; abre el chat 1 a 1 | `matches` + `v_bandeja` |
| **Parches** | Crear un plan: título, tipo, lugar, hora, cupo, ¿con aprobación? | `crear_parche(...)` |
| **Feed del centro** | Parches vivos ordenados por hora de inicio, con distancia y cupos libres | `feed_parches(radio, kinds, ...)` |
| **Mis planes** | Lo que organizo y lo que confirmé, con recordatorio 30 min antes | `activity_participants` |
| **Chats** | Bandeja unificada: 1 a 1 y grupales de parche | `v_bandeja` |

**Selector de intención**, permanente en la parte superior de Descubrir. No es un
filtro cosmético: cambia la consulta y la regla de match. Alguien que solo marcó
`estudio` jamás será mostrado a alguien que busca `cita`, ni al revés.

### 1.3 Apartado Instructores (exclusivo)

Se activa cuando `role ∈ {instructor, bienestar}` **y** `verification =
'institucional'` (es decir, coordinación ya avaló la cuenta). Antes de ese aval,
un correo `@sena.edu.co` puede entrar a la app pero no ve la sala del equipo.

| Pantalla | Qué hace |
|---|---|
| **Sala de profes** | Directorio + mazo `colegas` de la misma sede: área, programa, intereses. Sirve para armar dupla de proyecto, buscar quién dicta lo mismo en otra jornada, o simplemente conocer gente nueva del centro |
| **Parches del equipo** | Desayunos, almuerzo de área, caminata, integración de fin de trimestre, torneos de bienestar |
| **Bienestar** | Solo `role = 'bienestar'`: publica parches `institucionales`, únicos que pueden ser **mixtos** (aprendices + equipo) y solo si el centro encendió `parches_mixtos` |

**La privacidad es recíproca**: el aprendiz tampoco ve al instructor. No existe
un modo «ver al otro lado». Un instructor que quiera convocar aprendices lo hace
con un parche institucional, que queda marcado, es visible para el centro y
tiene chat grupal moderado — nunca un canal privado 1 a 1.

### 1.4 Módulo de Parches

Un parche es una **invitación con caducidad**. Su ciclo de vida:

```
 crear_parche()          unirse_parche()        starts_at        expires_at        +N horas
      │                        │                    │                 │                │
      ▼                        ▼                    ▼                 ▼                ▼
  [abierto] ──cupo lleno──> [lleno] ──────────> [en_curso] ─────> [vencido] ───> chat archivado
      │                                                │
      └── cancelar_parche() ──> [cancelado]            └── marcar_asistencia() ──> [finalizado]
```

Reglas que el código hace cumplir:

- **Cupo real bajo concurrencia.** `unirse_parche()` bloquea la fila de la
  actividad (`select … for update`) antes de contar confirmados. Sin ese candado,
  dos personas entran al mismo último cupo — es el error clásico de esta función.
- **Chat automático.** El parche nace con su conversación grupal; confirmar el
  cupo te mete, salirte te saca, y el chat se archiva unas horas después de que
  el plan termina (`center_config.horas_vida_chat_parche`, 24 h por defecto).
- **Aprobación opcional.** Con `aprobacion = true` el anfitrión decide uno a uno.
- **Reputación de asistencia.** El anfitrión marca quién llegó. Tres plantones
  acumulados y solo puedes pedir cupo en parches con aprobación. Es la única
  forma de que un plan de desayuno para 6 no se llene de confirmaciones vacías.
- **Ubicación redondeada.** Las coordenadas se guardan con 3 decimales (~100 m).
  El lugar se comunica con `place_label` («Cafetería central, bloque B»), no con
  un punto exacto en el mapa.

---

## 2. Roles, permisos y autenticación

### 2.1 Registro

1. La persona escribe su correo. Si no termina en `@misena.edu.co` o
   `@sena.edu.co`, `handle_new_user()` lanza excepción y la cuenta **no se crea**.
2. Supabase Auth envía un OTP de 6 dígitos (magic link deshabilitado: en móvil
   el enlace abre el navegador equivocado la mitad de las veces).
3. Al confirmarse, el trigger crea el perfil y **deriva el rol del dominio**. El
   formulario de registro no envía rol; si lo enviara, se ignora.
4. Onboarding: nombre, foto, fecha de nacimiento, centro + ficha, jornada,
   intereses, intenciones. Hasta cerrarlo, `puede_participar()` es `false` y la
   persona no aparece en ningún mazo ni puede crear parches.
5. `verificar_ficha(centro, ficha)` sube el nivel a `ficha` si el par existe en
   el padrón. Los parches con `solo_verificados` piden ese nivel.

### 2.2 Matriz de roles

| Rol | Dominio | Esfera | Mazo | Parches propios | Ve la sala de profes | Modera |
|---|---|---|---|---|---|---|
| `aprendiz` | `@misena.edu.co` | aprendices | cita*, amistad, estudio, deporte | sí | no | no |
| `egresado` | `@misena.edu.co` | aprendices | amistad, estudio | sí | no | no |
| `instructor` | `@sena.edu.co` | equipo | colegas†, cita*† | sí | con aval | no |
| `bienestar` | `@sena.edu.co` | equipo | colegas† | sí, incluidos mixtos | con aval | reportes |
| `moderador` | asignado | equipo | — | — | sí | sí |
| `admin` | asignado | equipo | — | — | sí | sí + configuración |

\* solo si el centro encendió el interruptor y ambas partes son mayores de edad.
† requiere `verification = 'institucional'`.

### 2.3 Filtros de visibilidad — las seis compuertas

`puedo_ver_perfil(otro, intención)` devuelve `true` solo si pasa las seis:

1. Ambas cuentas `activo` y con onboarding cerrado.
2. **Misma esfera.** Aquí muere cualquier cruce aprendiz ↔ instructor.
3. Mismo `center_id`. El descubrimiento es local por diseño.
4. La intención está declarada **por ambas partes**.
5. No hay bloqueo en ningún sentido.
6. Si la intención es `cita`: interruptor del centro encendido **y** ambas
   personas mayores de edad. Si es `colegas`: ambas en esfera equipo con aval.

La misma función se invoca desde el mazo, desde `swipe()` y desde la política
`SELECT` de `profiles`. Un cliente modificado que llame la API directamente
recibe cero filas, no una lista filtrada por la interfaz.

### 2.4 Moderación

- `reports` con motivos tipificados, un reporte por persona/día (corta las
  oleadas coordinadas), y `moderation_log` donde queda **toda** acción de staff.
- `admin_cambiar_estado()` y `admin_avalar_instructor()` son las únicas vías: el
  panel no hace `UPDATE` directo sobre `profiles`.
- Motivos específicos del dominio: `menor_en_modo_cita`, `cruce_de_rol`,
  `no_asistio`.

---

## 3. Estructura de base de datos

### 3.1 `profiles` — usuarios

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | → `auth.users(id)` |
| `email` | `citext` único | dominio institucional obligatorio |
| `handle` | `citext` único | `^[a-z0-9_]{3,20}$`, generado del correo |
| `full_name` | `text` | 3–80 caracteres |
| `role` | `account_role` | **el cliente no tiene GRANT de escritura** |
| `verification` | `verify_level` | `correo` → `ficha` → `institucional` |
| `status` | `profile_status` | `activo`/`pausado`/`suspendido`/`eliminado` |
| `esfera` | `sphere` **generada** | `aprendices` si el rol es aprendiz/egresado; si no, `equipo` |
| `birth_date` | `date` | fecha, no número: la edad se calcula |
| `center_id` | `smallint` | → `centers` |
| `program_code`, `ficha`, `jornada`, `etapa` | | ubicación académica |
| `area`, `cargo` | `text` | perfil del funcionario |
| `bio`, `avatar_path`, `fotos[]` | | máx. 6 fotos, rutas de Storage |
| `intenciones` | `intent[]` | sin esto, el mazo devuelve vacío |
| `last_lat`, `last_lng` | `double precision` | redondeadas a ~100 m |
| `asistencias`, `inasistencias` | `integer` | reputación de parches |
| `onboarding_completed_at`, `last_active_at`, `created_at`, `updated_at` | `timestamptz` | |

### 3.2 `swipes` y `matches`

**`swipes`** — PK `(swiper_id, swiped_id, intent)`; sin política de `INSERT`.

| Columna | Tipo | Notas |
|---|---|---|
| `swiper_id` | `uuid` | quien evalúa |
| `swiped_id` | `uuid` | quien es evaluado |
| `intent` | `intent` | el mismo par puede evaluarse distinto en cada intención |
| `direction` | `swipe_dir` | `pass` / `like` / `super` |
| `created_at` | `timestamptz` | alimenta el cupo diario |

**`matches`** — una fila por pareja e intención, en orden canónico.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `a_id`, `b_id` | `uuid` | `CHECK (a_id < b_id)`: (A,B) y (B,A) son la misma fila |
| `intent` | `intent` | `UNIQUE (a_id, b_id, intent)` |
| `activo` | `boolean` | `cerrar_match()` lo apaga y archiva el chat |
| `cerrado_por` | `uuid` | quién lo cerró |
| `created_at` | `timestamptz` | |

### 3.3 `activities` — parches

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `host_id` | `uuid` | anfitrión |
| `title`, `description` | `text` | 5–80 / ≤600 |
| `kind` | `activity_kind` | desayuno, almuerzo, café, estudio, deporte, integración, cultural, trámite, otro |
| `center_id` | `smallint` | tomado del anfitrión, no del formulario |
| `esfera` | `sphere` | **la fija un trigger** desde el anfitrión |
| `mixto` | `boolean` | única forma de cruzar esferas; exige bienestar/instructor avalado + interruptor del centro |
| `visibility` | `activity_visibility` | `centro`, `ficha`, `programa`, `enlace`, `institucional` |
| `join_code` | `text` único | 6 caracteres, solo si `visibility='enlace'` |
| `place_label`, `lat`, `lng` | | lugar legible + punto redondeado |
| `starts_at`, `duration_min` | | |
| `expires_at` | `timestamptz` **generada** | `starts_at + duration_min` |
| `capacity`, `confirmados` | `smallint` | contador mantenido por trigger |
| `aprobacion`, `solo_verificados` | `boolean` | |
| `status` | `activity_status` | abierto → lleno → en_curso → finalizado / vencido / cancelado |

### 3.4 `activity_participants`

| Columna | Tipo | Notas |
|---|---|---|
| `activity_id` | `uuid` | PK compuesta |
| `profile_id` | `uuid` | PK compuesta |
| `rol` | `text` | anfitrion / copiloto / asistente |
| `status` | `participant_status` | solicitado, confirmado, rechazado, cancelado, asistio, no_asistio |
| `nota` | `text` | «llevo balón» |
| `joined_at`, `decided_at` | `timestamptz` | |

Cada cambio de `status` dispara dos triggers: recuento de cupos y sincronización
de la membresía del chat grupal.

### 3.5 `conversations`, `conversation_members` y `messages`

**`conversations`** — un solo motor para los dos casos.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `kind` | `conversation_kind` | `match` \| `parche` |
| `match_id` | `uuid` único | exclusivo con `activity_id` (CHECK) |
| `activity_id` | `uuid` único | |
| `archivada` | `boolean` | de solo lectura cuando es `true` |
| `last_message_at` | `timestamptz` | ordena la bandeja sin subconsulta |

**`conversation_members`** — PK `(conversation_id, profile_id)`; `last_read_at`,
`silenciada`, `salio_at`. Es la **única** fuente de permiso de lectura.

**`messages`**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `conversation_id` | `uuid` | |
| `sender_id` | `uuid` | nulo en mensajes de sistema |
| `kind` | `message_kind` | texto, imagen, ubicación, sistema |
| `body` | `text` | ≤2000 |
| `attachment_path`, `lat`, `lng` | | |
| `created_at`, `edited_at`, `deleted_at` | `timestamptz` | edición hasta 15 min |

### 3.6 Relaciones

```
auth.users ─1:1─> profiles ─┬─N:M─ interests        (profile_interests)
                            ├─1:N─ swipes ──trigger──> matches ─1:1─> conversations(kind='match')
                            ├─1:N─ activities ───1:1──> conversations(kind='parche')
                            │           └─1:N─ activity_participants ──> conversation_members
                            ├─1:N─ blocks / reports / notifications
                            └─1:N─ messages
centers ─1:1─ center_config      centers ─1:N─ roster
```

---

## 4. Stack tecnológico

| Capa | Elección | Por qué esta y no otra |
|---|---|---|
| **App móvil + web** | Expo SDK 54 (React Native) + Expo Router | Un código para Android, iOS y web. El SENA se usa mucho desde web en las salas de sistemas: descartar la web es descartar la mitad del uso |
| **Estado servidor** | TanStack Query + `supabase-js` | Caché, reintentos y revalidación gratis; el mazo y el feed son consultas cacheables con TTL corto |
| **Backend** | Supabase (Postgres 15 + PostgREST) | La lógica sensible vive en funciones SQL `SECURITY DEFINER`; no hay servidor propio que mantener ni un segundo lugar donde las reglas puedan divergir |
| **Autenticación** | Supabase Auth, OTP por correo | Restricción de dominio en el trigger, no en el cliente |
| **WebSockets** | **Supabase Realtime** sobre la publicación `supabase_realtime` | Es Postgres logical replication con RLS aplicada: cada quien recibe solo lo que podría leer con un `SELECT`. Un Socket.io propio obligaría a reimplementar esas reglas en Node, que es exactamente donde se abren los huecos |
| **Notificaciones push** | Expo Push + Edge Function suscrita a `notifications` | La fila en la tabla es la fuente; el push es un efecto |
| **Geolocalización** | `expo-location` + `cube`/`earthdistance` en Postgres | El radio del feed es de 1–3 km alrededor de una sede: `earth_distance` con índice GiST sobra y evita instalar PostGIS |
| **Almacenamiento** | Supabase Storage, buckets `avatars` y `parches` | Rutas en la base, URLs firmadas de 60 min en el cliente |
| **Moderación de imágenes** | Edge Function con cola | Toda foto entra en cuarentena hasta pasar revisión automática |
| **Diseño** | Sistema «Taller» heredado de v2 (verde SENA tokenizado sobre grafito, Archivo + Public Sans) | Ya existe y es coherente; el ocre `#DFA23C` reemplaza el rosa de las apps de citas |
| **CI** | GitHub Actions: `supabase db lint`, pruebas pgTAP de RLS, EAS Build | Las pruebas de RLS son las que impiden que vuelva un agujero ya cerrado |

### Setup

```bash
npm create expo-app@latest apps/mobile -- --template tabs
npm i @supabase/supabase-js @tanstack/react-query expo-location expo-notifications \
      react-native-url-polyfill zod
npx supabase init && npx supabase start
npx supabase db push          # aplica supabase/migrations/0001..0008
npx supabase gen types typescript --local > packages/api/src/database.types.ts
```

---

## 5. Estructura de carpetas

```
sena-match-v3/
├── apps/
│   └── mobile/                    Expo Router · Android, iOS y web
│       ├── app/
│       │   ├── (auth)/            correo institucional, OTP, onboarding
│       │   ├── (aprendices)/      descubrir · parches · feed · chats
│       │   ├── (equipo)/          sala de profes · parches del equipo
│       │   ├── parche/[id].tsx    detalle, lista de confirmados, unirse
│       │   └── chat/[id].tsx      1 a 1 y grupal (mismo componente)
│       ├── components/            TarjetaPerfil, TarjetaParche, Mazo…
│       ├── hooks/                 useMazo, useFeedParches, useConversacion
│       └── lib/                   supabase.ts, sesion.ts, geo.ts
├── packages/
│   ├── core/                      reglas puras compartidas (sin dependencias)
│   ├── api/                       cliente tipado + tipos generados de la base
│   └── ui/                        sistema de diseño «Taller»
├── supabase/
│   ├── migrations/                0001…0008 · el esquema entero
│   ├── functions/                 Edge Functions (push, moderación de imágenes)
│   ├── tests/                     pgTAP: RLS y separación de esferas
│   └── seed.sql                   datos de desarrollo
├── docs/
└── scripts/
```

---

## 6. Orden de construcción sugerido

| Hito | Contenido | Señal de que está listo |
|---|---|---|
| **H1 · Cimiento** | Migraciones 0001–0003, registro OTP, onboarding | Un correo `@gmail.com` no crea cuenta; un aprendiz no ve ni una fila de un instructor |
| **H2 · Parches** | 0005 + feed + detalle + chat grupal | Dos sesiones simultáneas peleando el último cupo: entra una sola |
| **H3 · Descubrimiento** | 0004 + mazo + swipe + match | Con el interruptor de citas apagado, el mazo `cita` devuelve vacío |
| **H4 · Tiempo real** | 0006 + 0008 + Realtime + push | Mensaje visible en el otro dispositivo en menos de un segundo |
| **H5 · Moderación** | Panel, reportes, bitácora, pruebas pgTAP | Las pruebas de RLS pasan en CI y fallan al quitar una política |
| **H6 · Piloto** | Un centro, 4–6 semanas, con aval de bienestar | Métrica que importa: parches con asistencia confirmada, no descargas |
