import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getAuth } from "./auth";
import { getDb } from "./db/client";
import { agentProfiles, memberships } from "./db/schema";
import { getCurrentTenant } from "./tenant";

export type MemberContext = {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userName: string;
  role: "owner" | "admin" | "agent";
  agentId: string | null;
};

/** Signed-in member of the tenant serving this host, or null. */
export const getMember = cache(async (): Promise<MemberContext | null> => {
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const tenant = await getCurrentTenant();
  const db = await getDb();
  const [m] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.tenantId, tenant.id), eq(memberships.userId, s.user.id)))
    .limit(1);
  if (!m) return null;
  const [agent] = await db
    .select({ id: agentProfiles.id })
    .from(agentProfiles)
    .where(and(eq(agentProfiles.tenantId, tenant.id), eq(agentProfiles.userId, s.user.id)))
    .limit(1);
  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
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
