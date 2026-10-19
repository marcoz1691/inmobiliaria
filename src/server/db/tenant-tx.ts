import { sql } from "drizzle-orm";
import type { Db } from "./create";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Runs `fn` inside a transaction restricted to one tenant: switches to the low-privilege
 * `app_user` role and sets `app.tenant_id`, so RLS rejects any row of another tenant even if
 * a repository forgets a `where tenant_id = …` clause.
 */
export async function withTenant<T>(db: Db, tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error("withTenant: invalid tenant id");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    await tx.execute(sql`set local role app_user`);
    return fn(tx);
  });
}
