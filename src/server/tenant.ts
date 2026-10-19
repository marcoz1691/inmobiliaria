import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { env } from "@/env";
import { getDb } from "./db/client";
import { tenantDomains, tenants } from "./db/schema";

export type Tenant = typeof tenants.$inferSelect;

export function normalizeHost(host: string | null): string | null {
  if (!host) return null;
  return host.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
}

/**
 * Tenant for the current request, derived only from the Host header (never from client input).
 * Unknown hosts fall back to DEFAULT_TENANT_SLUG so single-tenant deploys and localhost work.
 */
export const getCurrentTenant = cache(async (): Promise<Tenant> => {
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
  }
  const [fallback] = await db.select().from(tenants).where(eq(tenants.slug, env.DEFAULT_TENANT_SLUG)).limit(1);
  if (!fallback) throw new Error(`Tenant "${env.DEFAULT_TENANT_SLUG}" not found. Run \`npm run db:seed\`.`);
  return fallback;
});
