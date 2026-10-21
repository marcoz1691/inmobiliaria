import { beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { useTestDb } from "../../test/db";
import type { Db } from "./db/create";
import { rateLimit } from "./rate-limit";

describe("rateLimit (Postgres fixed window)", () => {
  let db: Db;
  beforeAll(async () => {
    db = await useTestDb();
  });

  it("allows exactly `max` hits per window, then refuses", async () => {
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await rateLimit("form:ip-a", 3, 3600));
    expect(results).toEqual([true, true, true, false, false]);
  });

  it("keys are independent", async () => {
    for (let i = 0; i < 2; i++) await rateLimit("login:ip-b", 2, 3600);
    expect(await rateLimit("login:ip-b", 2, 3600)).toBe(false);
    expect(await rateLimit("login:ip-c", 2, 3600)).toBe(true);
    expect(await rateLimit("otro:ip-b", 2, 3600)).toBe(true);
  });

  it("concurrent hits never let more than `max` through", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => rateLimit("burst", 5, 3600)));
    expect(results.filter(Boolean)).toHaveLength(5);
  });

  it("max 0 refuses everything; keys are bound as parameters", async () => {
    expect(await rateLimit("zero", 0, 3600)).toBe(false);
    const evil = "x'); drop table rate_limits; --";
    expect(await rateLimit(evil, 1, 3600)).toBe(true);
    const rows = await db.execute<{ n: number }>(sql`select count(*)::int as n from rate_limits where key = ${evil}`);
    const list = Array.isArray(rows) ? rows : (rows as unknown as { rows: { n: number }[] }).rows;
    expect(list[0]?.n).toBe(1);
  });

  it("a new window starts a new count", async () => {
    // 1-second windows: wait for the next boundary instead of mocking the database clock.
    expect(await rateLimit("window", 1, 1)).toBe(true);
    await new Promise((r) => setTimeout(r, 1100));
    expect(await rateLimit("window", 1, 1)).toBe(true);
  });
});
