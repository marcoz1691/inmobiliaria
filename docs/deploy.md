# Despliegue (Vercel + Supabase)

## 1. Supabase
1. Crea un proyecto nuevo (región cercana a Ecuador, p. ej. `us-east-1`).
2. **Database → Connection string → Transaction pooler** (puerto 6543): ese es el `DATABASE_URL`.
   - El rol `postgres` es dueño de las tablas.
   - La migración `0000_roles.sql` crea `app_user` y se lo concede, para que la app pueda hacer `SET LOCAL ROLE app_user` y aplicar RLS.
3. **Storage → New bucket** `media`, **público** (solo contiene fotos optimizadas sin metadatos y los PDFs importados).
   - Si prefieres mantener los PDFs privados, crea un bucket `imports` privado y ajusta `src/modules/imports/service.ts`.
4. **Project settings → API**: copia `SUPABASE_URL` y la `service_role` key en `SUPABASE_SERVICE_ROLE_KEY`. Solo se usa en el servidor; nunca va al cliente.
5. Aplica las migraciones desde tu máquina:
   ```bash
   DATABASE_URL="postgresql://…pooler…:6543/postgres" npm run db:migrate
   ```
6. Crea el tenant y la cuenta del agente:
   ```bash
   DATABASE_URL=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
   SEED_OWNER_EMAIL=correo@del-agente SEED_OWNER_PASSWORD='<temporal fuerte>' npm run db:seed
   ```
   El seed sube la foto desde `assets-input/perfil/foto-agente.jpeg` si existe. Si pasas también `WHATSAPP_PHONE_NUMBER_ID`, registra ese número como cuenta de WhatsApp del tenant (`channel_accounts`), que es lo que usa el webhook para enrutar los mensajes.
7. Agrega el dominio del agente a `tenant_domains` (o desde el panel cuando exista esa pantalla):
   ```sql
   insert into tenant_domains (domain, tenant_id) select 'tudominio.com', id from tenants where slug = 'piloto';
   ```

## 2. Vercel
1. Importa el repositorio. Framework: Next.js. Node 24.
2. Variables de entorno (Production y Preview): todas las de `.env.example` que apliquen. Como mínimo:
   - `APP_URL`, `DEFAULT_TENANT_SLUG`
   - `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `BETTER_AUTH_SECRET` y `ENCRYPTION_KEY` (genéralos con `openssl rand -base64 32`)
   - `CRON_SECRET` (`openssl rand -hex 24`)
3. `vercel.json` programa `/api/cron/jobs` cada 5 minutos (recordatorios, mensajes, Conversions API, calendario). Vercel envía `Authorization: Bearer $CRON_SECRET`.
4. Dominio: agrégalo en Vercel y en `tenant_domains`.

## 3. Integraciones
Ver `docs/integrations.md`. Cada canal se activa al definir sus variables. Mientras falten, el panel lo muestra como "No conectado" y los jobs quedan en espera (`blocked`) para enviarse al conectar.

- **Varios tenants en el mismo despliegue:** registra en `channel_accounts` cada número de WhatsApp, página e Instagram de cada tenant. En producción, con más de un tenant, los webhooks de una cuenta no registrada se ignoran (estado `ignored` en `webhook_events`).

## 4. Verificación posterior al despliegue
- `/panel/ingresar` → iniciar sesión y cambiar la contraseña temporal.
- Publicar una propiedad de prueba y abrirla en el sitio.
- Enviar el formulario de contacto: debe aparecer en **Prospectos**.
- Configurar el horario en **Agenda**, activar el embudo y probar `/agenda/<slug>` desde el teléfono.
- Revisar en Vercel → Logs que el cron responde `200` con `{claimed, done, blocked, failed, purged}`.
- Abrir `/privacidad`: completar con un abogado los campos "Pendiente de completar" (razón social, RUC o cédula, domicilio, plazo de conservación) y revisar el texto antes de publicar anuncios.

## Rollback
- **Código:** "Promote" del deployment anterior en Vercel.
- **Base de datos:** las migraciones solo añaden. Para revertir, crea una migración inversa; no edites migraciones aplicadas.
