import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { appSecret } from "@/server/secrets";
import { getDb } from "@/server/db/client";
import { withTenant, type Tx } from "@/server/db/tenant-tx";
import {
  agentProfiles,
  availabilityRules,
  blackouts,
  bookings,
  deals,
  funnelSubmissions,
  funnels,
  tenants,
} from "@/server/db/schema";
import type { MemberContext } from "@/server/session";
import { AppError, notFound } from "@/lib/errors";
import { encrypt, randomToken, safeEqual, sha256 } from "@/lib/crypto";
import { audit } from "@/modules/audit/audit";
import { logActivity, upsertContact } from "@/modules/crm/service";
import { enqueue, cancelPending } from "@/modules/jobs/queue";
import { installDefaultSequences, scheduleSequence } from "@/modules/automations/sequences";
import { computeSlots, type Interval, type SlotQuery } from "@/modules/scheduling/slots";
import { FUNNEL_TEMPLATES, scoreSubmission, type Answers } from "./scoring";
import { clientNetworkColumns, type ClientNetwork } from "./client-data";

export type FunnelRow = typeof funnels.$inferSelect;
export type BookingRow = typeof bookings.$inferSelect;


/** Proof that the visitor completed (and passed) the qualification step before booking. */
export function bookingPass(submissionId: string): string {
  return createHmac("sha256", appSecret()).update(`funnel-pass:${submissionId}`).digest("base64url");
}

const run = async <T>(tenantId: string, fn: (tx: Tx) => Promise<T>) => withTenant(await getDb(), tenantId, fn);

/* ───────────── public: funnel page ───────────── */

export async function getActiveFunnel(tenantId: string, slug: string): Promise<FunnelRow | null> {
  return run(tenantId, async (tx) => {
    const [f] = await tx
      .select()
      .from(funnels)
      .where(and(eq(funnels.tenantId, tenantId), eq(funnels.slug, slug), eq(funnels.status, "active")))
      .limit(1);
    return f ?? null;
  });
}

const trackingSchema = z.object({
  utm: z.record(z.string().max(40), z.string().max(200)).default({}),
  fbclid: z.string().max(500).optional(),
  fbc: z.string().max(500).optional(),
  fbp: z.string().max(200).optional(),
  eventId: z.string().max(100).optional(),
});

export const submissionSchema = z
  .object({
    answers: z.record(z.string().max(40), z.union([z.string().max(1000), z.array(z.string().max(100)).max(20), z.number()])),
    name: z.string().trim().min(2, "Escribe tu nombre").max(120),
    email: z.email("Correo no válido").trim().toLowerCase().max(160),
    phone: z.string().trim().regex(/^[+\d][\d\s().-]{6,19}$/, "Teléfono no válido"),
    consent: z.literal(true, { error: "Necesitamos tu autorización para contactarte" }),
  })
  .extend(trackingSchema.shape);
export type SubmissionInput = z.infer<typeof submissionSchema>;

export type SubmissionOutcome =
  | { qualified: true; submissionId: string; pass: string }
  | { qualified: false; submissionId: string; reason: string | null };

