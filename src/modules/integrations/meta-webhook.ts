import { z } from "zod";
import { and, count, eq, inArray, lt, or, sql } from "drizzle-orm";
import { env } from "@/env";
import type { Db } from "@/server/db/create";
import { withTenant } from "@/server/db/tenant-tx";
import { channelAccounts, contacts, deals, tenants, webhookEvents } from "@/server/db/schema";
import { errorInfo, log } from "@/lib/logger";
import { logActivity, upsertContact } from "@/modules/crm/service";
import { enqueue } from "@/modules/jobs/queue";
import type { HandlerResult } from "@/modules/jobs/runner";
import type { JobRow } from "@/modules/jobs/queue";
import { appendMessage, getOrCreateThread } from "@/modules/conversations/service";
import { channelReady, type IntegrationDeps } from "./config";
import { activeFunnel, loadAgent } from "./context";
import { fetchLead, leadContactFields, sendPageMessage } from "./meta";
import { sendWhatsAppText } from "./whatsapp";

/* ───────────── parsing ───────────── */

export type InboundEvent =
  | { provider: "whatsapp"; eventId: string; accountId: string; from: string; name: string | null; text: string | null; kind: string }
  | { provider: "messenger" | "instagram"; eventId: string; accountId: string; senderId: string; text: string | null }
  | { provider: "meta_leadgen"; eventId: string; accountId: string; leadgenId: string; formId: string | null; adId: string | null };

const str = z.string().min(1).max(200);
const waValue = z.object({
  metadata: z.object({ phone_number_id: str }).optional(),
  contacts: z.array(z.object({ wa_id: str.optional(), profile: z.object({ name: z.string().max(200).optional() }).optional() })).optional(),
  messages: z.array(z.object({ id: str, from: str, type: z.string().max(40), text: z.object({ body: z.string().max(4096) }).optional() })).optional(),
});
const leadValue = z.object({ leadgen_id: z.union([str, z.number()]), page_id: z.union([str, z.number()]).optional(), form_id: z.union([str, z.number()]).optional(), ad_id: z.union([str, z.number()]).optional() });
const messaging = z.object({
  sender: z.object({ id: str }),
  recipient: z.object({ id: str }),
  message: z.object({ mid: str, text: z.string().max(4096).optional(), is_echo: z.boolean().optional() }).optional(),
});

/** Extracts the events we handle from a Meta webhook body. Unknown shapes are ignored, never thrown. */
export function extractEvents(body: unknown): InboundEvent[] {
  const root = z.object({ object: z.string(), entry: z.array(z.record(z.string(), z.unknown())).max(100) }).safeParse(body);
  if (!root.success) return [];
  const out: InboundEvent[] = [];
  const { object, entry } = root.data;
  for (const e of entry) {
    const entryId = typeof e.id === "string" || typeof e.id === "number" ? String(e.id) : "";
    for (const change of Array.isArray(e.changes) ? e.changes : []) {
      const field = (change as { field?: unknown }).field;
      const value = (change as { value?: unknown }).value;
      if (object === "whatsapp_business_account" && field === "messages") {
        const v = waValue.safeParse(value);
        if (!v.success) continue;
        for (const m of v.data.messages ?? []) {
          const profile = v.data.contacts?.find((c) => c.wa_id === m.from) ?? v.data.contacts?.[0];
          out.push({
            provider: "whatsapp",
            eventId: m.id,
            accountId: v.data.metadata?.phone_number_id ?? "",
            from: m.from,
            name: profile?.profile?.name ?? null,
            text: m.text?.body ?? null,
            kind: m.type,
          });
        }
      } else if (object === "page" && field === "leadgen") {
        const v = leadValue.safeParse(value);
        if (!v.success) continue;
        out.push({
          provider: "meta_leadgen",
          eventId: String(v.data.leadgen_id),
          accountId: v.data.page_id ? String(v.data.page_id) : entryId,
          leadgenId: String(v.data.leadgen_id),
          formId: v.data.form_id ? String(v.data.form_id) : null,
          adId: v.data.ad_id ? String(v.data.ad_id) : null,
        });
      }
    }
    if (object === "page" || object === "instagram") {
      for (const raw of Array.isArray(e.messaging) ? e.messaging : []) {
        const v = messaging.safeParse(raw);
        if (!v.success || !v.data.message || v.data.message.is_echo) continue;
        out.push({
          provider: object === "instagram" ? "instagram" : "messenger",
          eventId: v.data.message.mid,
          accountId: v.data.recipient.id,
          senderId: v.data.sender.id,
          text: v.data.message.text ?? null,
        });
      }
    }
  }
  return out;
}

