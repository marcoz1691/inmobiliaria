import { describe, expect, it, beforeAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import { withTenant } from "@/server/db/tenant-tx";
import { auditLog, properties } from "@/server/db/schema";
import type { Db } from "@/server/db/create";
import { seedTenant, testDb } from "./db";

describe("row level security", () => {
  let db: Db;
  let a: Awaited<ReturnType<typeof seedTenant>>;
  let b: Awaited<ReturnType<typeof seedTenant>>;

  beforeAll(async () => {
    db = await testDb();
    a = await seedTenant(db, "a");
    b = await seedTenant(db, "b");
    await db.insert(properties).values([
      { tenantId: a.tenant.id, slug: "casa-a", title: "Casa A" },
      { tenantId: b.tenant.id, slug: "casa-b", title: "Casa B" },
    ]);
  });

  it("hides other tenants' rows even without a where clause", async () => {
    const rows = await withTenant(db, a.tenant.id, (tx) => tx.select().from(properties));
    expect(rows.map((r) => r.slug)).toEqual(["casa-a"]);
  });

  it("rejects writes into another tenant", async () => {
    await expect(
      withTenant(db, a.tenant.id, (tx) => tx.insert(properties).values({ tenantId: b.tenant.id, slug: "intrusa" })),
    ).rejects.toThrow();
  });

  it("cannot update or delete another tenant's rows", async () => {
    const updated = await withTenant(db, a.tenant.id, (tx) =>
      tx.update(properties).set({ title: "hack" }).where(eq(properties.slug, "casa-b")).returning(),
    );
    expect(updated).toHaveLength(0);
    const deleted = await withTenant(db, a.tenant.id, (tx) => tx.delete(properties).where(eq(properties.slug, "casa-b")).returning());
    expect(deleted).toHaveLength(0);
  });

  it("app_user cannot read auth tables", async () => {
    await expect(withTenant(db, a.tenant.id, (tx) => tx.execute(sql`select * from "session"`))).rejects.toThrow();
  });

  it("audit log is append-only", async () => {
    await withTenant(db, a.tenant.id, (tx) =>
      tx.insert(auditLog).values({ tenantId: a.tenant.id, action: "test", entityType: "property" }),
    );
    await expect(withTenant(db, a.tenant.id, (tx) => tx.update(auditLog).set({ action: "x" }))).rejects.toThrow();
  });
});