/** `client`: IP/UA for the Conversions API, only when CAPI is connected (see ./client-data.ts). */
export async function submitFunnel(
  tenantId: string,
  funnelId: string,
  input: SubmissionInput,
  opts: { client?: ClientNetwork | null } = {},
): Promise<SubmissionOutcome> {
  return run(tenantId, async (tx) => {
    const [funnel] = await tx
      .select()
      .from(funnels)
      .where(and(eq(funnels.tenantId, tenantId), eq(funnels.id, funnelId), eq(funnels.status, "active")))
      .limit(1);
    if (!funnel) throw notFound("Formulario");
    const result = scoreSubmission(funnel.questions, input.answers as Answers, funnel.threshold);
    if (result.missing.length) throw new AppError("invalid", "Responde todas las preguntas obligatorias", { missing: result.missing });

    const source = input.utm.utm_source ? `funnel:${input.utm.utm_source}` : "funnel";
    const contact = await upsertContact(tx, tenantId, { name: input.name, email: input.email, phone: input.phone, source, consent: true, utm: input.utm });
    const [deal] = await tx
      .insert(deals)
      .values({
        tenantId,
        contactId: contact.id,
        funnelId: funnel.id,
        propertyId: funnel.propertyId,
        agentId: funnel.agentId,
        stage: result.qualified ? "qualified" : "nurture",
        score: result.score,
        source,
      })
      .returning();
    const [submission] = await tx
      .insert(funnelSubmissions)
      .values({
        tenantId,
        funnelId: funnel.id,
        contactId: contact.id,
        dealId: deal!.id,
        answers: input.answers as Answers,
        score: result.score,
        qualified: result.qualified,
        disqualifiedReason: result.disqualifiedReason,
        utm: input.utm,
        fbclid: input.fbclid ?? null,
        fbc: input.fbc ?? null,
        fbp: input.fbp ?? null,
        clientEventId: input.eventId ?? null,
        ...clientNetworkColumns(opts.client),
      })
      .returning();
    await logActivity(tx, {
      tenantId,
      contactId: contact.id,
      dealId: deal!.id,
      type: "funnel_submitted",
      data: { funnel: funnel.name, score: result.score, qualified: result.qualified, reason: result.disqualifiedReason, utm: input.utm },
    });
    // Conversions API "Lead". event_id is shared with the browser Pixel for deduplication.
    await enqueue(tx, {
      tenantId,
      type: "meta.capi",
      idempotencyKey: `capi:Lead:${submission!.id}`,
      payload: { eventName: "Lead", eventId: input.eventId ?? `lead-${submission!.id}`, submissionId: submission!.id, contactId: contact.id },
    });
    await enqueue(tx, { tenantId, type: "notify.agent.new_lead", payload: { dealId: deal!.id }, idempotencyKey: `deal:${deal!.id}:notify` });
    if (!result.qualified) {
      await scheduleSequence(tx, "lead_unqualified", { tenantId, contactId: contact.id, dealId: deal!.id, funnelId: funnel.id });
      return { qualified: false, submissionId: submission!.id, reason: result.disqualifiedReason };
    }
    return { qualified: true, submissionId: submission!.id, pass: bookingPass(submission!.id) };
  });
}

/* ───────────── scheduling ───────────── */

async function slotQuery(tx: Tx, tenantId: string, funnel: FunnelRow, agentId: string, now: Date, extraBusy: Interval[] = []): Promise<SlotQuery> {
  const horizon = new Date(now.getTime() + (funnel.maxDaysAhead + 2) * 86_400_000);
  const [[tenant], rules, taken, off] = await Promise.all([
    tx.select({ timezone: tenants.timezone }).from(tenants).where(eq(tenants.id, tenantId)),
    tx.select().from(availabilityRules).where(and(eq(availabilityRules.tenantId, tenantId), eq(availabilityRules.agentId, agentId))),
    tx
      .select({ start: bookings.startsAt, end: bookings.endsAt })
      .from(bookings)
      .where(and(eq(bookings.tenantId, tenantId), eq(bookings.agentId, agentId), eq(bookings.status, "confirmed"), gte(bookings.endsAt, now), lte(bookings.startsAt, horizon))),
    tx
      .select({ start: blackouts.startsAt, end: blackouts.endsAt })
      .from(blackouts)
      .where(and(eq(blackouts.tenantId, tenantId), eq(blackouts.agentId, agentId), gte(blackouts.endsAt, now))),
  ]);
  return {
    rules,
    busy: [...taken, ...off, ...extraBusy],
    timezone: tenant?.timezone ?? "America/Guayaquil",
    durationMinutes: funnel.durationMinutes,
    bufferMinutes: funnel.bufferMinutes,
    minNoticeHours: funnel.minNoticeHours,
    maxDaysAhead: funnel.maxDaysAhead,
    now,
  };
}

