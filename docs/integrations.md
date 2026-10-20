# Integraciones

Regla de oro: **nunca simulamos una conexión.** Si falta una credencial, el job queda en `blocked` con el motivo visible ("WhatsApp no conectado: falta WHATSAPP_TOKEN"), los webhooks responden 503 y el chat dice que no está disponible y ofrece WhatsApp del agente o el formulario. Cuando configuras la variable, `unblock([...tipos])` (`src/modules/jobs/queue.ts`) vuelve a encolar los jobs bloqueados.

Las variables van en `.env.local` (dev) o en Vercel (prod). Nunca en el código. Las listas completas están en `src/env.ts`.

## Estado actual

| Canal | Estado | Variables |
|---|---|---|
| Email (Resend) | No conectado | `RESEND_API_KEY`, `EMAIL_FROM` |
| WhatsApp Cloud API | No conectado | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` |
| Webhooks de Meta | No conectado | `META_APP_SECRET`, `META_VERIFY_TOKEN` |
| Messenger / Instagram / Lead Ads | No conectado | `META_PAGE_TOKEN` (+ webhooks) |
| Conversions API | No conectado | `META_PIXEL_ID`, `META_CAPI_TOKEN` |
| Google Calendar | No conectado | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ENCRYPTION_KEY` |
| Asistente IA (Claude) | No conectado | `ANTHROPIC_API_KEY` (modelo: `CLAUDE_MODEL`, por defecto `claude-sonnet-5-5`) |
| Cron de jobs | Requiere `CRON_SECRET` | `CRON_SECRET` |

El panel (`/panel/integraciones`) muestra este estado a partir de `integrations` en `src/env.ts`.

## Jobs y cron

- `vercel.json` llama a `/api/cron/jobs` cada 5 minutos con `Authorization: Bearer $CRON_SECRET`. En el plan Hobby de Vercel los crons solo corren una vez al día: para recordatorios de 1 h se necesita el plan Pro o un cron externo que llame a la misma URL con el header.
- Manejadores registrados (`src/modules/jobs/handlers.ts`): `message.send`, `notify.agent.new_lead`, `notify.agent.booking`, `meta.capi`, `calendar.sync` y `meta.webhook` (reintento de webhooks).
- Errores de red o del proveedor → reintento con backoff (máx. 5). Credencial ausente → `blocked`. Nunca se marca como enviado algo que no salió.
- Cada corrida del runner borra además la IP y el user agent de los envíos del embudo con más de 7 días (`purged` en la respuesta del cron; ver "Conversions API").

## Email (Resend)

- **Qué es:** envío transaccional (confirmaciones, recordatorios, seguimiento, avisos al agente) por la API REST de Resend.
- **Cómo obtenerlo:** crea una cuenta en resend.com, verifica tu dominio (registros SPF y DKIM en el DNS) y genera una API key con permiso de envío.
- **Variables:** `RESEND_API_KEY`; `EMAIL_FROM`, p. ej. `"Laura Mena <hola@tudominio.ec>"` (debe ser del dominio verificado).
- **Detalles:**
  - Cada correo a contactos lleva el enlace de baja (`/api/opt-out?t=…`, firmado con HMAC) y las cabeceras `List-Unsubscribe` y `List-Unsubscribe-Post` (baja en un clic).
  - `reply_to` es el email del perfil del agente.
  - Idempotencia: la `Idempotency-Key` de Resend es el id del job.
- **Opt-out:** el GET muestra una confirmación (los antivirus de correo abren los enlaces) y el POST da de baja. Los contactos con baja no reciben mensajes automáticos (`message_skipped` en el timeline).

## WhatsApp Cloud API

- **Qué es:** mensajes al visitante (confirmación y recordatorios) y al agente, y conversación entrante con el asistente.
- **Cómo obtenerlo:**
  1. En developers.facebook.com, crea una app de tipo Business y añade el producto WhatsApp.
  2. Registra el número y copia el **Phone number ID**.
  3. Crea un usuario de sistema en el Business Manager con permiso `whatsapp_business_messaging` y genera un token permanente.
- **Variables:** `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`. `META_GRAPH_VERSION` va por defecto en `v23.0`.
- **Reglas de Meta:**
  - Los mensajes que inicia el negocio exigen **plantillas aprobadas**.
  - El texto libre solo se permite dentro de las 24 h siguientes al último mensaje del usuario; ahí responde el asistente.
- **Baja por WhatsApp:** si el usuario escribe `BAJA`, `STOP` o `DETENER`, se registra el opt-out y se le confirma.

### Plantillas sugeridas (crear en WhatsApp Manager, idioma "Spanish" `es`, categoría Utility)

