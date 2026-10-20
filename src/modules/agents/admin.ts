import "server-only";
import { z } from "zod";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { withTenant, type Tx } from "@/server/db/tenant-tx";
import {
  agentProfiles,
  availabilityRules,
  bookings,
  funnelSubmissions,
  funnels,
  jobs,
  tenants,
  type FunnelQuestion,
} from "@/server/db/schema";
import type { MemberContext } from "@/server/session";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { MEDIA_WIDTHS } from "@/lib/image-loader";
import { audit } from "@/modules/audit/audit";
import { getStorage } from "@/modules/media/storage";
import { processImage } from "@/modules/media/process";

/**
 * Agent profile & site settings for the panel, plus small read models the panel needs
 * (availability, funnel metrics, blocked jobs, funnel answers of a deal).
 */

export type AgentProfileRow = typeof agentProfiles.$inferSelect;

const run = async <T>(tenantId: string, fn: (tx: Tx) => Promise<T>) => withTenant(await getDb(), tenantId, fn);

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));

const url = z
  .string()
  .trim()
  .max(300)
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^https:\/\/[^\s]+\.[^\s]+$/i.test(v), "Usa un enlace completo que empiece con https://");

const phone = z
  .string()
  .trim()
  .max(24)
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^\+?[\d\s().-]{7,20}$/.test(v), "Número no válido. Ej.: +593 99 123 4567");

export const SOCIAL_KEYS = ["instagram", "facebook", "tiktok", "linkedin", "youtube", "x", "website"] as const;

export const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Escribe tu nombre").max(120),
  headline: text(160),
  bio: text(2000),
  whatsapp: phone,
  phone: phone,
  email: z
    .string()
    .trim()
    .max(160)
    .transform((v) => (v === "" ? null : v.toLowerCase()))
    .refine((v) => v === null || z.email().safeParse(v).success, "Correo no válido"),
  city: text(120),
  affiliation: text(160),
  socials: z.object(Object.fromEntries(SOCIAL_KEYS.map((k) => [k, url])) as Record<(typeof SOCIAL_KEYS)[number], typeof url>),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const siteSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del sitio").max(120),
  tagline: text(160),
});

/** The profile this member edits: their own, or the tenant's primary one for owners/admins without a profile. */
async function profileOf(tx: Tx, m: MemberContext): Promise<AgentProfileRow | null> {
  if (m.agentId) {
    const [own] = await tx.select().from(agentProfiles).where(and(eq(agentProfiles.tenantId, m.tenantId), eq(agentProfiles.id, m.agentId))).limit(1);
    if (own) return own;
  }
  if (m.role === "agent") return null;
  const [primary] = await tx
    .select()
    .from(agentProfiles)
    .where(and(eq(agentProfiles.tenantId, m.tenantId), eq(agentProfiles.isPrimary, true)))
    .limit(1);
  return primary ?? null;
}

export async function getMyProfile(m: MemberContext): Promise<AgentProfileRow | null> {
  return run(m.tenantId, (tx) => profileOf(tx, m));
}

/** Fields the public site needs to look complete. Used by the dashboard checklist. */
export function missingProfileFields(p: AgentProfileRow | null): string[] {
  if (!p) return ["perfil"];
  const missing: string[] = [];
  if (!p.photoUrl) missing.push("foto");
  if (!p.headline) missing.push("titular");
  if (!p.bio) missing.push("biografía");
  if (!p.whatsapp) missing.push("WhatsApp");
  if (!p.email) missing.push("correo");
  return missing;
}

export async function updateProfile(m: MemberContext, input: unknown): Promise<AgentProfileRow> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) throw new AppError("invalid", "Revisa los campos marcados", { issues: parsed.error.flatten().fieldErrors });
  const socials = Object.fromEntries(Object.entries(parsed.data.socials).filter(([, v]) => v)) as Record<string, string>;
  return run(m.tenantId, async (tx) => {
    const current = await profileOf(tx, m);
    if (!current) throw notFound("Perfil");
    const values = { ...parsed.data, socials };
    const [row] = await tx
      .update(agentProfiles)
      .set(values)
      .where(and(eq(agentProfiles.tenantId, m.tenantId), eq(agentProfiles.id, current.id)))
      .returning();
    const changed = (Object.keys(values) as (keyof typeof values)[]).filter((k) => JSON.stringify(values[k]) !== JSON.stringify(current[k]));
    await audit(tx, { tenantId: m.tenantId, actorUserId: m.userId, action: "agent.profile.update", entityType: "agent_profile", entityId: current.id, diff: { fields: changed } });
    return row!;
  });
}

