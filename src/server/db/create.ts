import { mkdirSync } from "node:fs";
import path from "node:path";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzlePg<typeof schema>>;

const migrationsFolder = path.join(process.cwd(), "drizzle");

type Options = { databaseUrl?: string; pgliteDir?: string; migrate?: boolean };

/**
 * Builds a database handle. PGlite is typed as the postgres-js flavour: both expose the same
 * PgDatabase query API, which is all the app relies on.
 */
export async function createDb(opts: Options = {}): Promise<Db> {
  const databaseUrl = opts.databaseUrl ?? (process.env.DATABASE_URL || undefined);
  if (databaseUrl) {
    const { default: postgres } = await import("postgres");
    // prepare:false keeps compatibility with Supabase's transaction pooler.
    const client = postgres(databaseUrl, { prepare: false, max: 5 });
    const db = drizzlePg(client, { schema, casing: "snake_case" });
    if (opts.migrate) await migratePg(db, { migrationsFolder });
    return db;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = opts.pgliteDir ?? process.env.PGLITE_DIR ?? ".data/pglite";
  if (dir !== "memory") mkdirSync(path.dirname(path.resolve(dir)), { recursive: true });
  const client = dir === "memory" ? new PGlite() : new PGlite(path.resolve(dir));
  const db = drizzlePglite(client, { schema, casing: "snake_case" });
  // Embedded databases migrate on boot so `npm run dev` works with zero setup.
  await migratePglite(db, { migrationsFolder });
  return db as unknown as Db;
}