async function funnelAgent(tx: Tx, tenantId: string, funnel: FunnelRow): Promise<string> {
  if (funnel.agentId) return funnel.agentId;
  const [primary] = await tx
    .select({ id: agentProfiles.id })
    .from(agentProfiles)
    .where(and(eq(agentProfiles.tenantId, tenantId), eq(agentProfiles.isPrimary, true)))
    .limit(1);
  if (!primary) throw new AppError("unavailable", "No hay un agente disponible para agendar");
  return primary.id;
}

/** `busyProvider` lets the Google Calendar adapter add external busy times without coupling. */
export type BusyProvider = (agentId: string, from: Date, to: Date) => Promise<Interval[]>;

export async function availableSlots(tenantId: string, funnelId: string, opts: { now?: Date; busyProvider?: BusyProvider } = {}) {
  const now = opts.now ?? new Date();
  return run(tenantId, async (tx) => {
    const [funnel] = await tx.select().from(funnels).where(and(eq(funnels.tenantId, tenantId), eq(funnels.id, funnelId))).limit(1);
    if (!funnel) throw notFound("Formulario");
    const agentId = await funnelAgent(tx, tenantId, funnel);
    const external = opts.busyProvider ? await opts.busyProvider(agentId, now, new Date(now.getTime() + funnel.maxDaysAhead * 86_400_000)).catch(() => []) : [];
    const q = await slotQuery(tx, tenantId, funnel, agentId, now, external);
    return { timezone: q.timezone, durationMinutes: funnel.durationMinutes, slots: computeSlots(q) };
  });
}

export type BookInput = { submissionId: string; pass: string; startsAt: Date; now?: Date; busyProvider?: BusyProvider; client?: ClientNetwork | null };