/** Same image pipeline as property photos: content validation, EXIF/GPS stripped, WebP variants. */
export async function setProfilePhoto(m: MemberContext, input: Buffer): Promise<string> {
  const current = await getMyProfile(m);
  if (!current) throw notFound("Perfil");
  let processed;
  try {
    processed = await processImage(input);
  } catch {
    throw new AppError("invalid", "No pudimos leer la imagen. Usa una foto JPG, PNG, WebP o HEIC de menos de 25 MB.");
  }
  const baseKey = `tenants/${m.tenantId}/agents/${current.id}/photo-${crypto.randomUUID()}`;
  const storage = getStorage();
  await Promise.all(processed.variants.map((v, i) => storage.put(`${baseKey}-${MEDIA_WIDTHS[i]}.webp`, v.body, "image/webp")));
  const photoUrl = `media:${storage.url(baseKey)}`;
  await run(m.tenantId, async (tx) => {
    await tx.update(agentProfiles).set({ photoUrl }).where(and(eq(agentProfiles.tenantId, m.tenantId), eq(agentProfiles.id, current.id)));
    await audit(tx, { tenantId: m.tenantId, actorUserId: m.userId, action: "agent.profile.photo", entityType: "agent_profile", entityId: current.id });
  });
  const old = current.photoUrl?.match(/(tenants\/[^?#]+\/agents\/[^?#]+\/photo-[^/?#]+)$/)?.[1];
  if (old) await storage.remove(MEDIA_WIDTHS.map((w) => `${old}-${w}.webp`)).catch(() => undefined);
  return photoUrl;
}

export async function getSite(m: MemberContext) {
  const [t] = await run(m.tenantId, (tx) =>
    tx.select({ name: tenants.name, branding: tenants.branding }).from(tenants).where(eq(tenants.id, m.tenantId)).limit(1),
  );
  if (!t) throw notFound("Sitio");
  return { name: t.name, tagline: t.branding.tagline ?? null };
}

/**
 * Site name and tagline. `app_user` may only read its tenant row (RLS policy `tenants_self_read`),
 * so this single, role-checked update runs on the owner connection, scoped by the server-side tenant id.
 */
export async function updateSite(m: MemberContext, input: unknown) {
  if (m.role === "agent") throw forbidden();
  const parsed = siteSchema.safeParse(input);
  if (!parsed.success) throw new AppError("invalid", "Revisa los campos marcados", { issues: parsed.error.flatten().fieldErrors });
  const db = await getDb();
  const [t] = await db.select({ branding: tenants.branding }).from(tenants).where(eq(tenants.id, m.tenantId)).limit(1);
  if (!t) throw notFound("Sitio");
  const branding = { ...t.branding };
  if (parsed.data.tagline) branding.tagline = parsed.data.tagline;
  else delete branding.tagline;
  await db.update(tenants).set({ name: parsed.data.name, branding }).where(eq(tenants.id, m.tenantId));
  await run(m.tenantId, (tx) =>
    audit(tx, { tenantId: m.tenantId, actorUserId: m.userId, action: "tenant.site.update", entityType: "tenant", entityId: m.tenantId, diff: { fields: ["name", "tagline"] } }),
  );
}

/* ───────────── read models ───────────── */

export type AvailabilityRule = { weekday: number; startMinute: number; endMinute: number };

export async function getAvailability(m: MemberContext, agentId: string): Promise<AvailabilityRule[]> {
  return run(m.tenantId, (tx) =>
    tx
      .select({ weekday: availabilityRules.weekday, startMinute: availabilityRules.startMinute, endMinute: availabilityRules.endMinute })
      .from(availabilityRules)
      .where(and(eq(availabilityRules.tenantId, m.tenantId), eq(availabilityRules.agentId, agentId)))
      .orderBy(asc(availabilityRules.weekday), asc(availabilityRules.startMinute)),
  );
}

/** Whether the funnel's agent (or, without one, any agent of the tenant) has weekly hours configured. */
export async function funnelHasAvailability(m: MemberContext, funnelId: string): Promise<boolean> {
  return run(m.tenantId, async (tx) => {
    const [f] = await tx.select({ agentId: funnels.agentId }).from(funnels).where(and(eq(funnels.tenantId, m.tenantId), eq(funnels.id, funnelId))).limit(1);
    if (!f) throw notFound("Embudo");
    const [r] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(availabilityRules)
      .where(and(eq(availabilityRules.tenantId, m.tenantId), f.agentId ? eq(availabilityRules.agentId, f.agentId) : undefined));
    return (r?.n ?? 0) > 0;
  });
}

export async function funnelMetrics(m: MemberContext): Promise<Record<string, { submissions: number; qualified: number; bookings: number }>> {
  return run(m.tenantId, async (tx) => {
    const [subs, books] = await Promise.all([
      tx
        .select({
          funnelId: funnelSubmissions.funnelId,
          n: sql<number>`count(*)::int`,
          q: sql<number>`count(*) filter (where ${funnelSubmissions.qualified})::int`,
        })
        .from(funnelSubmissions)
        .where(eq(funnelSubmissions.tenantId, m.tenantId))
        .groupBy(funnelSubmissions.funnelId),
      tx
        .select({ funnelId: bookings.funnelId, n: sql<number>`count(*)::int` })
        .from(bookings)
        .where(eq(bookings.tenantId, m.tenantId))
        .groupBy(bookings.funnelId),
    ]);
    const out: Record<string, { submissions: number; qualified: number; bookings: number }> = {};
    for (const s of subs) out[s.funnelId] = { submissions: s.n, qualified: s.q, bookings: 0 };
    for (const b of books) if (b.funnelId) out[b.funnelId] = { submissions: 0, qualified: 0, ...out[b.funnelId], bookings: b.n };
    return out;
  });
}

export async function blockedJobCounts(m: MemberContext): Promise<{ type: string; n: number; lastError: string | null }[]> {
  return run(m.tenantId, (tx) =>
    tx
      .select({ type: jobs.type, n: sql<number>`count(*)::int`, lastError: sql<string | null>`max(${jobs.lastError})` })
      .from(jobs)
      .where(and(eq(jobs.tenantId, m.tenantId), eq(jobs.status, "blocked")))
      .groupBy(jobs.type)
      .orderBy(jobs.type),
  );
}

export type LabeledAnswer = { question: string; answer: string };

/** Latest funnel submission of a deal, with answers translated to the question/option labels. */
export async function dealSubmission(m: MemberContext, dealId: string) {
  return run(m.tenantId, async (tx) => {
    const [row] = await tx
      .select({ sub: funnelSubmissions, funnelName: funnels.name, questions: funnels.questions, threshold: funnels.threshold })
      .from(funnelSubmissions)
      .innerJoin(funnels, eq(funnels.id, funnelSubmissions.funnelId))
      .where(and(eq(funnelSubmissions.tenantId, m.tenantId), eq(funnelSubmissions.dealId, dealId)))
      .orderBy(sql`${funnelSubmissions.createdAt} desc`)
      .limit(1);
    if (!row) return null;
    return {
      funnelName: row.funnelName,
      score: row.sub.score,
      threshold: row.threshold,
      qualified: row.sub.qualified,
      disqualifiedReason: row.sub.disqualifiedReason,
      utm: row.sub.utm,
      answers: labelAnswers(row.questions, row.sub.answers),
    };
  });
}

export function labelAnswers(questions: FunnelQuestion[], answers: Record<string, string | string[] | number>): LabeledAnswer[] {
  return questions
    .filter((q) => answers[q.id] !== undefined && answers[q.id] !== "")
    .map((q) => {
      const raw = answers[q.id]!;
      const values = Array.isArray(raw) ? raw : [raw];
      const label = (v: string | number) => q.options?.find((o) => o.value === String(v))?.label ?? String(v);
      return { question: q.label, answer: values.map(label).join(", ") };
    });
}
