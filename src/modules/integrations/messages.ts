import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/server/db/create";
import { withTenant } from "@/server/db/tenant-tx";
import { conversations, deals } from "@/server/db/schema";
import { decrypt } from "@/lib/crypto";
import { logActivity } from "@/modules/crm/service";
import type { HandlerResult } from "@/modules/jobs/runner";
import type { JobRow } from "@/modules/jobs/queue";
import {
  BOOKING_TEMPLATES,
  isContactTemplate,
  renderEmail,
  whatsappTemplate,
  type TemplateContext,
  type TemplateKey,
} from "@/modules/automations/templates";
import { blockedReason, channelReady, type IntegrationDeps } from "./config";
import { activeFunnel, funnelUrl, loadAgent, loadRecords, loadTenant, propertyUrl, tenantBaseUrl, type AgentRow } from "./context";
import { sendEmail } from "./email";
import { optOutToken } from "./signing";
import { sendWhatsAppTemplate } from "./whatsapp";

const done = { status: "done" } as const;
const blocked = (reason: string): HandlerResult => ({ status: "blocked", reason });

/* ───────────── message.send (contact-facing) ───────────── */

const messagePayload = z.object({
  channel: z.enum(["email", "whatsapp"]),
  template: z.string(),
  contactId: z.uuid(),
  dealId: z.uuid().nullish(),
  bookingId: z.uuid().nullish(),
  /** `encrypt(manageToken)` added by bookSlot (see docs/integrations.md, "cambio solicitado"). */
  manageTokenEnc: z.string().max(500).nullish(),
});

function manageUrl(base: string, enc: string | null | undefined, deps: IntegrationDeps): string | null {
  if (!enc || !deps.config.encryption) return null;
  try {
    return `${base}/cita/${encodeURIComponent(decrypt(enc))}`;
  } catch {
    return null;
  }
}

export async function handleMessageSend(job: JobRow, db: Db, deps: IntegrationDeps): Promise<HandlerResult> {
  const p = messagePayload.parse(job.payload);
  if (!isContactTemplate(p.template)) throw new Error(`Plantilla desconocida: ${p.template}`);
  const template = p.template;
  const tenantId = job.tenantId;
  const base = await tenantBaseUrl(db, tenantId, deps.config);

  const prepared = await withTenant(db, tenantId, async (tx) => {
    const { contact, deal, booking, property } = await loadRecords(tx, tenantId, p);
    if (!contact) return { skip: "contacto eliminado" as const };
    const skip = async (reason: string) => {
      await logActivity(tx, { tenantId, contactId: contact.id, dealId: p.dealId, type: "message_skipped", body: `Omitido: ${reason}`, data: { channel: p.channel, template } });
      return { skip: reason };
    };
    if (contact.optedOutAt) return skip("el contacto pidió no recibir mensajes");
    if (BOOKING_TEMPLATES.includes(template) && (!booking || booking.status === "cancelled")) return skip("la cita fue cancelada");
    if (p.channel === "email" && !contact.email) return skip("sin email");
    if (p.channel === "whatsapp" && !contact.phone) return skip("sin teléfono");

    const tenant = await loadTenant(tx, tenantId);
    const agent = await loadAgent(tx, tenantId, booking?.agentId ?? deal?.agentId ?? property?.agentId);
    const funnel = await activeFunnel(tx, tenantId, { funnelId: deal?.funnelId ?? booking?.funnelId, agentId: agent?.id });
    const utm = template === "lead_booking_invite" ? { utm_source: "facebook", utm_medium: "lead_ads" } : undefined;
    const ctx: TemplateContext = {
      tenantName: tenant.name,
      timezone: tenant.timezone,
      agentName: agent?.displayName ?? null,
      contactName: contact.name,
      booking: booking ? { startsAt: booking.startsAt, endsAt: booking.endsAt, meetingKind: booking.meetingKind, meetingUrl: booking.meetingUrl } : null,
      propertyTitle: property?.title || null,
      propertyUrl: propertyUrl(base, property),
      manageUrl: manageUrl(base, p.manageTokenEnc, deps),
      optOutUrl: `${base}/api/opt-out?t=${optOutToken(tenantId, contact.id)}`,
      catalogUrl: `${base}/propiedades`,
      funnelUrl: funnelUrl(base, funnel?.slug, utm),
    };
    return { ctx, to: p.channel === "email" ? contact.email! : contact.phone!, contactId: contact.id, replyTo: agent?.email ?? null };
  });

  if ("skip" in prepared) return done;
  if (p.channel === "email" && !channelReady.email(deps.config)) return blocked(blockedReason.email(deps.config));
  if (p.channel === "whatsapp" && !channelReady.whatsapp(deps.config)) return blocked(blockedReason.whatsapp(deps.config));

  let providerId: string | null;
  if (p.channel === "email") {
    const mail = renderEmail(template, prepared.ctx);
    ({ id: providerId } = await sendEmail(deps, { ...mail, to: prepared.to, replyTo: prepared.replyTo, unsubscribeUrl: prepared.ctx.optOutUrl, idempotencyKey: `job-${job.id}` }));
  } else {
    ({ id: providerId } = await sendWhatsAppTemplate(deps, { to: prepared.to, ...whatsappTemplate(template, prepared.ctx) }));
  }
  await withTenant(db, tenantId, (tx) =>
    logActivity(tx, { tenantId, contactId: prepared.contactId, dealId: p.dealId, type: "message_sent", data: { channel: p.channel, template, providerId } }),
  );
  return done;
}

/* ───────────── agent notifications ───────────── */

type AgentDelivery = { agent: AgentRow | null; ctx: TemplateContext; template: TemplateKey; contactId: string | null; dealId: string | null };

