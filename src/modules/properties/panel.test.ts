import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { member, seedTenant, useTestDb } from "../../../test/db";
import { user } from "@/server/db/schema";
import * as svc from "./service";

const jpeg = () => sharp({ create: { width: 800, height: 600, channels: 3, background: "#556677" } }).jpeg().toBuffer();

describe("properties: panel additions", () => {
  let mA: ReturnType<typeof member>;
  let mB: ReturnType<typeof member>;

  beforeAll(async () => {
    const db = await useTestDb();
    const A = await seedTenant(db, "pa");
    const B = await seedTenant(db, "pb");
    mA = member(A.tenant.id, { agentId: A.agent.id });
    mB = member(B.tenant.id, { agentId: B.agent.id });
    await db.insert(user).values([
      { id: mA.userId, name: "A", email: "pa@test.dev" },
      { id: mB.userId, name: "B", email: "pb@test.dev" },
    ]);
  });

  it("lists photo count and cover per property", async () => {
    const p = await svc.createDraft(mA, "Con fotos");
    await svc.addPhoto(mA, p.id, await jpeg());
    await svc.addPhoto(mA, p.id, await jpeg());
    const row = (await svc.listForPanel(mA)).find((r) => r.id === p.id)!;
    expect(row.photoCount).toBe(2);
    expect(row.coverSrc).toMatch(/^media:/);
  });

  it("edits alt text only inside the tenant", async () => {
    const p = await svc.createDraft(mA, "Alt");
    const photo = await svc.addPhoto(mA, p.id, await jpeg());
    await svc.updatePhotoAlt(mA, p.id, photo.id, "  Sala con ventanal  ");
    expect((await svc.getForEdit(mA, p.id)).media[0]?.alt).toBe("Sala con ventanal");
    await expect(svc.updatePhotoAlt(mB, p.id, photo.id, "x")).rejects.toMatchObject({ code: "not_found" });
  });

  it("imported drafts need review and keep an appraisal unpublishable", async () => {
    const p = await svc.createImportedDraft(mA, {
      title: "Casa importada en Pomasqui",
      values: { operation: "sale", propertyType: "house", price: 90000, priceKind: "appraisal", city: "Quito" },
      fieldConfidence: { price: "low" },
      reviewNotes: "• aviso",
      sourceImportId: crypto.randomUUID(),
    });
    expect(p.needsReview).toBe(true);
    await svc.addPhoto(mA, p.id, await jpeg());
    await expect(svc.changeStatus(mA, p.id, "published")).rejects.toMatchObject({ code: "invalid" });
    await svc.markReviewed(mA, p.id);
    await expect(svc.changeStatus(mA, p.id, "published")).rejects.toMatchObject({
      details: { problems: ["El precio importado es un avalúo: confirma el precio de venta o alquiler."] },
    });
    await svc.updateDraft(mA, p.id, { price: 95000 });
    expect((await svc.changeStatus(mA, p.id, "published")).status).toBe("published");
    expect((await svc.listByImport(mA, p.sourceImportId!)).map((x) => x.id)).toEqual([p.id]);
  });
});
