# Plataforma inmobiliaria multi-tenant

Sitio público y panel de gestión para agentes inmobiliarios en Ecuador. Cada agente (tenant) tiene su dominio, su catálogo de propiedades y un embudo que califica al visitante y le deja agendar una cita. Incluye CRM de prospectos, recordatorios por email y WhatsApp, webhooks de Meta (WhatsApp, Messenger, Instagram y Lead Ads), Conversions API, Google Calendar y un asistente de IA en el chat.

- Arquitectura y decisiones: [`docs/adr/0001-arquitectura.md`](docs/adr/0001-arquitectura.md).
- Reglas para quien contribuye (personas o agentes): [`AGENTS.md`](AGENTS.md).
- Sistema visual: [`docs/design.md`](docs/design.md).

**Stack:** Next.js 16 (App Router), TypeScript estricto, Tailwind v4, Drizzle ORM, Postgres (Supabase en producción, PGlite embebido en dev y tests), Better Auth y jobs en Postgres.

## Requisitos

- Node.js 24 (ver `engines` en `package.json`).
- Nada más para desarrollar: sin `DATABASE_URL` se usa PGlite en `.data/pglite`, sin Docker ni red.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completa lo que tengas; lo vacío queda "no conectado"
npm run db:migrate           # aplica drizzle/*.sql (en PGlite también se aplica al arrancar)
npm run db:seed              # tenant DEFAULT_TENANT_SLUG, dominios localhost y cuenta del agente
npm run dev                  # http://localhost:3000 (sitio) y /panel/ingresar (panel)
```

- Si no defines `SEED_OWNER_PASSWORD`, el seed genera una contraseña temporal y la muestra una sola vez en la terminal.
- El seed es idempotente. Si existe `WHATSAPP_PHONE_NUMBER_ID`, lo registra como cuenta de WhatsApp del tenant (`channel_accounts`).
- `ENCRYPTION_KEY` y `BETTER_AUTH_SECRET` se generan con `openssl rand -base64 32`.
- Los PDFs de propiedades se importan desde el panel (Propiedades → Importar). El script `npm run import:pdfs` apunta a `scripts/import-pdfs.ts`, que todavía no está en el repositorio.

## Calidad

```bash
npm run typecheck   # next typegen + tsc
npm run lint
npm test            # Vitest: servicios, RLS, integraciones con fetch simulado (sin llamadas reales)
npm run check       # los tres anteriores
```

Pruebas end-to-end con Playwright (escritorio y móvil):

```bash
npx playwright install chromium   # la primera vez
npm run test:e2e                  # levanta su propio servidor con .data/pglite-e2e y datos de prueba
E2E_PORT=3403 npx playwright test e2e/funnel.spec.ts   # un archivo, en otro puerto
```

## Despliegue

Vercel + Supabase: paso a paso en [`docs/deploy.md`](docs/deploy.md).

## Integraciones

Email (Resend), WhatsApp Cloud API, webhooks de Meta, Conversions API, Google Calendar y el asistente IA: cómo obtener cada credencial y qué hace el sistema sin ella en [`docs/integrations.md`](docs/integrations.md). Nunca se simula una conexión: sin credenciales, el panel muestra "No conectado" y los jobs quedan en `blocked`.

## Estructura

```
src/app/(public)     sitio público por tenant (catálogo, propiedad, contacto, agenda, privacidad)
src/app/panel        panel de gestión
src/app/api          webhooks, cron de jobs, chat, opt-out, OAuth de Google
src/modules/*        dominio y servicios (properties, crm, funnels, integrations, jobs, …)
src/server           base de datos, tenant por Host, sesión y rate limit
drizzle/             migraciones SQL (generadas con npm run db:generate)
e2e/                 pruebas Playwright
```
