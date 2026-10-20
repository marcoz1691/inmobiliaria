import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@/server/db/create";
import type { Tx } from "@/server/db/tenant-tx";
import { agentProfiles, bookings, contacts, deals, funnels, properties, tenantDomains, tenants } from "@/server/db/schema";
import type { IntegrationConfig } from "./config";

/**
 * Public base URL for links sent to people (opt-out, booking management, funnel). In production
 * it is the tenant's own domain; elsewhere APP_URL. Runs as the system role: tenant_domains is not
 * granted to app_user.
 */
export async function tenantBaseUrl(db: Db, tenantId: string, config: IntegrationConfig): Promise<string> {
  if (process.env.NODE_ENV === "production") {
    const [d] = await db
      .select({ domain: tenantDomains.domain })
      .from(tenantDomains)
      .where(eq(tenantDomains.tenantId, tenantId))
      .orderBy(asc(tenantDomains.createdAt))
      .limit(1);
    if (d && !d.domain.includes("localhost")) return `https://${d.domain}`;
  }
  return config.appUrl.replace(/\/+$/, "");
}

export type AgentRow = typeof agentProfiles.$inferSelect;

export async function loadTenant(tx: Tx, tenantId: string) {
  const [t] = await tx.select({ id: tenants.id, name: tenants.name, timezone: tenants.timezone }).from(tenants).where(eq(tenants.id, tenantId));
  if (!t) throw new Error("Tenant no encontrado");
  return t;
}

/** Explicit agent, else the tenant's primary agent. */
export async function loadAgent(tx: Tx, tenantId: string, agentId?: string | null): Promise<AgentRow | null> {
  if (agentId) {
    const [a] = await tx.select().from(agentProfiles).where(and(eq(agentProfiles.tenantId, tenantId), eq(agentProfiles.id, agentId))).limit(1);
    if (a) return a;
  }
  const [p] = await tx
    .select()
    .from(agentProfiles)
    .where(and(eq(agentProfiles.tenantId, tenantId), eq(agentProfiles.isPrimary, true)))
    .limit(1);
  return p ?? null;
}

/** Active funnel to send people to: the given one if active, otherwise the newest active one (agent's first). */
export async function activeFunnel(tx: Tx, tenantId: string, opts: { funnelId?: string | null; agentId?: string | null; propertyId?: string | null } = {}) {
  const rows = await tx
    .select({ id: funnels.id, slug: funnels.slug, name: funnels.name, agentId: funnels.agentId, propertyId: funnels.propertyId })
    .from(funnels)
    .where(and(eq(funnels.tenantId, tenantId), eq(funnels.status, "active")))
    .orderBy(desc(funnels.createdAt));
  return (
    rows.find((f) => f.id === opts.funnelId) ??
    (opts.propertyId ? rows.find((f) => f.propertyId === opts.propertyId) : undefined) ??
    rows.find((f) => !f.propertyId && opts.agentId && f.agentId === opts.agentId) ??
    rows.find((f) => !f.propertyId) ??
    rows[0] ??
    null
  );
}

export async function loadRecords(tx: Tx, tenantId: string, ids: { contactId?: string | null; dealId?: string | null; bookingId?: string | null }) {
  const [contact] = ids.contactId
    ? await tx.select().from(contacts).where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, ids.contactId))).limit(1)
    : [];
  const [deal] = ids.dealId ? await tx.select().from(deals).where(and(eq(deals.tenantId, tenantId), eq(deals.id, ids.dealId))).limit(1) : [];
  const [booking] = ids.bookingId
    ? await tx.select().from(bookings).where(and(eq(bookings.tenantId, tenantId), eq(bookings.id, ids.bookingId))).limit(1)
    : [];
  const propertyId = booking?.propertyId ?? deal?.propertyId ?? null;
  const [property] = propertyId
    ? await tx
        .select({ id: properties.id, title: properties.title, slug: properties.slug, status: properties.status, agentId: properties.agentId })
        .from(properties)
        .where(and(eq(properties.tenantId, tenantId), eq(properties.id, propertyId)))
        .limit(1)
    : [];
  return { contact: contact ?? null, deal: deal ?? null, booking: booking ?? null, property: property ?? null };
}

const PUBLIC_PROPERTY = new Set(["published", "reserved", "sold", "rented"]);

export function propertyUrl(base: string, p: { slug: string; status: string } | null): string | null {
  return p && PUBLIC_PROPERTY.has(p.status) ? `${base}/propiedades/${encodeURIComponent(p.slug)}` : null;
}

export function funnelUrl(base: string, slug: string | null | undefined, utm?: Record<string, string>): string | null {
  if (!slug) return null;
  const q = utm ? `?${new URLSearchParams(utm)}` : "";
  return `${base}/agenda/${encodeURIComponent(slug)}${q}`;
}
