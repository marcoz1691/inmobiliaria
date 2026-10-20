import type { MetadataRoute } from "next";
import { listPublicSlugs } from "@/modules/properties/service";
import { getSite, siteOrigin } from "./(public)/_lib/site";

/** Per-tenant sitemap: built from the request's host, so each domain lists only its own pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [site, origin] = await Promise.all([getSite(), siteOrigin()]);
  const slugs = await listPublicSlugs(site.tenantId);
  return [
    { url: `${origin}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/propiedades`, changeFrequency: "daily", priority: 0.9 },
    { url: `${origin}/contacto`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origin}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
    ...site.funnelSlugs.map((slug) => ({ url: `${origin}/agenda/${slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...slugs.map((p) => ({ url: `${origin}/propiedades/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