Estado de todas: **pendiente de crear y aprobar**. Los nombres y el orden de parámetros deben coincidir con `WHATSAPP_TEMPLATES` en `src/modules/automations/templates.ts`.

| Nombre | Uso | Texto sugerido |
|---|---|---|
| `cita_confirmada` | Confirmación de cita | Hola, {{1}}. Tu cita con {{2}} quedó confirmada para el {{3}}. {{4}} |
| `cita_recordatorio_24h` | 24 h antes | Hola, {{1}}. Te recordamos tu cita con {{2}} mañana, {{3}}. {{4}} |
| `cita_recordatorio_1h` | 1 h antes | Hola, {{1}}. Tu cita con {{2}} empieza a las {{3}}. {{4}} |
| `seguimiento_bienvenida` | No calificado, día 0 (categoría Marketing) | Hola, {{1}}. Gracias por tu interés en {{2}}. Puedes ver las propiedades disponibles aquí: {{3}} |
| `seguimiento_catalogo` | No calificado, día 3 (Marketing) | Hola, {{1}}. Te compartimos el catálogo actualizado de {{2}}: {{3}} |
| `cita_inasistencia` | No asistió | Hola, {{1}}. No pudimos encontrarnos en tu cita con {{2}}. Si aún te interesa, elige otro horario aquí: {{3}} |
| `invitacion_agendar` | Lead Ads → agenda | Hola, {{1}}. Gracias por tu interés. Responde unas preguntas cortas y elige el horario para tu cita con {{2}}: {{3}} |
| `agente_nuevo_prospecto` | Aviso al agente | Nuevo prospecto: {{1}} ({{2}}). Origen: {{3}}. Ábrelo en el panel: {{4}} |
| `agente_nueva_cita` | Aviso al agente | Nueva cita: {{1}} el {{2}}. Ábrela en el panel: {{3}} |

En el parámetro {{4}} de las citas va el enlace para gestionar la cita (si está disponible) o la modalidad: videollamada, llamada o presencial.

## Webhooks de Meta (`/api/webhooks/meta`)

- **Configuración:**
  1. En la app de Meta, ve a Webhooks y define la URL de callback `https://<tu dominio>/api/webhooks/meta` y el **Verify token** (el mismo valor que `META_VERIFY_TOKEN`).
  2. Suscribe los campos:
     - WhatsApp Business Account → `messages`.
     - Page → `messages` y `leadgen`.
     - Instagram → `messages`.
  3. `META_APP_SECRET` es el "App secret" de la app (Configuración → Básica).
- **Seguridad:**
  - Se verifica `X-Hub-Signature-256` (HMAC-SHA256 del cuerpo crudo, en tiempo constante). Firma inválida → 401. Sin secreto → 503.
  - Límite de 1 MB por payload.
- **Idempotencia:** `webhook_events (provider, event_id)` es único, así que un reenvío de Meta no se procesa dos veces.
- **Procesamiento:**
  - Se responde 200 enseguida y el evento se procesa con `after()`.
  - Un job `meta.webhook` (a los 2 min) reintenta lo que haya fallado o quedado bloqueado.
- **Qué se procesa:**
  - **WhatsApp:** contacto (por teléfono), conversación y mensaje en el historial, y respuesta del asistente si la IA y WhatsApp están conectados y la conversación no fue derivada a un humano.
  - **Messenger / Instagram:** igual, sin crear contacto (solo se conoce el PSID). La respuesta sale por la Send API con `META_PAGE_TOKEN`.
  - **Lead Ads (`leadgen`):**
    1. Recupera el lead con la Graph API (`META_PAGE_TOKEN`, permiso `leads_retrieval`).
    2. Crea el contacto y un deal `new` con `source: "meta_lead_ads"`.
    3. Avisa al agente.
    4. Envía la plantilla `lead_booking_invite` (email y/o WhatsApp) con el enlace del embudo activo (`/agenda/<slug>?utm_source=facebook&utm_medium=lead_ads`).
    Así el formulario instantáneo también termina en el calendario. Sin `META_PAGE_TOKEN`, el evento queda `blocked`.
  - **Consentimiento en Lead Ads:** se otorga en el formulario de Meta bajo la política de privacidad del anunciante; no se registra nuestro `CONSENT_TEXT`. Queda anotado en la actividad `lead_ads`. La política enlazada en el formulario debe cubrir el contacto por email y WhatsApp.
