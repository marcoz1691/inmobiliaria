import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { env } from "@/env";
import { getDb } from "./db/client";
import { tenantDomains, tenants } from "./db/schema";

export type Tenant = typeof tenants.$inferSelect;

export function normalizeHost(host: string | null): string | null {
  if (!host) return null;
  return host.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
}

/** Base domain for automatic agent subdomains; "localhost" in development. */
export function tenantBaseDomain(): string | null {
  return env.TENANT_BASE_DOMAIN?.toLowerCase() ?? (env.NODE_ENV === "production" ? null : "localhost");
}

/** Tenant slug encoded in a host like "maria.miportal.ec", or null. One label only: no "a.b.miportal.ec". */
export function subdomainSlug(host: string, base: string | null = tenantBaseDomain()): string | null {
  if (!base || !host.endsWith(`.${base}`)) return null;
  const label = host.slice(0, -(base.length + 1));
  return /^[a-z0-9](?:[a-z0-9-]{0,62})$/.test(label) ? label : null;
}

/**
 * Tenant whose site the current Host serves, derived only from the Host header (never from
 * client input): a registered domain, or an automatic subdomain. In "portal" mode any other host
 * is the portal (null); in "single" mode it falls back to DEFAULT_TENANT_SLUG.
 */
export const getHostTenant = cache(async (): Promise<Tenant | null> => {
  const db = await getDb();
  const host = normalizeHost((await headers()).get("host"));
  if (host) {
    const [row] = await db
      .select({ tenant: tenants })
      .from(tenantDomains)
      .innerJoin(tenants, eq(tenants.id, tenantDomains.tenantId))
      .where(eq(tenantDomains.domain, host))
      .limit(1);
    if (row) return row.tenant;
    const slug = subdomainSlug(host);
    if (slug) {
      const [bySlug] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
      if (bySlug) return bySlug;
    }
  }
  if (env.SITE_MODE === "portal") return null;
  const [fallback] = await db.select().from(tenants).where(eq(tenants.slug, env.DEFAULT_TENANT_SLUG)).limit(1);
  if (!fallback) throw new Error(`Tenant "${env.DEFAULT_TENANT_SLUG}" not found. Run \`npm run db:seed\`.`);
  return fallback;
});

/** For pages that only exist on an agent's site (booking funnel, contact): 404 on the portal. */
export async function getCurrentTenant(): Promise<Tenant> {
  return (await getHostTenant()) ?? notFound();
}
