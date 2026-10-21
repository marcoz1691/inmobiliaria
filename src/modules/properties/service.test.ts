import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { member, seedTenant, useTestDb } from "../../../test/db";
import type { Db } from "@/server/db/create";
import { user } from "@/server/db/schema";
import * as svc from "./service";

const jpeg = () => sharp({ create: { width: 1200, height: 800, channels: 3, background: "#7a8c99" } }).jpeg().toBuffer();

describe("properties service", () => {
  let db: Db;
  let A: Awaited<ReturnType<typeof seedTenant>>;
  let B: Awaited<ReturnType<typeof seedTenant>>;
  let mA: ReturnType<typeof member>;
  let mB: ReturnType<typeof member>;

  beforeAll(async () => {
    db = await useTestDb();
    A = await seedTenant(db, "a");
    B = await seedTenant(db, "b");
    mA = member(A.tenant.id, { agentId: A.agent.id });
    mB = member(B.tenant.id, { agentId: B.agent.id });
    await db.insert(user).values([
      { id: mA.userId, name: "A", email: "a@test.dev" },
      { id: mB.userId, name: "B", email: "b@test.dev" },
    ]);
  });

  it("creates, autosaves and publishes only when complete", async () => {
    const p = await svc.createDraft(mA, "Casa en Cumbayá");
    await expect(svc.changeStatus(mA, p.id, "published")).rejects.toMatchObject({ code: "invalid" });
    await svc.updateDraft(mA, p.id, { operation: "sale", propertyType: "house", price: 185000, city: "Quito", bedrooms: 3 });
    await expect(svc.changeStatus(mA, p.id, "published")).rejects.toMatchObject({ details: { problems: ["Sube al menos una foto."] } });
    await svc.addPhoto(mA, p.id, await jpeg());
    const published = await svc.changeStatus(mA, p.id, "published");
    expect(published.status).toBe("published");
    expect(published.publishedAt).toBeInstanceOf(Date);

    const catalog = await svc.listCatalog(A.tenant.id, { q: "cumbay" });
    expect(catalog.items.map((i) => i.slug)).toContain(p.slug);
    expect(catalog.items[0]?.cover?.src).toMatch(/^media:/);
  });

  it("blocks horizontal access across tenants", async () => {
    const p = await svc.createDraft(mA, "Privada de A");
    await expect(svc.getForEdit(mB, p.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(svc.updateDraft(mB, p.id, { title: "hack" })).rejects.toMatchObject({ code: "not_found" });
    await expect(svc.changeStatus(mB, p.id, "archived")).rejects.toMatchObject({ code: "not_found" });
    await expect(svc.addPhoto(mB, p.id, await jpeg())).rejects.toMatchObject({ code: "not_found" });
    await expect(svc.deleteDraft(mB, p.id)).rejects.toMatchObject({ code: "not_found" });
    expect((await svc.listForPanel(mB)).some((x) => x.id === p.id)).toBe(false);
    expect((await svc.getPublicProperty(B.tenant.id, p.slug)).kind).toBe("missing");
  });

  it("forbids an agent from editing a colleague's listing", async () => {
    const p = await svc.createDraft(mA, "Del dueño");
    const colleague = member(A.tenant.id, { role: "agent", userId: "colleague", agentId: null });
    await expect(svc.updateDraft(colleague, p.id, { title: "otro" })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("does not let an appraisal price be published", async () => {
    // Appraisals only enter through an import; the panel cannot set one.
    const values = { operation: "sale", propertyType: "land", city: "Loja", price: 50000, priceKind: "appraisal" } as const;
    const p = await svc.createImportedDraft(mA, { title: "Terreno del banco", values, fieldConfidence: {}, reviewNotes: null, sourceImportId: crypto.randomUUID() });
    await svc.markReviewed(mA, p.id);
    await svc.addPhoto(mA, p.id, await jpeg());
    await expect(svc.changeStatus(mA, p.id, "published")).rejects.toMatchObject({ code: "invalid" });
    await svc.updateDraft(mA, p.id, { price: 55000 });
    expect((await svc.changeStatus(mA, p.id, "published")).priceKind).toBe("sale");
  });

  it("hides exact address and coordinates unless allowed", async () => {
    const p = await svc.createDraft(mA, "Casa con ubicación");
    const row = await svc.updateDraft(mA, p.id, { address: "Calle Secreta 123", lat: -0.070852, lng: -78.479659 });
    const pub = svc.toPublic(row, []);
    expect(pub.address).toBeNull();
    expect(pub.map).toEqual({ lat: -0.07, lng: -78.48, radiusMeters: 800 });
    expect(JSON.stringify(pub)).not.toContain("Calle Secreta");
    expect(svc.toPublic({ ...row, locationPrivacy: "hidden" }, []).map).toBeNull();
  });

  it("reorders photos, moves the cover and archives to 410", async () => {
    const p = await svc.createDraft(mA, "Departamento con fotos");
    const a = await svc.addPhoto(mA, p.id, await jpeg());
    const b = await svc.addPhoto(mA, p.id, await jpeg());
    expect(a.isCover).toBe(true);
    await svc.reorderPhotos(mA, p.id, [b.id, a.id]);
    await svc.setCover(mA, p.id, b.id);
    const { media } = await svc.getForEdit(mA, p.id);
    expect(media.map((x) => x.id)).toEqual([b.id, a.id]);
    await svc.removePhoto(mA, p.id, b.id);
    expect((await svc.getForEdit(mA, p.id)).media[0]).toMatchObject({ id: a.id, isCover: true });

    await svc.updateDraft(mA, p.id, { operation: "rent", propertyType: "apartment", price: 900, city: "Quito" });
    await svc.changeStatus(mA, p.id, "published");
    await svc.changeStatus(mA, p.id, "archived");
    expect((await svc.getPublicProperty(A.tenant.id, p.slug)).kind).toBe("gone");
  });

  it("duplicates as a draft sharing photos", async () => {
    const p = await svc.createDraft(mA, "Original");
    await svc.addPhoto(mA, p.id, await jpeg());
    const copy = await svc.duplicate(mA, p.id);
    expect(copy.status).toBe("draft");
    expect(copy.slug).not.toBe(p.slug);
    expect((await svc.getForEdit(mA, copy.id)).media).toHaveLength(1);
  });
});
