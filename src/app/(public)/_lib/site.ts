import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { env } from "@/env";
import { getCurrentTenant } from "@/server/tenant";
import { getPublicSite, type PublicAgent } from "@/modules/agents/public";

/**
 * Origin of the current request ("https://agente.ec"), used for canonical URLs, sitemap and
 * share links. The tenant itself is resolved from the same Host header on the server.
 */
export const siteOrigin = cache(async (): Promise<string> => {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return env.APP_URL.replace(/\/$/, "");
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || (local ? "http" : "https");
  return `${proto === "http" ? "http" : "https"}://${host.toLowerCase()}`;
});

export type SiteContext = {
  tenantId: string;
  timezone: string;
  /** Agent's display name, or the tenant name when there is no profile yet. */
  name: string;
  agent: PublicAgent | null;
  /** Main booking funnel ("/agenda/<slug>"), or null when none is active. */
  funnelHref: string | null;
  /** Where "Agenda una cita" points: the funnel, or the contact page as a fallback. */
  bookingHref: string;
  funnelSlugs: string[];
};

export const getSite = cache(async (): Promise<SiteContext> => {
  const tenant = await getCurrentTenant();
  const { agent, funnelSlugs } = await getPublicSite(tenant.id);
  const funnelHref = funnelSlugs[0] ? `/agenda/${funnelSlugs[0]}` : null;
  return {
    tenantId: tenant.id,
    timezone: tenant.timezone,
    name: agent?.displayName ?? tenant.name,
    agent,
    funnelHref,
    bookingHref: funnelHref ?? "/contacto",
    funnelSlugs,
  };
});

/** "Asesor inmobiliario · Quito"-style descriptor built only from fields the agent filled in. */
export function agentTagline(agent: PublicAgent | null): string | undefined {
  const parts = [agent?.headline, agent?.city].filter((p): p is string => Boolean(p));
  return parts.length ? parts.join(" · ") : undefined;
}

/** Absolute URL of the largest variant of a `media:` image (Open Graph, JSON-LD). */
export function absoluteImage(src: string | null | undefined, origin: string): string | undefined {
  if (!src) return undefined;
  const path = src.startsWith("media:") ? `${src.slice("media:".length)}-1600.webp` : src;
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith("/")) return `${origin}${path}`;
  return undefined;
}