- **Tenant (`channel_accounts`):**
  - Cada tenant registra sus cuentas de Meta: `whatsapp` (Phone number ID), `page` (Page ID; Messenger y Lead Ads) e `instagram` (ID de la cuenta profesional). Un ID pertenece a un solo tenant (`unique (provider, external_id)`).
  - `resolveTenant` (`src/modules/integrations/meta-webhook.ts`) busca el ID receptor del evento con el rol del sistema, porque aún no hay tenant.
  - **Fallback a `DEFAULT_TENANT_SLUG`**, solo mientras el enrutamiento no está configurado, para no entregar nunca un mensaje a un tenant que no es dueño de la cuenta:
    - si el proveedor ya tiene alguna cuenta registrada, un ID desconocido se ignora;
    - un `phone_number_id` distinto de `WHATSAPP_PHONE_NUMBER_ID` se ignora;
    - en producción, solo si el tenant por defecto es el único tenant (despliegue de un solo agente). Con dos o más tenants, todo ID debe estar registrado.
  - Un evento sin tenant se guarda en `webhook_events` con estado `ignored`, `tenant_id` nulo y solo el ID de la cuenta (sin el contenido del mensaje), y se registra un `warn` en el log. No se procesa.
  - El seed registra `WHATSAPP_PHONE_NUMBER_ID` para `DEFAULT_TENANT_SLUG`. Las demás cuentas se gestionan con `src/modules/integrations/channel-accounts.ts` (`listChannelAccounts`, `registerChannelAccount`, `removeChannelAccount`; solo `owner`/`admin`, con audit log). Mientras no exista la pantalla en el panel:
    ```sql
    insert into channel_accounts (tenant_id, provider, external_id, label)
    select id, 'page', '<PAGE_ID>', 'Página principal' from tenants where slug = 'piloto';
    ```
  - Pendiente: las respuestas por Messenger/Instagram y Lead Ads usan un único `META_PAGE_TOKEN` por despliegue. Para varias páginas hace falta un token por cuenta. Tampoco se verifica todavía con la Graph API que quien registra un ID sea su dueño, así que conviene que lo registre el operador de la plataforma.

## Conversions API

- **Qué es:** los eventos `Lead` y `Schedule` del embudo enviados desde el servidor. Se deduplican con el Pixel porque comparten `event_id`.
- **Cómo obtenerlo:** en el Events Manager, elige el Pixel → Configuración → Conversions API → "Generar token de acceso".
- **Variables:** `META_PIXEL_ID`, `META_CAPI_TOKEN`.
- **Datos enviados:**
  - `em` y `ph`: email en minúsculas y teléfono solo con dígitos y código de país, ambos con hash SHA-256.
  - `external_id`: hash del id de contacto.
  - `fbc` y `fbp` (de la URL o la cookie), `event_time`, `event_id`, `action_source: "website"`, `event_source_url` y `custom_data.content_name`.
  - Cada evento se registra en `ad_events`, único por `(tenant, event_name, event_id)`: un reintento nunca lo duplica.
  - `client_ip_address` y `client_user_agent`, sin hash como pide Meta.
- **IP y user agent (datos personales):**
  - Se guardan en `funnel_submissions.client_ip` / `client_ua` solo si la CAPI está conectada (`META_PIXEL_ID` y `META_CAPI_TOKEN`); sin ella no se recogen.
  - Salen de los headers de la Server Action: `x-vercel-forwarded-for`, luego `x-real-ip` y luego `x-forwarded-for`. En Vercel los fija la plataforma (descarta lo que mande el cliente); fuera de Vercel solo son confiables detrás de un proxy que los sobrescriba. Se descartan los valores que no son IP y las de loopback.
  - Al reservar se vuelven a capturar para el evento `Schedule`.
  - Se borran apenas se envía con éxito el evento que los usa. Si se volvieron a capturar al reservar, el envío del `Lead` no los borra y esperan al `Schedule` (se compara `client_captured_at` con la creación del job).
  - Lo que no llegue a enviarse (CAPI caída, job fallido) se borra a los 7 días con el barrido del runner.
  - No se copian a `ad_events`: el payload guardado omite IP y user agent.

## Google Calendar

- **Qué es:** cada cita se crea en el calendario del agente (con Meet si es videollamada) y se elimina al cancelarla. El free/busy de Google se resta de los horarios disponibles.
- **Cómo obtenerlo:**
  1. En Google Cloud Console, crea un proyecto y habilita la Google Calendar API.
  2. Configura la pantalla de consentimiento OAuth (externa, con los scopes `calendar.events` y `calendar.freebusy`).
  3. Crea credenciales "ID de cliente OAuth – aplicación web".
  4. Agrega como URI de redirección `https://<cada dominio del tenant>/api/integrations/google/callback`, más `http://localhost:3000/...` para dev.