/** Email and/or WhatsApp to the agent. Blocked when no usable channel exists; never reported as sent. */
async function deliverToAgent(db: Db, job: JobRow, deps: IntegrationDeps, d: AgentDelivery): Promise<HandlerResult> {
  const email = d.agent?.email ?? null;
  const phone = d.agent?.whatsapp ?? d.agent?.phone ?? null;
  if (!email && !phone) return blocked("El perfil del agente no tiene email ni WhatsApp para avisarle");
  const missing: string[] = [];
  const sent: string[] = [];
  if (email) {
    if (channelReady.email(deps.config)) {
      await sendEmail(deps, { ...renderEmail(d.template, d.ctx), to: email, idempotencyKey: `job-${job.id}-email` });
      sent.push("email");
    } else missing.push(blockedReason.email(deps.config));
  }
  if (phone) {
    if (channelReady.whatsapp(deps.config)) {
      await sendWhatsAppTemplate(deps, { to: phone, ...whatsappTemplate(d.template, d.ctx) });
      sent.push("whatsapp");
    } else missing.push(blockedReason.whatsapp(deps.config));
  }
  if (!sent.length) return blocked(missing.join("; "));
  if (d.contactId) {
    await withTenant(db, job.tenantId, (tx) =>
      logActivity(tx, { tenantId: job.tenantId, contactId: d.contactId!, dealId: d.dealId, type: "agent_notified", data: { template: d.template, channels: sent } }),
    );
  }
  return done;
}

const newLeadPayload = z.object({ dealId: z.uuid().optional(), conversationId: z.uuid().optional(), reason: z.string().max(500).optional() });

export async function handleNotifyNewLead(job: JobRow, db: Db, deps: IntegrationDeps): Promise<HandlerResult> {
  const p = newLeadPayload.parse(job.payload);
  const tenantId = job.tenantId;
  const base = await tenantBaseUrl(db, tenantId, deps.config);
  const d = await withTenant(db, tenantId, async (tx): Promise<AgentDelivery | null> => {
    const tenant = await loadTenant(tx, tenantId);
    let dealId = p.dealId ?? null;
    let conversationNote: string | null = null;
    if (!dealId && p.conversationId) {
      // Handoff from the assistant: link to the contact's latest deal when there is one.
      const [conv] = await tx.select().from(conversations).where(and(eq(conversations.tenantId, tenantId), eq(conversations.id, p.conversationId)));
      if (!conv) return null;
      conversationNote = `Pidió hablar con una persona (${conv.channel})${p.reason ? `: ${p.reason}` : ""}`;
      if (conv.contactId) {
        const [last] = await tx
          .select({ id: deals.id })
          .from(deals)
          .where(and(eq(deals.tenantId, tenantId), eq(deals.contactId, conv.contactId)))
          .orderBy(desc(deals.createdAt))
          .limit(1);
        dealId = last?.id ?? null;
      }
    }
    const { contact, deal, property } = await loadRecords(tx, tenantId, { dealId });
    const contactRecord = contact ?? (deal ? (await loadRecords(tx, tenantId, { contactId: deal.contactId })).contact : null);
    const agent = await loadAgent(tx, tenantId, deal?.agentId ?? property?.agentId);
    return {
      agent,
      template: "agent_new_lead",
      contactId: contactRecord?.id ?? null,
      dealId,
      ctx: {
        tenantName: tenant.name,
        timezone: tenant.timezone,
        agentName: agent?.displayName ?? null,
        catalogUrl: `${base}/propiedades`,
        propertyTitle: property?.title || null,
        lead: {
          name: contactRecord?.name ?? (conversationNote ? "Visitante del chat (sin datos de contacto)" : null),
          email: contactRecord?.email ?? null,
          phone: contactRecord?.phone ?? null,
          source: deal?.source ?? (p.conversationId ? "chat" : null),
          score: deal?.score ?? null,
          message: conversationNote ?? deal?.message ?? null,
          panelUrl: dealId ? `${base}/panel/prospectos/${dealId}` : `${base}/panel`,
        },
      },
    };
  });
  if (!d) return done;
  return deliverToAgent(db, job, deps, d);
}

const bookingPayload = z.object({ bookingId: z.uuid() });

export async function handleNotifyBooking(job: JobRow, db: Db, deps: IntegrationDeps): Promise<HandlerResult> {
  const p = bookingPayload.parse(job.payload);
  const tenantId = job.tenantId;
  const base = await tenantBaseUrl(db, tenantId, deps.config);
  const d = await withTenant(db, tenantId, async (tx): Promise<AgentDelivery | null> => {
    const { booking, property } = await loadRecords(tx, tenantId, { bookingId: p.bookingId });
    if (!booking || booking.status === "cancelled") return null;
    const { contact } = await loadRecords(tx, tenantId, { contactId: booking.contactId });
    const tenant = await loadTenant(tx, tenantId);
    const agent = await loadAgent(tx, tenantId, booking.agentId);
    return {
      agent,
      template: "agent_booking",
      contactId: booking.contactId,
      dealId: booking.dealId,
      ctx: {
        tenantName: tenant.name,
        timezone: tenant.timezone,
        agentName: agent?.displayName ?? null,
        catalogUrl: `${base}/propiedades`,
        propertyTitle: property?.title || null,
        booking: { startsAt: booking.startsAt, endsAt: booking.endsAt, meetingKind: booking.meetingKind, meetingUrl: booking.meetingUrl },
        lead: {
          name: contact?.name ?? null,
          email: contact?.email ?? null,
          phone: contact?.phone ?? null,
          panelUrl: booking.dealId ? `${base}/panel/prospectos/${booking.dealId}` : `${base}/panel/agenda`,
        },
      },
    };
  });
  if (!d) return done;
  return deliverToAgent(db, job, deps, d);
}
