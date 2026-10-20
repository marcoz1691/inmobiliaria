import type { Metadata } from "next";
import { env, integrations } from "@/env";
import { requireMember } from "@/server/session";
import { blockedJobCounts } from "@/modules/agents/admin";
import { PageHeader } from "@/components/admin/PageHeader";

export const metadata: Metadata = { title: "Integraciones" };

type Channel = { key: keyof typeof integrations; name: string; what: string; vars: (keyof typeof env)[] };

const CHANNELS: Channel[] = [
  { key: "email", name: "Correo (Resend)", what: "Confirmaciones y recordatorios de citas por correo.", vars: ["RESEND_API_KEY", "EMAIL_FROM"] },
  { key: "whatsapp", name: "WhatsApp Business", what: "Mensajes de confirmación y seguimiento por WhatsApp.", vars: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"] },
  { key: "metaWebhooks", name: "Webhooks de Meta", what: "Recibir mensajes de WhatsApp, Instagram y Messenger.", vars: ["META_APP_SECRET", "META_VERIFY_TOKEN"] },
  { key: "metaMessaging", name: "Mensajería de Instagram y Messenger", what: "Responder desde la página de Facebook.", vars: ["META_PAGE_TOKEN", "META_APP_SECRET"] },
  { key: "metaCapi", name: "Meta Conversions API", what: "Avisar a Meta de prospectos y citas para optimizar anuncios.", vars: ["META_PIXEL_ID", "META_CAPI_TOKEN"] },
  { key: "googleCalendar", name: "Google Calendar", what: "Crear las citas en tu calendario y evitar choques.", vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ENCRYPTION_KEY"] },
  { key: "ai", name: "Asistente de IA (Claude)", what: "Lectura de PDFs escaneados y asistente del sitio.", vars: ["ANTHROPIC_API_KEY"] },
  { key: "supabaseStorage", name: "Almacenamiento de fotos (Supabase)", what: "Guardar fotos y documentos en la nube. Sin él se usa el disco local.", vars: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] },
];

const JOB_LABEL: Record<string, string> = {
  "message.send": "Mensajes (correo / WhatsApp)",
  "meta.capi": "Eventos para Meta",
  "calendar.sync": "Sincronización de calendario",
  "notify.agent.new_lead": "Avisos de prospecto nuevo",
  "notify.agent.booking": "Avisos de cita nueva",
};

export default async function IntegrationsPage() {
  const m = await requireMember();
  const blocked = await blockedJobCounts(m);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Configuración" title="Integraciones" description="Estado real de cada canal. Un canal sin credenciales queda «No conectado» y sus tareas esperan en cola; nunca se marcan como enviadas." />

      <section aria-labelledby="channels" className="mt-8">
        <h2 id="channels" className="sr-only">
          Canales
        </h2>
        <ul className="divide-y divide-line border-y border-line">
          {CHANNELS.map((c) => {
            const on = integrations[c.key];
            const missing = c.vars.filter((v) => !env[v]);
            return (
              <li key={c.key} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-base font-medium text-ink">{c.name}</h3>
                  <p className="text-sm text-ink-muted">{c.what}</p>
                  {!on && missing.length ? (
                    <p className="mt-1 text-sm text-ink">
                      Falta: {missing.map((v, i) => (
                        <span key={v}>
                          {i ? ", " : ""}
                          <code className="rounded-xs bg-sand px-1 font-mono text-xs">{v}</code>
                        </span>
                      ))}
                    </p>
                  ) : null}
                  {c.key === "googleCalendar" && on ? (
                    <a href="/api/integrations/google/start" className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-navy underline underline-offset-4">
                      Conectar mi calendario de Google
                    </a>
                  ) : null}
                </div>
                <span
                  className={
                    on
                      ? "inline-flex shrink-0 items-center gap-1.5 self-start rounded-xs bg-available-bg px-2 py-1 text-xs font-medium text-available"
                      : "inline-flex shrink-0 items-center gap-1.5 self-start rounded-xs bg-sand px-2 py-1 text-xs font-medium text-ink"
                  }
                >
                  <span aria-hidden="true" className={on ? "size-1.5 rounded-full bg-available" : "size-1.5 rounded-full bg-line-strong"} />
                  {on ? (c.key === "googleCalendar" ? "Credenciales listas" : "Conectado") : "No conectado"}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-ink-muted">Las credenciales se configuran como variables de entorno del servidor (Vercel). Nunca se muestran aquí.</p>
      </section>

      <section aria-labelledby="blocked" className="mt-10">
        <h2 id="blocked" className="font-display text-2xl text-ink">
          Tareas en espera por canal no conectado
        </h2>
        {blocked.length ? (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {blocked.map((b) => (
              <li key={b.type} className="flex items-center justify-between gap-3 py-3">
                <span className="text-base text-ink">{JOB_LABEL[b.type] ?? b.type}</span>
                <span className="font-display text-2xl text-ink">{b.n}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-base text-ink-muted">No hay tareas en espera.</p>
        )}
      </section>
    </div>
  );
}