/* ───────────── tenant resolution ───────────── */

const ACCOUNT_PROVIDER: Record<InboundEvent["provider"], (typeof channelAccounts.$inferSelect)["provider"]> = {
  whatsapp: "whatsapp",
  messenger: "page",
  meta_leadgen: "page",
  instagram: "instagram",
};

export type TenantResolution = { tenantId: string; via: "account" | "fallback" } | { tenantId: null; reason: string };

/**
 * Routes an event to the tenant that registered the receiving account in `channel_accounts`
 * (phone_number_id, page id or Instagram id). Runs as the system role: no tenant is known yet.
 *
 * Fallback to DEFAULT_TENANT_SLUG only while routing is not configured, so a message is never
 * delivered to a tenant that does not own the account:
 *  - once any account is registered for a provider, unknown ids of that provider are ignored;
 *  - a WhatsApp id other than WHATSAPP_PHONE_NUMBER_ID is ignored;
 *  - in production, only when the default tenant is the only tenant (single-tenant deploy).
 */
export async function resolveTenant(db: Db, ev: InboundEvent, deps: IntegrationDeps): Promise<TenantResolution> {
  const provider = ACCOUNT_PROVIDER[ev.provider];
  if (ev.accountId) {
    const [hit] = await db
      .select({ tenantId: channelAccounts.tenantId })
      .from(channelAccounts)
      .where(and(eq(channelAccounts.provider, provider), eq(channelAccounts.externalId, ev.accountId)))
      .limit(1);
    if (hit) return { tenantId: hit.tenantId, via: "account" };
  }
  const [registered] = await db.select({ id: channelAccounts.id }).from(channelAccounts).where(eq(channelAccounts.provider, provider)).limit(1);
  if (registered) return { tenantId: null, reason: "Cuenta no registrada en channel_accounts" };
  if (ev.provider === "whatsapp" && deps.config.whatsappPhoneNumberId && ev.accountId !== deps.config.whatsappPhoneNumberId) {
    return { tenantId: null, reason: "Número distinto de WHATSAPP_PHONE_NUMBER_ID" };
  }
  const [fallback] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, env.DEFAULT_TENANT_SLUG)).limit(1);
  if (!fallback) return { tenantId: null, reason: "No existe el tenant DEFAULT_TENANT_SLUG" };
  if (deps.config.production) {
    const [total] = await db.select({ n: count() }).from(tenants);
    if (Number(total?.n ?? 0) !== 1) return { tenantId: null, reason: "Cuenta no registrada y hay más de un tenant" };
  }
  return { tenantId: fallback.id, via: "fallback" };
}

/* ───────────── recording (fast path, inside the HTTP request) ───────────── */

export const BACKSTOP_DELAY_MS = 2 * 60_000;

/**
 * Stores each new event once (`webhook_events` unique on provider + event id) and enqueues a
 * backstop job that retries processing if the immediate attempt (after the response) fails.
 * Events no tenant owns are kept as `ignored` with only the account id (no message content).
 * Returns the ids of newly stored, routable events; duplicates are skipped.
 */
export async function recordEvents(db: Db, events: InboundEvent[], deps: IntegrationDeps): Promise<string[]> {
  const fresh: string[] = [];
  for (const ev of events) {
    const route = await resolveTenant(db, ev, deps);
    if (route.tenantId === null) {
      const [ignored] = await db
        .insert(webhookEvents)
        .values({ provider: ev.provider, eventId: ev.eventId, tenantId: null, payload: { accountId: ev.accountId }, status: "ignored", lastError: route.reason })
        .onConflictDoNothing()
        .returning({ id: webhookEvents.id });
      if (ignored) log.warn("webhook for unrouted account", { provider: ev.provider, accountId: ev.accountId, reason: route.reason });
      continue;
    }
    const tenantId = route.tenantId;
    const [row] = await db
      .insert(webhookEvents)
      .values({ provider: ev.provider, eventId: ev.eventId, tenantId, payload: ev })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });
    if (!row) continue;
    await withTenant(db, tenantId, (tx) =>
      enqueue(tx, {
        tenantId,
        type: "meta.webhook",
        payload: { webhookEventId: row.id },
        runAt: new Date(deps.now().getTime() + BACKSTOP_DELAY_MS),
        idempotencyKey: `webhook:${row.id}`,
      }),
    );
    fresh.push(row.id);
  }
  return fresh;
}

