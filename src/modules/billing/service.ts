import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { withTenant, type Tx } from "@/server/db/tenant-tx";
import { properties, tenants } from "@/server/db/schema";
import type { MemberContext } from "@/server/session";
import { effectivePlan, PLAN_IDS, PLANS, planLimitMessage, type Plan, type PlanId } from "./plans";

/** Statuses that occupy a slot of the plan's listing limit. */
const LIVE = ["published", "reserved"] as const;
const AI_WINDOW_SECONDS = 30 * 24 * 60 * 60;

export const aiQuotaKey = (tenantId: string) => `ai-import-month:${tenantId}`;

/** The workspace's plan, read inside its own tenant transaction (RLS: own tenant row only). */
export async function planOf(tx: Tx, tenantId: string): Promise<Plan & { expiresAt: Date | null; chosen: PlanId }> {
  const [row] = await tx.select({ plan: tenants.plan, expiresAt: tenants.planExpiresAt }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const plan = effectivePlan(row?.plan, row?.expiresAt);
  return { ...plan, expiresAt: row?.expiresAt ?? null, chosen: (row?.plan as PlanId) ?? "free" };
}

const countLive = (tx: Tx, tenantId: string, excludeId?: string) =>
  tx
    .select({ n: sql<number>`count(*)::int` })
    .from(properties)
    .where(and(eq(properties.tenantId, tenantId), inArray(properties.status, [...LIVE]), excludeId ? sql`${properties.id} <> ${excludeId}` : undefined))
    .then((r) => r[0]?.n ?? 0);

/** Throws when putting one more listing live would exceed the plan. */
export async function assertCanGoLive(tx: Tx, tenantId: string, propertyId: string): Promise<void> {
  const plan = await planOf(tx, tenantId);
  if ((await countLive(tx, tenantId, propertyId)) >= plan.maxListings) {
    throw new AppError("forbidden", planLimitMessage(plan, "listings"), { upgrade: true });
  }
}

/** Throws when featuring one more listing would exceed the plan. */
export async function assertCanFeature(tx: Tx, tenantId: string, propertyId: string): Promise<void> {
  const plan = await planOf(tx, tenantId);
  const [{ n } = { n: 0 }] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(properties)
    .where(and(eq(properties.tenantId, tenantId), eq(properties.featured, true), sql`${properties.id} <> ${propertyId}`));
  if (n >= plan.maxFeatured) throw new AppError("forbidden", planLimitMessage(plan, "featured"), { upgrade: true });
}

export type PlanUsage = { plan: Plan & { expiresAt: Date | null; chosen: PlanId }; live: number; featured: number; aiUsed: number };

/** What the plan page shows: the plan and how much of it is in use. */
export async function planUsage(m: MemberContext): Promise<PlanUsage> {
  const db = await getDb();
  const usage = await withTenant(db, m.tenantId, async (tx) => {
    const plan = await planOf(tx, m.tenantId);
    const live = await countLive(tx, m.tenantId);
    const [{ n: featured } = { n: 0 }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(properties)
      .where(and(eq(properties.tenantId, m.tenantId), eq(properties.featured, true)));
    return { plan, live, featured };
  });
  // Same fixed window as rateLimit() in src/server/rate-limit.ts.
  const rows = await db.execute<{ count: number }>(sql`
    select count from rate_limits
    where key = ${aiQuotaKey(m.tenantId)}
      and window_start = to_timestamp(floor(extract(epoch from now()) / ${AI_WINDOW_SECONDS}) * ${AI_WINDOW_SECONDS})`);
  const list = Array.isArray(rows) ? rows : (rows as unknown as { rows: { count: number }[] }).rows;
  return { ...usage, aiUsed: Math.min(Number(list[0]?.count ?? 0), usage.plan.aiImportsPerMonth) };
}

export { AI_WINDOW_SECONDS };

/** Operator action until online payments are connected: activate a plan for N months. */
export async function setPlan(tenantSlug: string, plan: PlanId, months: number | null): Promise<{ tenantId: string; expiresAt: Date | null }> {
  if (!(PLAN_IDS as readonly string[]).includes(plan)) throw new AppError("invalid", `Plan desconocido: ${plan}`);
  const expiresAt = plan === "free" || months === null ? null : new Date(Date.now() + months * 31 * 24 * 60 * 60 * 1000);
  const db = await getDb();
  const [row] = await db.update(tenants).set({ plan, planExpiresAt: expiresAt }).where(eq(tenants.slug, tenantSlug)).returning({ id: tenants.id });
  if (!row) throw new AppError("not_found", `No existe el espacio "${tenantSlug}"`);
  return { tenantId: row.id, expiresAt };
}

export { PLANS };
