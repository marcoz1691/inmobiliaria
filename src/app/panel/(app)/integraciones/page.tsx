import type { Metadata } from "next";
import { env, integrations } from "@/env";
import { requireMember } from "@/server/session";
import { blockedJobCounts } from "@/modules/agents/admin";
import { listChannelAccounts } from "@/modules/integrations/channel-accounts";
import { PageHeader } from "@/components/admin/PageHeader";
import { ChannelAccounts } from "@/components/admin/ChannelAccounts";
import { Pill } from "@/components/admin/StatusTag";
import { Button } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { IconTile, ListGroup, ListItem, ListRow, type TileTone } from "@/components/admin/ui/ListGroup";

export const metadata: Metadata = { title: "Integraciones" };

type Channel = { key: keyof typeof integrations; name: string; what: string; vars: (keyof typeof env)[]; icon: "mail" | "chat" | "link" | "globe" | "calendar" | "star" | "photo"; tone: TileTone };

const CHANNELS: Channel[] = [
  { key: "email", name: "Correo (Resend)", what: "Confirmaciones y recordatorios de citas por correo.", vars: ["RESEND_API_KEY", "EMAIL_FROM"], icon: "mail", tone: "navy" },
  { key: "whatsapp", name: "WhatsApp Business", what: "Mensajes de confirmación y seguimiento por WhatsApp.", vars: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"], icon: "chat", tone: "green" },
  { key: "metaWebhooks", name: "Webhooks de Meta", what: "Recibir mensajes de WhatsApp, Instagram y Messenger.", vars: ["META_APP_SECRET", "META_VERIFY_TOKEN"], icon: "link", tone: "blue" },
  { key: "metaMessaging", name: "Mensajería de Instagram y Messenger", what: "Responder desde la página de Facebook.", vars: ["META_PAGE_TOKEN", "META_APP_SECRET"], icon: "chat", tone: "clay" },
  { key: "metaCapi", name: "Meta Conversions API", what: "Avisar a Meta de prospectos y citas para optimizar anuncios.", vars: ["META_PIXEL_ID", "META_CAPI_TOKEN"], icon: "globe", tone: "gray" },
  { key: "googleCalendar", name: "Google Calendar", what: "Crear las citas en tu calendario y evitar choques.", vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ENCRYPTION_KEY"], icon: "calendar", tone: "red" },
  { key: "ai", name: "Asistente de IA (Claude)", what: "Lectura de PDFs escaneados y asistente del sitio.", vars: ["ANTHROPIC_API_KEY"], icon: "star", tone: "amber" },
  { key: "supabaseStorage", name: "Almacenamiento de fotos (Supabase)", what: "Guardar fotos y documentos en la nube. Sin él se usa el disco local.", vars: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"], icon: "photo", tone: "navy" },
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
  const canManageAccounts = m.role === "owner" || m.role === "admin";
  const [blocked, accounts] = await Promise.all([blockedJobCounts(m), canManageAccounts ? listChannelAccounts(m) : Promise.resolve([])]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Configuración"
        title="Integraciones"
        description="Estado real de cada canal. Un canal sin credenciales queda «No conectado» y sus tareas esperan en cola; nunca se marcan como enviadas."
      />

      <div className="grid gap-8">
        <ListGroup title="Canales" titleId="channels" footer="Las credenciales se configuran como variables de entorno del servidor (Vercel). Nunca se muestran aquí.">
          {CHANNELS.map((c) => {
            const on = integrations[c.key];
            const missing = c.vars.filter((v) => !env[v]);
            return (
              <ListItem key={c.key} inset="icon">
                <div className="flex items-start gap-3 px-4 py-3">
                  <IconTile name={c.icon} tone={on ? c.tone : "gray"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-medium text-ink">{c.name}</h3>
                      <Pill tone={on ? "green" : "gray"}>{on ? (c.key === "googleCalendar" ? "Credenciales listas" : "Conectado") : "No conectado"}</Pill>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-muted">{c.what}</p>
                    {!on && missing.length ? (
                      <p className="mt-1 text-sm text-ink">
                        Falta:{" "}
                        {missing.map((v, i) => (
                          <span key={v}>
                            {i ? ", " : ""}
                            <code className="rounded-xs bg-sand px-1 font-mono text-xs">{v}</code>
                          </span>
                        ))}
                      </p>
                    ) : null}
                    {c.key === "googleCalendar" && on ? (
                      <Button href="/api/integrations/google/start" variant="plain" size="sm" className="-ml-2 mt-1" icon="link">
                        Conectar mi calendario de Google
                      </Button>
                    ) : null}
                  </div>
                </div>
              </ListItem>
            );
          })}
        </ListGroup>

        {canManageAccounts ? (
          <section aria-labelledby="channel-accounts">
            <h2 id="channel-accounts" className="mb-1 px-1 text-[1.25rem] leading-tight font-bold tracking-[-0.02em] text-ink">
              Cuentas de canal
            </h2>
            <p className="mb-3 px-1 text-[0.8125rem] leading-snug text-ink-muted">
              IDs de WhatsApp, página o Instagram para enrutar webhooks a este espacio. Registrar un ID no conecta Meta: si las credenciales del servidor faltan, el canal sigue «No conectado».
            </p>
            <ChannelAccounts
              accounts={accounts.map((a) => ({
                id: a.id,
                provider: a.provider,
                externalId: a.externalId,
                label: a.label,
                createdAt: a.createdAt.toISOString(),
              }))}
            />
          </section>
        ) : null}

        <section aria-labelledby="blocked">
          <h2 id="blocked" className="sr-only">
            Tareas en espera por canal no conectado
          </h2>
          {blocked.length ? (
            <ListGroup title="Tareas en espera por canal no conectado" titleId="blocked">
              {blocked.map((b) => (
                <ListRow key={b.type} title={JOB_LABEL[b.type] ?? b.type} value={b.n} />
              ))}
            </ListGroup>
          ) : (
            <EmptyState icon="checkCircle" title="No hay tareas en espera" description="Cuando un canal no está conectado, las tareas se quedan aquí en vez de marcarse como enviadas." />
          )}
        </section>
      </div>
    </div>
  );
}
