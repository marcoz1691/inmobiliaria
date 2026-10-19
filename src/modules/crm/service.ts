import "server-only";
import { z } from "zod";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { withTenant, type Tx } from "@/server/db/tenant-tx";
import { activities, contacts, deals, properties, tasks } from "@/server/db/schema";
import type { MemberContext } from "@/server/session";
import { AppError, notFound } from "@/lib/errors";
import { audit } from "@/modules/audit/audit";
import { enqueue } from "@/modules/jobs/queue";

export const DEAL_STAGES = ["new", "qualified", "booked", "attended", "offer", "won", "lost", "no_show", "nurture"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];
export const STAGE_LABEL: Record<DealStage, string> = {
  new: "Nuevo",
  qualified: "Calificado",
  booked: "Cita agendada",
  attended: "Asistió",
  offer: "Oferta / propuesta",
  won: "Ganado",
  lost: "Perdido",
  no_show: "No asistió",
  nurture: "Seguimiento",
};

export const CONSENT_TEXT =
  "Acepto que mis datos se usen para responder a mi consulta y contactarme sobre propiedades, conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador. Puedo pedir su eliminación en cualquier momento.";

const phoneRe = /^[+\d][\d\s().-]{6,19}$/;

export const inquirySchema = z
  .object({
    name: z.string().trim().min(2, "Escribe tu nombre").max(120),
    email: z.email("Correo no válido").trim().toLowerCase().max(160).optional().or(z.literal("").transform(() => undefined)),
    phone: z.string().trim().regex(phoneRe, "Teléfono no válido").optional().or(z.literal("").transform(() => undefined)),
    message: z.string().trim().max(2000).optional(),
    consent: z.literal(true, { error: "Necesitamos tu autorización para contactarte" }),
    propertyId: z.uuid().optional(),
  })
  .refine((v) => v.email || v.phone, { message: "Déjanos un correo o un teléfono", path: ["phone"] });
export type InquiryInput = z.infer<typeof inquirySchema>;

export type ContactInput = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  source: string;
  consent: boolean;
  utm?: Record<string, string>;
};

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  // Ecuadorian mobile written locally (09xxxxxxxx) → E.164.
  if (/^09\d{8}$/.test(digits)) return `+593${digits.slice(1)}`;
  if (/^593\d{9}$/.test(digits)) return `+${digits}`;
  return digits;
}

/** Finds a contact by email or phone inside the tenant, or creates it. Fills gaps, never overwrites. */
export async function upsertContact(tx: Tx, tenantId: string, input: ContactInput) {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone ? normalizePhone(input.phone) : null;
  const match = [email ? eq(contacts.email, email) : undefined, phone ? eq(contacts.phone, phone) : undefined].filter(Boolean);
  const [existing] = match.length
    ? await tx
        .select()
        .from(contacts)
        .where(and(eq(contacts.tenantId, tenantId), or(...match)))
        .limit(1)
    : [];
  const consent = input.consent ? { consentAt: new Date(), consentText: CONSENT_TEXT } : {};
  if (existing) {
    const [updated] = await tx
      .update(contacts)
      .set({
        name: existing.name ?? input.name ?? null,
        email: existing.email ?? email,
        phone: existing.phone ?? phone,
        ...(existing.consentAt ? {} : consent),
      })
      .where(eq(contacts.id, existing.id))
      .returning();
    return updated!;
  }
  const [created] = await tx
    .insert(contacts)
    .values({ tenantId, name: input.name ?? null, email, phone, source: input.source, utm: input.utm ?? {}, ...consent })
    .returning();
  return created!;
}

export async function logActivity(
  tx: Tx,
  a: { tenantId: string; contactId: string; dealId?: string | null; type: string; body?: string | null; data?: Record<string, unknown>; actorUserId?: string | null },
) {
  await tx.insert(activities).values({ ...a, dealId: a.dealId ?? null, data: a.data ?? {}, actorUserId: a.actorUserId ?? null });
}

/**
 * Public contact / property inquiry form. Creates (or reuses) the contact, opens a deal linked to
 * the property and queues the agent notification.
 */
export async function captureInquiry(tenantId: string, input: InquiryInput, meta: { source: string; utm?: Record<string, string> }) {
  return withTenant(await getDb(), tenantId, async (tx) => {
    let propertyId: string | null = null;
    if (input.propertyId) {
      const [p] = await tx
        .select({ id: properties.id, agentId: properties.agentId })
        .from(properties)
        .where(and(eq(properties.tenantId, tenantId), eq(properties.id, input.propertyId)))
        .limit(1);
      propertyId = p?.id ?? null;
    }
    const contact = await upsertContact(tx, tenantId, { ...input, source: meta.source, consent: true, utm: meta.utm });
    const [deal] = await tx
      .insert(deals)
      .values({ tenantId, contactId: contact.id, propertyId, stage: "new", source: meta.source, message: input.message ?? null })
      .returning();
    await logActivity(tx, { tenantId, contactId: contact.id, dealId: deal!.id, type: "inquiry", body: input.message ?? null, data: { propertyId, source: meta.source } });
    await enqueue(tx, { tenantId, type: "notify.agent.new_lead", payload: { dealId: deal!.id }, idempotencyKey: `deal:${deal!.id}:notify` });
    return { contactId: contact.id, dealId: deal!.id };
  });
}

/* ───────────── panel ───────────── */

const run = async <T>(tenantId: string, fn: (tx: Tx) => Promise<T>) => withTenant(await getDb(), tenantId, fn);

