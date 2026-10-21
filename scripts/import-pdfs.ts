/**
 * Imports every PDF in `assets-input/pdfs` for the pilot tenant.
 * Delegates to `importPdf` (no invented listings; drafts stay in `needsReview`).
 * Non-PDF files (e.g. .pptx) are skipped.
 */
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { createDb } from "../src/server/db/create";
import { agentProfiles, memberships, tenants, user } from "../src/server/db/schema";
import { importPdf } from "../src/modules/imports/service";
import type { MemberContext } from "../src/server/session";

const TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG ?? "piloto";
const PDF_DIR = process.env.IMPORT_PDF_DIR ?? path.resolve("assets-input/pdfs");

async function main() {
  if (!existsSync(PDF_DIR)) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "no hay carpeta de PDFs",
        dir: PDF_DIR,
        hint: "Coloca los archivos en assets-input/pdfs (o define IMPORT_PDF_DIR).",
      }),
    );
    process.exit(1);
  }

  const db = await createDb({ migrate: true });
  (globalThis as unknown as { __db?: Promise<typeof db> }).__db = Promise.resolve(db);

  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, TENANT_SLUG)).limit(1);
  if (!tenant) {
    console.error(JSON.stringify({ level: "error", msg: "tenant piloto no existe", slug: TENANT_SLUG, hint: "Ejecuta npm run db:seed" }));
    process.exit(1);
  }

  const [owner] = await db
    .select({ userId: memberships.userId, role: memberships.role, name: user.name })
    .from(memberships)
    .innerJoin(user, eq(user.id, memberships.userId))
    .where(and(eq(memberships.tenantId, tenant.id), eq(memberships.role, "owner")))
    .limit(1);
  if (!owner) {
    console.error(JSON.stringify({ level: "error", msg: "el tenant no tiene dueño", slug: TENANT_SLUG, hint: "Ejecuta npm run db:seed" }));
    process.exit(1);
  }

  const [agent] = await db
    .select({ id: agentProfiles.id })
    .from(agentProfiles)
    .where(and(eq(agentProfiles.tenantId, tenant.id), eq(agentProfiles.userId, owner.userId)))
    .limit(1);

  const m: MemberContext = {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    userId: owner.userId,
    userName: owner.name,
    role: owner.role,
    agentId: agent?.id ?? null,
  };

  const names = (await readdir(PDF_DIR)).sort();
  const pdfs = names.filter((n) => n.toLowerCase().endsWith(".pdf"));
  const skipped = names.filter((n) => !n.toLowerCase().endsWith(".pdf") && n !== ".DS_Store");
  for (const name of skipped) {
    console.log(JSON.stringify({ level: "info", msg: "archivo omitido (no es PDF)", fileName: name }));
  }

  let failed = 0;
  for (const fileName of pdfs) {
    const data = await readFile(path.join(PDF_DIR, fileName));
    try {
      const result = await importPdf(m, fileName, data);
      console.log(JSON.stringify({ level: "info", msg: "import", fileName, ...result }));
    } catch (err) {
      failed += 1;
      console.error(
        JSON.stringify({
          level: "error",
          msg: "import failed",
          fileName,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  console.log(JSON.stringify({ level: "info", msg: "import:pdfs complete", tenant: TENANT_SLUG, pdfs: pdfs.length, failed }));
  if (failed) process.exit(1);
}

await main();
