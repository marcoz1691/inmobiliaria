import type { MetadataRoute } from "next";
import { siteOrigin } from "./(public)/_lib/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/panel", "/cita", "/dev", "/api"] }],
    sitemap: `${origin}/sitemap.xml`,
  };
}
