# ADR 0001: Monolito modular multi-tenant

- **Estado:** aceptado (2026-10-19)
- **Contexto:** es un MVP vendible para agentes inmobiliarios. El piloto es un agente, pero la plataforma debe admitir muchos agentes y agencias, y luego otros verticales de servicios high-ticket a través del embudo genérico. El equipo es pequeño y el presupuesto de operación es bajo.

## Decisión

1. **Monolito modular** sobre Next.js 16 (App Router), desplegado en Vercel.
   - Los módulos viven en `src/modules/*`: properties, media, crm, funnels, scheduling, automations, jobs, imports, conversations, integrations y audit.
   - No hay microservicios. Las integraciones externas son adaptadores dentro del monolito.
2. **Postgres** como única fuente de verdad.
   - En producción es Supabase, vía el pooler en modo transacción (`prepare: false`).
   - En dev y test es **PGlite**, con las mismas migraciones de Drizzle. Así todo corre sin red ni Docker.
3. **Multi-tenant con base compartida y `tenant_id`**, con defensa en dos capas:
   - **Aplicación:** el tenant se resuelve en el servidor a partir del Host (`tenant_domains`) o de la membresía del usuario. Nunca viene del cliente. Los servicios filtran siempre por `tenant_id`.
   - **Base de datos:** el trabajo de cada tenant corre en `withTenant()`. Esa función hace `SET LOCAL ROLE app_user` y fija `app.tenant_id`. Hay políticas RLS en todas las tablas de negocio. `app_user` no tiene acceso a las tablas de auth ni a las de sistema (`webhook_events`, `rate_limits`).
   - Lo verifican `test/rls.test.ts` y los tests de acceso horizontal de cada servicio.
4. **Auth: Better Auth** con email y contraseña, y sesiones guardadas en nuestra base.
   - No hay registro abierto. Las cuentas las crea el dueño (seed o pantalla de equipo).
   - Roles por tenant: `owner`, `admin` y `agent`. Un `agent` solo edita sus propias propiedades.
5. **Render dinámico, sin `cacheComponents`.**
   - Como el tenant depende del Host, cada request se renderiza en el servidor. Lo que se publica aparece al instante, sin pasos de revalidación que puedan fallar.
   - Optimización futura: `"use cache"` con `cacheTag` por tenant y propiedad, y `updateTag` en las mutaciones.
6. **Medios.**
   - Se validan por contenido con sharp y se rotan según EXIF.
   - **Se eliminan los metadatos (incluido el GPS).**
   - Se generan variantes WebP de 480, 960 y 1600 px más un placeholder blur.
   - Un loader de `next/image` (`media:` → variante) elige el tamaño adecuado.
   - Almacenamiento: Supabase Storage en producción y disco local en dev.
7. **Jobs y outbox en Postgres** (`jobs`): cubren recordatorios, mensajes, eventos de Conversions API y la sincronización de calendario.
   - Un Vercel Cron los toma con `FOR UPDATE SKIP LOCKED`.
   - La idempotencia se logra con `(tenant_id, idempotency_key)`.
   - Si un canal no está conectado, el job queda en `blocked`. **Nunca se marca como enviado.**
8. **Embudo genérico** (`funnels`):
   - Las preguntas son JSON con puntaje por opción y opciones descalificadoras.
   - Pasar la calificación entrega un *pass* firmado con HMAC, que es requisito para reservar.
   - La reserva es transaccional: lock consultivo por agente, revalidación de la franja e índice único parcial `(agent_id, starts_at) where confirmed`.
9. **Privacidad.**
   - La ubicación pública es aproximada por defecto: se redondea a unos 1 km y la dirección no se muestra.
   - Hay registro del consentimiento de la LOPDP (texto y fecha) y opt-out.
   - El audit log es append-only: solo `INSERT` y un trigger contra `UPDATE`.

## Consecuencias

- Una sola base y un solo despliegue: la operación es simple y barata.
- RLS añade un `SET LOCAL` por transacción. Es un costo despreciable frente al riesgo de una fuga entre tenants.
- PGlite es de un solo proceso. No sirve para producción y `env.ts` exige `DATABASE_URL` allí.
- Sin caché, cada visita consulta la base. Las consultas están indexadas por `(tenant_id, …)`. Si el tráfico crece, se añade `"use cache"` sin cambiar el modelo.
