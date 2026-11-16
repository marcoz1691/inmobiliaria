import type { MetadataRoute } from "next";
import { listPortalAgents } from "@/modules/agents/portal";
import { landingLinks } from "@/modules/properties/landing";
import { listPublicSlugs } from "@/modules/properties/service";
import { getFacets, getScope, getSite, isPortal, siteOrigin } from "./(public)/_lib/site";

/** Built from the request's host: the portal lists every agent's pages, an agent's domain only its own. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [scope, portal, origin, facets] = await Promise.all([getScope(), isPortal(), siteOrigin(), getFacets()]);
  const slugs = await listPublicSlugs(scope);
  const common: MetadataRoute.Sitemap = [
    { url: `${origin}/`, changeFrequency: portal ? "daily" : "weekly", priority: 1 },
    { url: `${origin}/propiedades`, changeFrequency: "daily", priority: 0.9 },
    // Search pages ("casas en venta en Quito"), only for combinations that have live listings.
    ...landingLinks(facets).map((l) => ({ url: `${origin}${l.href}`, changeFrequency: "daily" as const, priority: l.city ? 0.7 : 0.8 })),
    { url: `${origin}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
    ...slugs.map((p) => ({ url: `${origin}/propiedades/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
  if (portal) {
    const agents = await listPortalAgents();
    return [
      ...common,
      { url: `${origin}/agentes`, changeFrequency: "weekly", priority: 0.6 },
      ...agents.map((a) => ({ url: `${origin}/agentes/${a.tenantSlug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ];
  }
  const site = await getSite();
  return [
    ...common,
    { url: `${origin}/contacto`, changeFrequency: "monthly", priority: 0.5 },
    ...site.funnelSlugs.map((slug) => ({ url: `${origin}/agenda/${slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
