import { createDb, type Db } from "@/server/db/create";
import { tenants, agentProfiles } from "@/server/db/schema";

/** Fresh in-memory database with all migrations applied. */
export async function testDb(): Promise<Db> {
  return createDb({ databaseUrl: "", pgliteDir: "memory" });
}

export async function seedTenant(db: Db, slug: string) {
  const [tenant] = await db.insert(tenants).values({ slug, name: `Tenant ${slug}` }).returning();
  const [agent] = await db
    .insert(agentProfiles)
    .values({ tenantId: tenant!.id, slug: `agente-${slug}`, displayName: `Agente ${slug}`, isPrimary: true })
    .returning();
  return { tenant: tenant!, agent: agent! };
}

/** Points the process-wide getDb() (src/server/db/client.ts) at a fresh in-memory database. */
export async function useTestDb(): Promise<Db> {
  const db = await testDb();
  (globalThis as unknown as { __db?: Promise<Db> }).__db = Promise.resolve(db);
  return db;
}

export function member(
  tenantId: string,
  over: Partial<import("@/server/session").MemberContext> = {},
): import("@/server/session").MemberContext {
  return { tenantId, tenantSlug: "t", userId: "user-" + tenantId.slice(0, 8), userName: "Test", role: "owner", agentId: null, ...over };
}
