import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { member, seedTenant, useTestDb } from "../../../test/db";
import type { Db } from "@/server/db/create";
import { user } from "@/server/db/schema";
import * as properties from "@/modules/properties/service";
import { getImport, importPdf, readImportPdf } from "./service";

const POMASQUI = "assets-input/pdfs/Casa Pomasqui.pdf";

describe("imports service", () => {
  let db: Db;
  let mA: ReturnType<typeof member>;
  let mB: ReturnType<typeof member>;

  beforeAll(async () => {
    db = await useTestDb();
    const A = await seedTenant(db, "imp-a");
    const B = await seedTenant(db, "imp-b");
    mA = member(A.tenant.id, { agentId: A.agent.id });
    mB = member(B.tenant.id, { agentId: B.agent.id });
    await db.insert(user).values([
      { id: mA.userId, name: "A", email: "imp-a@test.dev" },
      { id: mB.userId, name: "B", email: "imp-b@test.dev" },
    ]);
  });

  it("rejects files that are not PDFs", async () => {
    await expect(importPdf(mA, "x.pdf", Buffer.from("hola"))).rejects.toMatchObject({ code: "invalid" });
  });

  it.skipIf(!existsSync(POMASQUI))("creates a reviewable draft with photos, dedupes by sha and isolates tenants", async () => {
    const data = await readFile(POMASQUI);
    const r = await importPdf(mA, "Casa Pomasqui.pdf", data);
    expect(r.kind).toBe("parsed");
    if (r.kind !== "parsed") return;
    expect(r.created).toBe(1);

    const view = await getImport(mA, r.importId);
    const draft = view.drafts[0]!;
    expect(draft.price).toBe(110000);
    expect(draft.needsReview).toBe(true);
    expect({ photos: view.listings[0]?.outcome?.photos, count: draft.photoCount }).toMatchObject({ count: view.listings[0]?.outcome?.photos });
    expect(draft.photoCount).toBeGreaterThan(0);
    expect(draft.photoCount).toBeLessThanOrEqual(12);
    expect(view.listings[0]?.outcome?.propertyId).toBe(draft.id);

    // Not publishable until the review is marked complete.
    await expect(properties.changeStatus(mA, draft.id, "published")).rejects.toMatchObject({ code: "invalid" });

    const again = await importPdf(mA, "copia.pdf", data);
    expect(again.kind).toBe("already_imported");

    await expect(getImport(mB, r.importId)).rejects.toMatchObject({ code: "not_found" });
    await expect(readImportPdf(mB, r.importId)).rejects.toMatchObject({ code: "not_found" });
    expect((await readImportPdf(mA, r.importId)).body.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
