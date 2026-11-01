---
name: tenant-isolation-review
description: Revisión de solo lectura del aislamiento multi-tenant en la plataforma inmobiliaria. Úsalo cuando el usuario pida auditar seguridad, revisar fugas entre tenants, RLS, uso de withTenant, filtros por tenant_id o revisar un PR/diff antes de entregar.
allowed-tools: Read, Grep, Glob
---

# Revisión de aislamiento multi-tenant (solo lectura)

No edites archivos: reporta hallazgos. Busca:

- Consultas a tablas de negocio que no pasen por `withTenant(...)` (`src/server/db/tenant-tx.ts`).
- Consultas sin filtro por `tenant_id`.
- `tenantId` tomado del cliente en vez de `getCurrentTenant()` / `requireMember()`.
- Tablas nuevas en `schema.ts` sin `tenantIsolation(...)` o sin GRANT.
- UI que importe `server/db` directamente en lugar de usar servicios de `src/modules/<modulo>/`.
- `process.env` suelto (debe usar `src/env.ts`), secretos o datos personales completos en logs.
- Integraciones simuladas como conectadas (debe verse "no conectado" y jobs `blocked`).

Entrega tabla: archivo:línea | problema | corrección sugerida.
