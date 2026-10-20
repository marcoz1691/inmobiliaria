import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { withTenant } from "@/server/db/tenant-tx";
import { agentProfiles, funnels, type SocialLinks } from "@/server/db/schema";

/** Fields of the agent profile that the public site may show. Empty fields stay null. */
export type PublicAgent = {
  id: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  photoUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  socials: SocialLinks;
  affiliation: string | null;
};

export type PublicSite = {
  agent: PublicAgent | null;
  /** Slugs of active funnels, oldest first; the first one is the site's main booking funnel. */
  funnelSlugs: string[];
};

const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/**
 * Public read of the tenant's primary agent and active funnels, under RLS (`withTenant`).
 * Never exposes the linked user id or internal flags.
 */
export async function getPublicSite(tenantId: string): Promise<PublicSite> {
  return withTenant(await getDb(), tenantId, async (tx) => {
    const [agentRows, funnelRows] = await Promise.all([
      tx
        .select()
        .from(agentProfiles)
        .where(eq(agentProfiles.tenantId, tenantId))
        .orderBy(desc(agentProfiles.isPrimary), asc(agentProfiles.createdAt))
        .limit(1),
      tx
        .select({ slug: funnels.slug })
        .from(funnels)
        .where(and(eq(funnels.tenantId, tenantId), eq(funnels.status, "active")))
        .orderBy(asc(funnels.createdAt)),
    ]);
    const a = agentRows[0];
    const socials: SocialLinks = {};
    for (const [k, v] of Object.entries(a?.socials ?? {})) {
      // Only absolute https links are rendered; anything else is ignored rather than "fixed".
      if (typeof v === "string" && /^https:\/\/\S+$/.test(v.trim())) socials[k as keyof SocialLinks] = v.trim();
    }
    const agent: PublicAgent | null = a
      ? {
          id: a.id,
          displayName: a.displayName,
          headline: blank(a.headline),
          bio: blank(a.bio),
          photoUrl: blank(a.photoUrl),
          phone: blank(a.phone),
          whatsapp: blank(a.whatsapp),
          email: blank(a.email),
          city: blank(a.city),
          socials,
          affiliation: blank(a.affiliation),
        }
      : null;
    return { agent, funnelSlugs: funnelRows.map((f) => f.slug) };
  });
}
