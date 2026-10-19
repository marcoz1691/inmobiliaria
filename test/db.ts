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
