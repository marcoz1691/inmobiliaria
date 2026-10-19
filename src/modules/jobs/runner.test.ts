import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { seedTenant, testDb } from "../../../test/db";
import type { Db } from "@/server/db/create";
import { jobs } from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant-tx";
import { enqueue } from "./queue";
import { runDueJobs } from "./runner";

describe("job runner", () => {
  let db: Db;
  let tenantId: string;
  beforeAll(async () => {
    db = await testDb();
    tenantId = (await seedTenant(db, "a")).tenant.id;
  });

  it("is idempotent: enqueuing twice and running twice sends once", async () => {
    for (let i = 0; i < 2; i++) {
      await withTenant(db, tenantId, (tx) => enqueue(tx, { tenantId, type: "test.send", idempotencyKey: "k1" }));
    }
    let sent = 0;
    const handlers = { "test.send": async () => (sent++, { status: "done" as const }) };
    await runDueJobs(db, handlers);
    await runDueJobs(db, handlers);
    expect(sent).toBe(1);
  });

  it("parks jobs without credentials as blocked and retries failures with backoff", async () => {
    await withTenant(db, tenantId, async (tx) => {
      await enqueue(tx, { tenantId, type: "wa.send", idempotencyKey: "k2" });
      await enqueue(tx, { tenantId, type: "flaky", idempotencyKey: "k3" });
      await enqueue(tx, { tenantId, type: "unknown", idempotencyKey: "k4" });
    });
    const summary = await runDueJobs(db, {
      "wa.send": async () => ({ status: "blocked", reason: "WhatsApp no conectado" }),
      flaky: async () => {
        throw new Error("timeout");
      },
    });
    expect(summary).toMatchObject({ blocked: 2, failed: 1 });
    const [flaky] = await db.select().from(jobs).where(eq(jobs.idempotencyKey, "k3"));
    expect(flaky).toMatchObject({ status: "pending", attempts: 1, lastError: "timeout" });
    expect(flaky!.runAt.getTime()).toBeGreaterThan(Date.now());
  });
});