export async function bookSlot(tenantId: string, input: BookInput): Promise<{ booking: BookingRow; manageToken: string }> {
  if (!safeEqual(bookingPass(input.submissionId), input.pass)) throw new AppError("forbidden", "Completa el formulario antes de agendar");
  const now = input.now ?? new Date();
  return run(tenantId, async (tx) => {
    const [sub] = await tx
      .select()
      .from(funnelSubmissions)
      .where(and(eq(funnelSubmissions.tenantId, tenantId), eq(funnelSubmissions.id, input.submissionId)))
      .limit(1);
    if (!sub || !sub.qualified || !sub.contactId || !sub.dealId) throw new AppError("forbidden", "Esta solicitud no puede agendar una cita");
    const [funnel] = await tx.select().from(funnels).where(and(eq(funnels.tenantId, tenantId), eq(funnels.id, sub.funnelId))).limit(1);
    if (!funnel) throw notFound("Formulario");
    const agentId = await funnelAgent(tx, tenantId, funnel);

    // Serialize bookings per agent so two visitors cannot take the same slot concurrently.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${agentId}))`);
    const existing = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.tenantId, tenantId), eq(bookings.dealId, sub.dealId), eq(bookings.status, "confirmed")));
    if (existing.length) throw new AppError("conflict", "Ya tienes una cita agendada. Revisa tu correo para cambiarla.");

    const external = input.busyProvider
      ? await input.busyProvider(agentId, now, new Date(now.getTime() + funnel.maxDaysAhead * 86_400_000)).catch(() => [])
      : [];
    const q = await slotQuery(tx, tenantId, funnel, agentId, now, external);
    if (!computeSlots(q).some((s) => s.getTime() === input.startsAt.getTime())) {
      throw new AppError("conflict", "Ese horario ya no está disponible. Elige otro.");
    }
    const manageToken = randomToken();
    const [booking] = await tx
      .insert(bookings)
      .values({
        tenantId,
        agentId,
        funnelId: funnel.id,
        contactId: sub.contactId,
        dealId: sub.dealId,
        propertyId: funnel.propertyId,
        startsAt: input.startsAt,
        endsAt: new Date(input.startsAt.getTime() + funnel.durationMinutes * 60_000),
        meetingKind: funnel.meetingKind,
        manageTokenHash: sha256(manageToken),
      })
      .returning();
    await tx.update(deals).set({ stage: "booked" }).where(eq(deals.id, sub.dealId));
    // Fresh IP/UA for the "Schedule" event; the "Lead" one may have cleared them already.
    if (input.client) {
      await tx
        .update(funnelSubmissions)
        .set(clientNetworkColumns(input.client))
        .where(and(eq(funnelSubmissions.tenantId, tenantId), eq(funnelSubmissions.id, sub.id)));
    }
    await logActivity(tx, {
      tenantId,
      contactId: sub.contactId,
      dealId: sub.dealId,
      type: "booking_created",
      data: { bookingId: booking!.id, startsAt: booking!.startsAt.toISOString() },
    });
    await scheduleSequence(tx, "booking_created", {
      tenantId,
      contactId: sub.contactId,
      dealId: sub.dealId,
      funnelId: funnel.id,
      bookingId: booking!.id,
      bookingStart: booking!.startsAt,
      now,
      // The plain token exists only now; messages carry it encrypted (needs ENCRYPTION_KEY).
      payload: process.env.ENCRYPTION_KEY ? { manageTokenEnc: encrypt(manageToken) } : undefined,
    });
    await enqueue(tx, { tenantId, type: "calendar.sync", idempotencyKey: `booking:${booking!.id}:calendar`, payload: { bookingId: booking!.id, action: "create" } });
    await enqueue(tx, {
      tenantId,
      type: "meta.capi",
      idempotencyKey: `capi:Schedule:${booking!.id}`,
      payload: { eventName: "Schedule", eventId: `schedule-${booking!.id}`, submissionId: sub.id, contactId: sub.contactId },
    });
    await enqueue(tx, { tenantId, type: "notify.agent.booking", idempotencyKey: `booking:${booking!.id}:notify`, payload: { bookingId: booking!.id } });
    return { booking: booking!, manageToken };
  });
}

/** Visitor self-service via the signed link in their confirmation. */
export async function findBookingByToken(tenantId: string, token: string): Promise<BookingRow | null> {
  return run(tenantId, async (tx) => {
    const [b] = await tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.tenantId, tenantId), eq(bookings.manageTokenHash, sha256(token))))
      .limit(1);
    return b ?? null;
  });
}

export async function cancelBookingByToken(tenantId: string, token: string): Promise<void> {
  await run(tenantId, async (tx) => {
    const [b] = await tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.tenantId, tenantId), eq(bookings.manageTokenHash, sha256(token)), eq(bookings.status, "confirmed")))
      .limit(1);
    if (!b) throw notFound("Cita");
    await tx.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, b.id));
    if (b.dealId) await tx.update(deals).set({ stage: "qualified" }).where(eq(deals.id, b.dealId));
    await cancelPending(tx, tenantId, `booking:${b.id}:seq:`);
    await enqueue(tx, { tenantId, type: "calendar.sync", idempotencyKey: `booking:${b.id}:calendar-cancel`, payload: { bookingId: b.id, action: "cancel" } });
    await logActivity(tx, { tenantId, contactId: b.contactId, dealId: b.dealId, type: "booking_cancelled", data: { bookingId: b.id } });
  });
}

/* ───────────── panel ───────────── */

export async function listFunnels(m: MemberContext) {
  return run(m.tenantId, (tx) => tx.select().from(funnels).where(eq(funnels.tenantId, m.tenantId)).orderBy(funnels.createdAt));
}

