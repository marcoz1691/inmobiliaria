import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { getAuth } from "./auth";
import { getDb } from "./db/client";
import { agentProfiles, memberships, tenants } from "./db/schema";
import { getHostTenant } from "./tenant";

export type MemberContext = {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userName: string;
  role: "owner" | "admin" | "agent";
  agentId: string | null;
};

/**
 * Signed-in member, or null. On an agent's own domain the session must belong to that tenant;
 * on the portal the panel opens the account's own workspace (its owner membership first).
 */
export const getMember = cache(async (): Promise<MemberContext | null> => {
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const hostTenant = await getHostTenant();
  const db = await getDb();
  const [m] = await db
    .select({ role: memberships.role, tenantId: tenants.id, tenantSlug: tenants.slug })
    .from(memberships)
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(and(eq(memberships.userId, s.user.id), hostTenant ? eq(memberships.tenantId, hostTenant.id) : undefined))
    .orderBy(sql`case ${memberships.role} when 'owner' then 0 when 'admin' then 1 else 2 end`, asc(memberships.createdAt))
    .limit(1);
  if (!m) return null;
  const [agent] = await db
    .select({ id: agentProfiles.id })
    .from(agentProfiles)
    .where(and(eq(agentProfiles.tenantId, m.tenantId), eq(agentProfiles.userId, s.user.id)))
    .limit(1);
  return {
    tenantId: m.tenantId,
    tenantSlug: m.tenantSlug,
    userId: s.user.id,
    userName: s.user.name,
    role: m.role,
    agentId: agent?.id ?? null,
  };
});

/** For panel pages and server actions: redirects to login when there is no valid membership. */
export async function requireMember(): Promise<MemberContext> {
  const member = await getMember();
  if (!member) redirect("/panel/ingresar");
  return member;
}
