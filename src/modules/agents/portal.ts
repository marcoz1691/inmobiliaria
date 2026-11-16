import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { withPortal } from "@/server/db/tenant-tx";
import { agentProfiles, properties, tenants } from "@/server/db/schema";
import { CATALOG_STATUSES } from "@/modules/properties/domain";
import { toPublicAgent, type PublicAgent } from "./public";

/** Columns the portal role may read on agent_profiles (drizzle/0005). */
const AGENT_COLUMNS = {
  id: agentProfiles.id,
  tenantId: agentProfiles.tenantId,
  displayName: agentProfiles.displayName,
  headline: agentProfiles.headline,
  bio: agentProfiles.bio,
  photoUrl: agentProfiles.photoUrl,
  phone: agentProfiles.phone,
  whatsapp: agentProfiles.whatsapp,
  email: agentProfiles.email,
  city: agentProfiles.city,
  socials: agentProfiles.socials,
  affiliation: agentProfiles.affiliation,
};

export type PortalAgent = PublicAgent & { tenantSlug: string; listings: number };

const liveCount = sql<number>`(select count(*)::int from ${properties} p where p.tenant_id = ${agentProfiles.tenantId} and p.status in (${sql.join(
  CATALOG_STATUSES.map((s) => sql`${s}`),
  sql`, `,
)}))`;

/** Agents with at least one live listing, busiest first. One card per workspace (its main profile). */
export async function listPortalAgents(): Promise<PortalAgent[]> {
  return withPortal(await getDb(), async (tx) => {
    const rows = await tx
      .select({ ...AGENT_COLUMNS, tenantSlug: tenants.slug, listings: liveCount })
      .from(agentProfiles)
      .innerJoin(tenants, eq(tenants.id, agentProfiles.tenantId))
      .where(and(eq(agentProfiles.isPrimary, true), sql`${liveCount} > 0`))
      .orderBy(desc(liveCount), asc(agentProfiles.displayName));
    return rows.map((r) => ({ ...toPublicAgent(r), tenantSlug: r.tenantSlug, listings: r.listings }));
  });
}

/** An agent's public page on the portal (/agentes/<workspace slug>). */
export async function getPortalAgent(tenantSlug: string): Promise<(PortalAgent & { tenantId: string }) | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(tenantSlug)) return null;
  return withPortal(await getDb(), async (tx) => {
    const [r] = await tx
      .select({ ...AGENT_COLUMNS, tenantSlug: tenants.slug, listings: liveCount })
      .from(agentProfiles)
      .innerJoin(tenants, eq(tenants.id, agentProfiles.tenantId))
      .where(eq(tenants.slug, tenantSlug))
      .orderBy(desc(agentProfiles.isPrimary), asc(agentProfiles.createdAt))
      .limit(1);
    return r ? { ...toPublicAgent(r), tenantSlug: r.tenantSlug, listings: r.listings, tenantId: r.tenantId } : null;
  });
}

/** Who answers for a listing on the portal: its assigned agent, else the workspace's main profile. */
export async function getListingAgent(tenantId: string, agentId: string | null): Promise<(PublicAgent & { tenantSlug: string }) | null> {
  return withPortal(await getDb(), async (tx) => {
    const rows = await tx
      .select({ ...AGENT_COLUMNS, tenantSlug: tenants.slug, isPrimary: agentProfiles.isPrimary })
      .from(agentProfiles)
      .innerJoin(tenants, eq(tenants.id, agentProfiles.tenantId))
      .where(and(eq(agentProfiles.tenantId, tenantId), agentId ? inArray(agentProfiles.id, [agentId]) : eq(agentProfiles.isPrimary, true)))
      .limit(1);
    const r =
      rows[0] ??
      (
        await tx
          .select({ ...AGENT_COLUMNS, tenantSlug: tenants.slug, isPrimary: agentProfiles.isPrimary })
          .from(agentProfiles)
          .innerJoin(tenants, eq(tenants.id, agentProfiles.tenantId))
          .where(eq(agentProfiles.tenantId, tenantId))
          .orderBy(desc(agentProfiles.isPrimary))
          .limit(1)
      )[0];
    return r ? { ...toPublicAgent(r), tenantSlug: r.tenantSlug } : null;
  });
}