export async function createFunnelFromTemplate(m: MemberContext, key: (typeof FUNNEL_TEMPLATES)[number]["key"], slug: string) {
  const t = FUNNEL_TEMPLATES.find((x) => x.key === key);
  if (!t) throw new AppError("invalid", "Plantilla desconocida");
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) throw new AppError("invalid", "La dirección solo admite minúsculas, números y guiones");
  return run(m.tenantId, async (tx) => {
    const [f] = await tx
      .insert(funnels)
      .values({
        tenantId: m.tenantId,
        agentId: m.agentId,
        slug,
        name: t.name,
        vertical: t.vertical,
        headline: t.headline,
        subheadline: t.subheadline,
        questions: t.questions,
        threshold: t.threshold,
        durationMinutes: t.durationMinutes,
        meetingKind: t.meetingKind,
      })
      .returning();
    await installDefaultSequences(tx, m.tenantId, f!.id);
    await audit(tx, { tenantId: m.tenantId, actorUserId: m.userId, action: "funnel.create", entityType: "funnel", entityId: f!.id });
    return f!;
  });
}

export async function setFunnelStatus(m: MemberContext, id: string, status: "draft" | "active" | "paused") {
  return run(m.tenantId, async (tx) => {
    const [f] = await tx.update(funnels).set({ status }).where(and(eq(funnels.tenantId, m.tenantId), eq(funnels.id, id))).returning();
    if (!f) throw notFound("Formulario");
    await audit(tx, { tenantId: m.tenantId, actorUserId: m.userId, action: "funnel.status", entityType: "funnel", entityId: id, diff: { status } });
    return f;
  });
}

export async function listUpcomingBookings(m: MemberContext, from = new Date()) {
  return run(m.tenantId, (tx) =>
    tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.tenantId, m.tenantId), gte(bookings.startsAt, from), inArray(bookings.status, ["confirmed"])))
      .orderBy(bookings.startsAt)
      .limit(100),
  );
}

export async function markBookingOutcome(m: MemberContext, bookingId: string, outcome: "completed" | "no_show") {
  return run(m.tenantId, async (tx) => {
    const [b] = await tx.select().from(bookings).where(and(eq(bookings.tenantId, m.tenantId), eq(bookings.id, bookingId))).limit(1);
    if (!b) throw notFound("Cita");
    await tx.update(bookings).set({ status: outcome }).where(eq(bookings.id, bookingId));
    if (b.dealId) {
      await tx.update(deals).set({ stage: outcome === "completed" ? "attended" : "no_show" }).where(eq(deals.id, b.dealId));
      if (outcome === "no_show") {
        await scheduleSequence(tx, "no_show", { tenantId: m.tenantId, contactId: b.contactId, dealId: b.dealId, funnelId: b.funnelId, bookingId: b.id });
      }
    }
    await logActivity(tx, { tenantId: m.tenantId, contactId: b.contactId, dealId: b.dealId, type: `booking_${outcome}`, actorUserId: m.userId });
  });
}

export async function setWeeklyAvailability(m: MemberContext, agentId: string, rules: { weekday: number; startMinute: number; endMinute: number }[]) {
  const valid = rules.every((r) => r.weekday >= 0 && r.weekday <= 6 && r.startMinute >= 0 && r.endMinute <= 1440 && r.startMinute < r.endMinute);
  if (!valid) throw new AppError("invalid", "Horario no válido");
  return run(m.tenantId, async (tx) => {
    const [agent] = await tx.select({ id: agentProfiles.id }).from(agentProfiles).where(and(eq(agentProfiles.tenantId, m.tenantId), eq(agentProfiles.id, agentId)));
    if (!agent) throw notFound("Agente");
    await tx.delete(availabilityRules).where(and(eq(availabilityRules.tenantId, m.tenantId), eq(availabilityRules.agentId, agentId)));
    if (rules.length) await tx.insert(availabilityRules).values(rules.map((r) => ({ ...r, tenantId: m.tenantId, agentId })));
  });
}
