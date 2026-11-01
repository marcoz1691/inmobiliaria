@AGENTS.md

## Skills del proyecto

En `.claude/skills/`: `db-schema-change` (cambios de esquema y migraciones) y `tenant-isolation-review` (revisión de solo lectura del aislamiento multi-tenant).

Subagente: `tenant-auditor` (solo lectura, carga `tenant-isolation-review`). Los subagentes no heredan skills: se declaran con `skills:` en `.claude/agents/`.