/* ───────────── processing ───────────── */

export type ReplyFn = (tenantId: string, conversationId: string) => Promise<string | null>;
export type ProcessOutcome = { status: "processed" | "skipped" } | { status: "blocked"; reason: string };

const OPT_OUT_WORDS = /^\s*(baja|stop|detener|cancelar suscripci[oó]n|no m[aá]s mensajes)\s*$/i;
const OPT_OUT_ACK = "Listo, no te enviaremos más mensajes automáticos. Si necesitas algo, escríbenos cuando quieras.";

/**
 * Atomically claims a stored event (one processor at a time; a stale `processing` older than five
 * minutes is reclaimable), processes it and records the outcome on the row.
 */
export async function processWebhookEvent(db: Db, webhookEventId: string, deps: IntegrationDeps, reply: ReplyFn | null): Promise<ProcessOutcome> {
  const staleBefore = new Date(deps.now().getTime() - 5 * 60_000);
  const [claimed] = await db
    .update(webhookEvents)
    .set({ status: "processing", attempts: sql`${webhookEvents.attempts} + 1` })
    .where(
      and(
        eq(webhookEvents.id, webhookEventId),
        or(inArray(webhookEvents.status, ["received", "failed", "blocked"]), and(eq(webhookEvents.status, "processing"), lt(webhookEvents.receivedAt, staleBefore))),
      ),
    )
    .returning();
  if (!claimed) {
    const [row] = await db.select({ status: webhookEvents.status }).from(webhookEvents).where(eq(webhookEvents.id, webhookEventId));
    // Another worker is on it right now: let the backstop job retry later instead of losing the event.
    if (row?.status === "processing") throw new Error("Evento en proceso por otro trabajador");
    return { status: "skipped" };
  }
  if (!claimed.tenantId) return { status: "skipped" };
  const finish = (status: string, lastError: string | null) =>
    db.update(webhookEvents).set({ status, lastError, processedAt: status === "processed" ? deps.now() : null }).where(eq(webhookEvents.id, webhookEventId));
  try {
    const outcome = await processEvent(db, claimed.tenantId, claimed.payload as InboundEvent, deps, reply);
    await finish(outcome.status === "blocked" ? "blocked" : "processed", outcome.status === "blocked" ? outcome.reason : null);
    return outcome;
  } catch (err) {
    await finish("failed", errorInfo(err).error.slice(0, 1000));
    throw err;
  }
}

async function processEvent(db: Db, tenantId: string, ev: InboundEvent, deps: IntegrationDeps, reply: ReplyFn | null): Promise<ProcessOutcome> {
  if (ev.provider === "meta_leadgen") return processLead(db, tenantId, ev, deps);

  const channel = ev.provider;
  const threadId = ev.provider === "whatsapp" ? ev.from : ev.senderId;
  const body = ev.text ?? `[${ev.provider === "whatsapp" ? ev.kind : "adjunto"}]`;
  const state = await withTenant(db, tenantId, async (tx) => {
    const contact =
      ev.provider === "whatsapp"
        ? await upsertContact(tx, tenantId, { name: ev.name, phone: `+${ev.from}`, source: "whatsapp", consent: false })
        : null;
    const conv = await getOrCreateThread(tx, { tenantId, channel, externalThreadId: threadId, contactId: contact?.id });
    const stored = await appendMessage(tx, { tenantId, conversationId: conv.id, direction: "in", role: "user", body, externalId: ev.eventId });
    if (!stored) return null;
    if (contact) await logActivity(tx, { tenantId, contactId: contact.id, type: "message_received", data: { channel, conversationId: conv.id } });
    let optedOut = Boolean(contact?.optedOutAt);
    let ack: string | null = null;
    if (contact && ev.text && OPT_OUT_WORDS.test(ev.text) && !contact.optedOutAt) {
      await tx.update(contacts).set({ optedOutAt: deps.now() }).where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contact.id)));
      await logActivity(tx, { tenantId, contactId: contact.id, type: "opted_out", data: { channel } });
      optedOut = true;
      ack = OPT_OUT_ACK;
    }
    return { conv, optedOut, ack };
  });
  if (!state) return { status: "skipped" };

  const canSend = channel === "whatsapp" ? channelReady.whatsapp(deps.config) : channelReady.pageMessaging(deps.config);
  const open = state.conv.status === "open" && !state.conv.handoffRequestedAt;
  let text = state.ack;
  if (!text && canSend && open && !state.optedOut && ev.text && reply) text = await reply(tenantId, state.conv.id);
  if (!text || !canSend) return { status: "processed" };

  const sent = channel === "whatsapp" ? await sendWhatsAppText(deps, { to: threadId, body: text }) : await sendPageMessage(deps, threadId, text);
  await withTenant(db, tenantId, (tx) =>
    appendMessage(tx, { tenantId, conversationId: state.conv.id, direction: "out", role: "assistant", body: text, externalId: sent.id }),
  );
  return { status: "processed" };
}

