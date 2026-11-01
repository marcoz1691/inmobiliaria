---
name: db-schema-change
description: Procedimiento para cambiar el esquema de base de datos (Drizzle, Postgres/Supabase, PGlite) de la plataforma inmobiliaria multi-tenant. Úsalo cuando el usuario pida agregar o modificar tablas, columnas, índices, migraciones, RLS, seeds o tenantIsolation.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Cambio de esquema

1. Edita `src/server/db/schema.ts`. Toda tabla de negocio nueva lleva `tenantIsolation(...)` y su GRANT al rol `app_user` en la migración.
2. Genera la migración: `npm run db:generate`. Revisa el SQL en `drizzle/` antes de seguir.
3. Aplica en local: `npm run db:migrate` (PGlite embebido). Actualiza `scripts/seed.ts` si hace falta.
4. Acceso a datos solo vía `withTenant(db, tenantId, tx => …)` (`src/server/db/tenant-tx.ts`) y siempre filtrando por `tenant_id`.
5. Valida: `npm run check` (typecheck + lint + test). Si cambió un flujo, `npm run test:e2e`.
6. Scripts nuevos usan `tsx --conditions=react-server`.

Nunca apliques migraciones a producción (Supabase) sin confirmación explícita del usuario. Despliegue: `docs/deploy.md`.
