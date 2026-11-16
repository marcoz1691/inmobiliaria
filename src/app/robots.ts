import { env } from "@/env";
import type { MetadataRoute } from "next";
import { siteOrigin } from "./(public)/_lib/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  if (env.APP_ENV === "staging") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/panel", "/cita", "/dev", "/api"] }],
    sitemap: `${origin}/sitemap.xml`,
  };
}
