import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "./db/client";

/**
 * Fixed-window counter stored in Postgres so it holds across serverless instances.
 * Returns false once `max` hits are exceeded inside `windowSeconds`.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, window_start, count)
    values (${key}, to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds}), 1)
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count`);
  const rows = Array.isArray(result) ? result : (result as unknown as { rows: { count: number }[] }).rows;
  return Number(rows[0]?.count ?? 0) <= max;
}
