import "server-only";
import { createDb, type Db } from "./create";

const globalForDb = globalThis as unknown as { __db?: Promise<Db> };

/** Process-wide database. Postgres when DATABASE_URL is set, embedded PGlite otherwise (dev/test). */
export function getDb(): Promise<Db> {
  globalForDb.__db ??= createDb();
  return globalForDb.__db;
}
