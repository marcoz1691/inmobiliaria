<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Proyecto: plataforma inmobiliaria multi-tenant

Reglas para cualquier agente (Claude, Codex o humano). Texto de UI en español de Ecuador (tú).

## Contenido (no negociable)
- No inventes propiedades, precios, testimonios, experiencia, certificaciones ni datos personales. Campo ausente = vacío y marcado como incierto.
- No publiques linderos, códigos catastrales ni contactos de terceros (p. ej. bancos). Ubicación pública aproximada por defecto.
- Sin marca eXp Realty ni logos de terceros salvo autorización. La foto del agente solo se recorta/optimiza.
- Nunca simules que una integración (WhatsApp, Meta, Google, email, IA) está conectada. Sin credenciales → "no conectado" y jobs en estado `blocked`.

## Arquitectura
- Next.js 16 App Router, TS strict, Tailwind v4, Drizzle (Postgres/Supabase en prod, PGlite en dev/test).
- `cacheComponents` desactivado: el tenant se resuelve por Host (`src/server/tenant.ts`) y las páginas son dinámicas; lo publicado aparece al instante.
- Módulos en `src/modules/<modulo>/` (domain, repo, service). UI no importa `server/db` directamente: usa servicios.
- **Aislamiento**: todo acceso a tablas de negocio pasa por `withTenant(db, tenantId, tx => …)` (`src/server/db/tenant-tx.ts`), que activa RLS con el rol `app_user`. Además filtra siempre por `tenant_id`. El `tenantId` sale de `getCurrentTenant()` / `requireMember()`, nunca del cliente.
- Validación con Zod compartida cliente/servidor. Variables en `src/env.ts`; nada de `process.env` suelto.
- Errores esperados: `AppError` (`src/lib/errors.ts`); acciones devuelven `ActionResult`. Logs con `log` (`src/lib/logger.ts`), sin secretos ni datos personales completos.
- Cambios de esquema: editar `src/server/db/schema.ts` y `npm run db:generate`; tablas de negocio nuevas llevan `tenantIsolation(...)` y su GRANT en una migración.
- Scripts con `tsx --conditions=react-server` (por `server-only`).

## Calidad
- Antes de entregar: `npm run typecheck && npm run lint && npm test`; e2e con `npm run test:e2e`.
- Secretos solo en `.env.local` / Vercel. Nunca credenciales por defecto en código.
- No leas `node_modules`, lockfiles ni builds.