- **Variables:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `ENCRYPTION_KEY` (32 bytes en base64: `openssl rand -base64 32`).
- **Flujo:**
  1. El panel enlaza a `GET /api/integrations/google/start`, que exige sesión y perfil de agente.
  2. El `state` va firmado con HMAC (tenant, usuario, agente, nonce y expiración a 10 min) y ligado a una cookie `HttpOnly`.
  3. El callback verifica el `state` y que la sesión actual sea la misma, y guarda los tokens cifrados con AES-256-GCM en `calendar_connections`.
  4. Redirige a `/panel/integraciones?google=conectado|estado_invalido|cancelado|error|no_configurado|sin_perfil`.
- **Sin conexión:** `calendar.sync` termina en `done` con la nota "Google Calendar no está conectado" en el timeline. La agenda propia sigue siendo la fuente de verdad.
- **Disponibilidad con Google:** `googleBusyProvider(db, tenantId)` en `src/modules/integrations/google.ts`. Precarga las conexiones *antes* de la transacción de `availableSlots`/`bookSlot` y las Server Actions del embudo lo pasan como `busyProvider`.

## Asistente IA (`/api/chat`, `<ChatWidget />`)

- **Qué es:** Claude con herramientas:
  - `buscar_propiedades`, `ver_propiedad`, `comparar_propiedades`.
  - `capturar_prospecto`: exige que el asistente haya mostrado `CONSENT_TEXT` y que el visitante lo acepte después; se verifica en el código contra el historial guardado.
  - `agendar_cita`: entrega el enlace del embudo, no reserva.
  - `derivar_a_humano`: marca `handoffRequestedAt` y encola `notify.agent.new_lead`.
- **Cómo obtenerlo:** en console.anthropic.com, genera una API key. Variables: `ANTHROPIC_API_KEY` y, opcionalmente, `CLAUDE_MODEL`.
- **Seguridad:**
  - Las herramientas solo reciben el `tenantId` del servidor y devuelven campos públicos (`toPublic`).
  - Un avalúo nunca se muestra como precio.
  - Hay rate limit por IP (30 mensajes cada 10 min) y por conversación (8 por minuto), y un tope de 20 turnos por conversación.
  - El navegador guarda un token firmado de la conversación: con otro id no se puede leer una conversación ajena.
- **Modelo:**
  - `claude-sonnet-5-5`, con `effort: "low"` para respuestas cortas y prompt cacheado.
  - Fallback del lado del servidor ante rechazos (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`), habilitado para los modelos que lo admiten. Si el modelo rechaza, el asistente responde con un mensaje neutro y ofrece derivar.
- **Datos:** el contenido de la conversación se envía a Anthropic (proveedor de IA). Lo explica `/privacidad` cuando la IA está conectada.
- **Widget:** `import { ChatWidget } from "@/components/chat"`. Props: `whatsappHref` (enlace `wa.me` del agente) y `contactHref` (por defecto `/contacto`). Está montado en el layout del sitio público (`src/app/(public)/(site)/layout.tsx`).

## Política de privacidad (`/privacidad`)

- Se arma con lo que el sistema recoge de verdad y muestra cada sección según las integraciones conectadas (Píxel, CAPI, IA, email, WhatsApp, Google).
- El responsable sale del perfil del agente. Razón social, RUC o cédula, dirección y plazo máximo de conservación no existen en el perfil: se muestran como "Pendiente de completar".
- Fuera de producción se ve un aviso de "borrador pendiente de revisión legal". Antes de lanzar, un abogado debe revisar el texto y completar esos campos.

## Cambios solicitados

Todos resueltos. Se dejan como registro:

1. **Enlace de gestión en la confirmación** — resuelto. `bookSlot` cifra el token (`encrypt`, requiere `ENCRYPTION_KEY`) y lo pasa como `manageTokenEnc` en el payload de la secuencia `booking_created`; `message.send` lo descifra. Sin `ENCRYPTION_KEY`, el mensaje sale sin enlace.
2. **Busy de Google en las reservas** — resuelto. `src/app/(public)/(focus)/agenda/[slug]/actions.ts` pasa `googleBusyProvider(...)` a `availableSlots` y a `bookSlot`.
3. **IP y user agent para la CAPI** — resuelto (migración `0004_channel_accounts_and_capi_client.sql`). Ver "Conversions API".
4. **Multi-tenant en webhooks (`channel_accounts`)** — resuelto (misma migración, con `GRANT` a `app_user`). Ver "Webhooks de Meta → Tenant". Falta la pantalla del panel para gestionar las cuentas.
5. **Montar `<ChatWidget />`** — resuelto en el layout del sitio público.