export async function listDeals(m: MemberContext, opts: { stage?: DealStage; propertyId?: string } = {}) {
  return run(m.tenantId, (tx) =>
    tx
      .select({ deal: deals, contact: contacts, propertyTitle: properties.title, propertySlug: properties.slug })
      .from(deals)
      .innerJoin(contacts, eq(contacts.id, deals.contactId))
      .leftJoin(properties, eq(properties.id, deals.propertyId))
      .where(
        and(
          eq(deals.tenantId, m.tenantId),
          opts.stage ? eq(deals.stage, opts.stage) : undefined,
          opts.propertyId ? eq(deals.propertyId, opts.propertyId) : undefined,
        ),
      )
      .orderBy(desc(deals.updatedAt))
      .limit(500),
  );
}

export async function getDeal(m: MemberContext, dealId: string) {
  return run(m.tenantId, async (tx) => {
    const [row] = await tx
      .select({ deal: deals, contact: contacts, propertyTitle: properties.title, propertySlug: properties.slug })
      .from(deals)
      .innerJoin(contacts, eq(contacts.id, deals.contactId))
      .leftJoin(properties, eq(properties.id, deals.propertyId))
      .where(and(eq(deals.tenantId, m.tenantId), eq(deals.id, dealId)))
      .limit(1);
    if (!row) throw notFound("Prospecto");
    const timeline = await tx
      .select()
      .from(activities)
      .where(and(eq(activities.tenantId, m.tenantId), eq(activities.contactId, row.contact.id)))
      .orderBy(desc(activities.createdAt))
      .limit(200);
    const openTasks = await tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.tenantId, m.tenantId), eq(tasks.dealId, dealId)))
      .orderBy(tasks.doneAt, tasks.dueAt);
    return { ...row, timeline, tasks: openTasks };
  });
}

export async function moveDeal(m: MemberContext, dealId: string, stage: DealStage, lostReason?: string) {
  if (!DEAL_STAGES.includes(stage)) throw new AppError("invalid", "Etapa no válida");
  return run(m.tenantId, async (tx) => {
    const [current] = await tx.select().from(deals).where(and(eq(deals.tenantId, m.tenantId), eq(deals.id, dealId))).limit(1);
    if (!current) throw notFound("Prospecto");
    await tx
      .update(deals)
      .set({ stage, lostReason: stage === "lost" ? (lostReason ?? null) : null })
      .where(eq(deals.id, dealId));
    await logActivity(tx, { tenantId: m.tenantId, contactId: current.contactId, dealId, type: "stage_changed", data: { from: current.stage, to: stage }, actorUserId: m.userId });
    await audit(tx, { tenantId: m.tenantId, actorUserId: m.userId, action: "deal.stage", entityType: "deal", entityId: dealId, diff: { from: current.stage, to: stage } });
  });
}

export async function addNote(m: MemberContext, dealId: string, body: string) {
  const text = body.trim().slice(0, 4000);
  if (!text) throw new AppError("invalid", "La nota está vacía");
  return run(m.tenantId, async (tx) => {
    const [d] = await tx.select({ contactId: deals.contactId }).from(deals).where(and(eq(deals.tenantId, m.tenantId), eq(deals.id, dealId)));
    if (!d) throw notFound("Prospecto");
    await logActivity(tx, { tenantId: m.tenantId, contactId: d.contactId, dealId, type: "note", body: text, actorUserId: m.userId });
    await tx.update(deals).set({ updatedAt: new Date() }).where(eq(deals.id, dealId));
  });
}

export async function addTask(m: MemberContext, dealId: string, title: string, dueAt: Date | null) {
  return run(m.tenantId, async (tx) => {
    const [d] = await tx.select({ id: deals.id }).from(deals).where(and(eq(deals.tenantId, m.tenantId), eq(deals.id, dealId)));
    if (!d) throw notFound("Prospecto");
    await tx.insert(tasks).values({ tenantId: m.tenantId, dealId, title: title.trim().slice(0, 200), dueAt, assigneeUserId: m.userId });
  });
}

export async function toggleTask(m: MemberContext, taskId: string) {
  return run(m.tenantId, async (tx) => {
    const [t] = await tx.select().from(tasks).where(and(eq(tasks.tenantId, m.tenantId), eq(tasks.id, taskId)));
    if (!t) throw notFound("Tarea");
    await tx.update(tasks).set({ doneAt: t.doneAt ? null : new Date() }).where(eq(tasks.id, taskId));
  });
}

export async function dashboardCounts(m: MemberContext) {
  return run(m.tenantId, async (tx) => {
    const [byStage, props, dueTasks] = await Promise.all([
      tx
        .select({ stage: deals.stage, n: sql<number>`count(*)::int` })
        .from(deals)
        .where(eq(deals.tenantId, m.tenantId))
        .groupBy(deals.stage),
      tx
        .select({ status: properties.status, n: sql<number>`count(*)::int` })
        .from(properties)
        .where(eq(properties.tenantId, m.tenantId))
        .groupBy(properties.status),
      tx
        .select({ n: sql<number>`count(*)::int` })
        .from(tasks)
        .where(and(eq(tasks.tenantId, m.tenantId), sql`${tasks.doneAt} is null`, sql`${tasks.dueAt} <= now() + interval '1 day'`)),
    ]);
    return {
      deals: Object.fromEntries(byStage.map((r) => [r.stage, r.n])) as Partial<Record<DealStage, number>>,
      properties: Object.fromEntries(props.map((r) => [r.status, r.n])) as Record<string, number>,
      tasksDue: dueTasks[0]?.n ?? 0,
    };
  });
}

/** Opt-out (LOPDP). The job runner skips automated messages to opted-out contacts. */
export async function optOut(tenantId: string, contactId: string): Promise<void> {
  await withTenant(await getDb(), tenantId, async (tx) => {
    await tx.update(contacts).set({ optedOutAt: new Date() }).where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)));
    await logActivity(tx, { tenantId, contactId, type: "opted_out" });
  });
}
