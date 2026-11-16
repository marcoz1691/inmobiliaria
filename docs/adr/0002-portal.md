# ADR 0002 · Portal global de agentes

**Estado:** aceptada · noviembre 2026

## Contexto

La plataforma nació como un sitio por agente (tenant) en su propio dominio. El objetivo ahora es un portal único donde muchos agentes publican y las personas buscan casas, departamentos, terrenos y oficinas en todo Ecuador.

## Decisión

- **Un agente = un tenant.** El registro en `/panel/registro` (`src/modules/agents/registration.ts`) crea en una transacción: usuario + credencial (Better Auth), tenant propio, membresía `owner` y perfil público. El aislamiento por RLS (`withTenant`) no cambia: cada agente solo ve y edita lo suyo.
- **Modo por host** (`src/server/tenant.ts`): un dominio registrado en `tenant_domains` o `<slug>.<TENANT_BASE_DOMAIN>` sirve el sitio de ese agente (funnel, contacto, chat, como antes). Cualquier otro host es el **portal** (`SITE_MODE=portal`, por defecto). `SITE_MODE=single` conserva el despliegue de un solo agente.
- **Lecturas del portal con un rol propio**, `portal_reader` (`withPortal`, migración `0005_portal.sql`): solo `SELECT`, RLS que deja ver propiedades en estado público y sus fotos, y *grants* por columna que excluyen datos privados (notas de revisión, confianza de importación, `user_id`). El portal nunca usa el rol dueño de la base.
- **Slugs de propiedades globales** (`/propiedades/<slug>`): índice único global y la función `taken_property_slugs` (`SECURITY DEFINER`) para calcular un slug libre sin ver datos de otros tenants. La migración renombra duplicados entre tenants (gana el más antiguo).
- **Consultas desde el portal**: el formulario envía solo el id de una propiedad pública; el servidor busca su tenant (`publicListingOwner`) y crea el prospecto en el CRM de ese agente.
- **Ubicación**: las 24 provincias y 223 cantones (`src/modules/geo/ecuador.ts`, fuente citada en el archivo). Los filtros ofrecen todo el país; el texto libre que ya existe ("Sangolquí", "quito ") se resuelve al cantón al filtrar.
- El panel resuelve el tenant por la membresía de la sesión cuando se abre desde el portal, y exige membresía del tenant del host en el dominio de un agente.

## Consecuencias

- Cambiar el slug de una propiedad duplicada entre tenants rompe su URL anterior (solo ocurre en la migración).
- El registro es abierto (con honeypot, tiempo mínimo y límite por IP). Falta moderación de publicaciones y verificación de correo: siguiente paso si aparece spam.
- El asistente IA y el embudo de citas siguen siendo del sitio de cada agente; en el portal el contacto es WhatsApp, teléfono o el formulario de consulta.