/**
 * Lead Ads (instant form) → contact + deal "new" (source meta_lead_ads) → agent alert → invitation
 * with the active funnel link, so form leads also end in the calendar.
 */
async function processLead(db: Db, tenantId: string, ev: Extract<InboundEvent, { provider: "meta_leadgen" }>, deps: IntegrationDeps): Promise<ProcessOutcome> {
  if (!channelReady.pageMessaging(deps.config)) return { status: "blocked", reason: "Lead Ads no conectado: falta META_PAGE_TOKEN" };
  const lead = await fetchLead(deps, ev.leadgenId);
  const { name, email, phone } = leadContactFields(lead.fields);
  if (!email && !phone) {
    log.warn("lead ads without contact fields", { tenantId, leadgenId: ev.leadgenId });
    return { status: "processed" };
  }
  await withTenant(db, tenantId, async (tx) => {
    const contact = await upsertContact(tx, tenantId, {
      name,
      email,
      phone,
      source: "meta_lead_ads",
      // Consent was given in Meta's instant form under the advertiser's privacy policy, not with our text.
      consent: false,
      utm: { utm_source: "facebook", utm_medium: "lead_ads", ...(ev.adId ? { utm_content: ev.adId } : {}) },
    });
    const agent = await loadAgent(tx, tenantId);
    const funnel = await activeFunnel(tx, tenantId, { agentId: agent?.id });
    const [deal] = await tx
      .insert(deals)
      .values({ tenantId, contactId: contact.id, agentId: agent?.id ?? null, funnelId: funnel?.id ?? null, stage: "new", source: "meta_lead_ads" })
      .returning();
    await logActivity(tx, {
      tenantId,
      contactId: contact.id,
      dealId: deal!.id,
      type: "lead_ads",
      body: "Prospecto desde formulario instantáneo de Meta",
      data: { leadgenId: ev.leadgenId, formId: lead.formId ?? ev.formId, adId: lead.adId ?? ev.adId, consent: "Formulario instantáneo de Meta (política de privacidad del anunciante)" },
    });
    await enqueue(tx, { tenantId, type: "notify.agent.new_lead", payload: { dealId: deal!.id }, idempotencyKey: `deal:${deal!.id}:notify` });
    if (!funnel) return;
    for (const channel of [email && "email", phone && "whatsapp"].filter(Boolean) as ("email" | "whatsapp")[]) {
      await enqueue(tx, {
        tenantId,
        type: "message.send",
        payload: { channel, template: "lead_booking_invite", contactId: contact.id, dealId: deal!.id, bookingId: null },
        idempotencyKey: `deal:${deal!.id}:lead-invite:${channel}`,
      });
    }
  });
  return { status: "processed" };
}

/** Backstop job `meta.webhook`: retries processing of an event the immediate attempt missed. */
export async function handleWebhookJob(job: JobRow, db: Db, deps: IntegrationDeps, reply: ReplyFn | null): Promise<HandlerResult> {
  const { webhookEventId } = z.object({ webhookEventId: z.uuid() }).parse(job.payload);
  const out = await processWebhookEvent(db, webhookEventId, deps, reply);
  return out.status === "blocked" ? { status: "blocked", reason: out.reason } : { status: "done" };
}
