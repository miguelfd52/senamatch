# SENA Match v3

Red social híbrida para la comunidad SENA: **descubrimiento 1 a 1 por afinidad**
(swipe y match) + **parches**, que son planes grupales efímeros con cupo y chat
automático — «¿quién para desayunar en la cafetería a las 9:00?».

La especificación completa está en [`docs/especificacion.md`](docs/especificacion.md).

---

## Qué es esto y qué relación tiene con lo anterior

| Carpeta en el escritorio | Qué contiene |
|---|---|
| `sena-match/` | El prototipo original (HTML + JS + Supabase), ya parcheado |
| `sena-network/` | La v2, que quitó el descubrimiento social y lo volvió solo profesional |
| `sena-match-v3/` | **Este proyecto**: recupera el descubrimiento social y añade los parches, con las barreras de rol y edad escritas en la base |

La v3 no es un retroceso a la v1: el modo cita existe, pero nace **apagado**, es
un interruptor por centro, exige mayoría de edad en ambas partes, y jamás cruza
la frontera entre aprendices y funcionarios.

---

## La app que ya funciona

`web/app.html` es SENA Match funcionando: un archivo, sin compilación y sin
dependencias. Publicada en
https://claude.ai/code/artifact/e9b0c530-c563-4eb1-ae13-35029c3a4b02

Hace de verdad:

| Módulo | Qué incluye |
|---|---|
| Identidad | Registro por dominio institucional, entrada de prueba, edición de perfil con avatar propio |
| Descubrir / Sala | Mazo por afinidad con los porqués a la vista, deshacer el último descarte, tira de «te marcaron», directorio para la esfera equipo |
| Parches | Plantillas rápidas, filtros, código de invitación, aprobación de solicitudes, estado vivo («empieza en 25 min»), asistencia y reputación |
| Agenda | Lo que viene, solicitudes por responder, historial y contador de asistencias |
| Chats | 1 a 1 y grupal en vivo, con salto al perfil o al parche |
| Seguridad | Bloqueo recíproco, reporte con motivos tipificados, novedades derivadas del estado |

El cupo se respeta bajo concurrencia con `acquire()` sobre el documento del
parche: el mismo candado que el `select … for update` de la migración `0005`.

**Identidad visual «Turno»**, propia de esta app y distinta del verde
institucional que usan los demás proyectos: ciruela profunda, mandarina para lo
que se toca, menta para lo confirmado y ámbar para el tiempo, con las cifras en
monoespaciada y las tarjetas de parche cortadas como un talón de turno.

## Conectarla a Supabase (lo que la vuelve usable de verdad)

La app trae tres modos y elige sola: **local** (todo en el navegador),
**artifact** (base compartida del enlace) y **supabase** (cuentas reales, datos
compartidos, reglas aplicadas por Postgres). Para el tercero:

1. Crea un proyecto en supabase.com.
2. Abre el editor SQL y ejecuta **`supabase/app/esquema.sql`** completo. La
   última consulta debe devolver **cero filas**; si devuelve alguna, esa tabla
   quedó sin RLS.
3. En Authentication → Providers deja **Email** habilitado con OTP.
4. Abre la app, entra a la tarjeta **Conexión** y pega `Project URL` y
   `anon key` de Project Settings → API. La app recarga ya conectada.

A partir de ahí el registro es real: código de seis dígitos al correo
institucional, y el trigger `handle_new_user()` rechaza cualquier dominio que no
sea `@misena.edu.co` o `@sena.edu.co` — la cuenta ni siquiera se crea.

Lo que pasa a ser responsabilidad del servidor y no del navegador:

| Regla | Dónde vive con Supabase |
|---|---|
| Un aprendiz no lee ni una fila de un funcionario | Política `perfiles_lectura`, en el `SELECT` |
| El match exige reciprocidad y misma intención | `registrar_swipe()`, con la fila del otro bloqueada |
| El cupo del parche no se sobrevende | `entrar_parche()`, con `FOR UPDATE` sobre el parche |
| Nadie pisa el mensaje de otro | `enviar_mensaje()` añade en el servidor |
| Quién te marcó no se puede raspar | `swipes` solo lo lee su dueño; responde `me_marcaron()` |
| El modo cita lo enciende bienestar | Política `config_staff` |

Sin conectar, siguen valiendo los dos límites de antes: las reglas corren en el
navegador y el enlace del artifact solo lo abre gente de tu organización de
Claude.

> El SQL está escrito y revisado pero **no se ha ejecutado** contra ninguna base:
> en la máquina donde se hizo no hay `psql`, Docker ni la CLI de Supabase.

Los perfiles y parches marcados «perfil de ejemplo» son datos sembrados para que
la app no abra vacía; se pueden borrar.

---

## Estructura

```
sena-match-v3/
├── apps/mobile/           Expo Router · Android, iOS y web
│   ├── app/(auth)         correo institucional, OTP, onboarding
│   ├── app/(aprendices)   descubrir · parches · feed · chats
│   ├── app/(equipo)       sala de profes · parches del equipo
│   ├── hooks/             useMazo, useFeedParches, useConversacion
│   └── lib/supabase.ts    cliente único
├── packages/
│   ├── core/              reglas de dominio en TypeScript (espejo del SQL)
│   ├── api/               tipos generados de la base
│   └── ui/                sistema de diseño «Taller»
├── supabase/
│   ├── migrations/        0001…0008 · el esquema entero
│   ├── tests/             invariantes que fallan si vuelve un agujero
│   └── functions/         Edge Functions (push, moderación de imágenes)
└── docs/especificacion.md
```

---

## Poner en marcha

```bash
npx supabase init && npx supabase start
npx supabase db push
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/01_esferas_y_rls.test.sql
npx supabase gen types typescript --local > packages/api/src/database.types.ts
```

Después, en `apps/mobile/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## Las migraciones, en orden

| Archivo | Qué establece |
|---|---|
| `0001_extensiones_y_catalogos.sql` | Centros, programas, intereses, padrón de fichas y **`center_config`**: los interruptores sensibles nacen apagados |
└── server/                API Node.js + Mongoose/MongoDB
```

---

## Las cuatro cosas que no se pueden romper

1. **Un aprendiz no lee ni una fila de un funcionario, y viceversa.** La barrera
   está en el backend.
2. **El rol nunca llega del cliente.** Lo deriva el servidor del dominio
   del correo ya verificado por OTP.
3. **Ningún menor de edad entra al modo cita**, ni como quien mira ni como quien
   es visto.
4. **El cliente no escribe directamente en las colecciones.** Solo llama
   funciones que validan en el servidor antes de escribir.

---

## Antes de un piloto público

- El nombre «SENA» y el verde `#39A900` son marca institucional: requieren aval.
- **Sofia Plus no tiene API pública.** La matrícula se valida con correo
  institucional + padrón de fichas por centro + revisión de instructor.
- El modo cita necesita aprobación explícita de bienestar del centro antes de
  encender `center_config.modo_cita_aprendices`.
