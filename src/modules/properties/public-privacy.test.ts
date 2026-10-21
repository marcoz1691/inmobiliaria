import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { member, seedTenant, useTestDb } from "../../../test/db";
import type { Db } from "@/server/db/create";
import { user } from "@/server/db/schema";
import * as svc from "./service";

const jpeg = () => sharp({ create: { width: 640, height: 480, channels: 3, background: "#8a7a6a" } }).jpeg().toBuffer();

const EXACT = { lat: -0.1916543, lng: -78.4823412, address: "Calle Los Cedros N45-12 y Av. Eloy Alfaro" };
const COORD_DIGITS = ["1916543", "4823412"];

/**
 * Invariants of every public read model (catalog, featured, ficha, related, sitemap):
 * no appraisal as price, no exact address/coordinates unless the agent chose "exact",
 * no private review data, nothing unpublished.
 */
describe("public projection privacy", () => {
  let db: Db;
  let tenantId: string;
  let m: ReturnType<typeof member>;

  async function published(title: string, data: Record<string, unknown>) {
    const p = await svc.createDraft(m, title);
    await svc.updateDraft(m, p.id, { operation: "sale", propertyType: "house", price: 150000, city: "Quito", ...EXACT, ...data });
    await svc.addPhoto(m, p.id, await jpeg());
    return svc.changeStatus(m, p.id, "published");
  }

  async function everyPublicView(slug: string) {
    const catalog = (await svc.listCatalog(tenantId, {})).items.filter((i) => i.slug === slug);
    const featured = (await svc.listFeatured(tenantId, 50)).filter((i) => i.slug === slug);
    const page = await svc.getPublicProperty(tenantId, slug);
    const ficha = page.kind === "ok" ? [page.listing] : [];
    const anyOther = (await svc.listCatalog(tenantId, {})).items.find((i) => i.slug !== slug);
    const related = anyOther ? (await svc.listRelated(tenantId, anyOther, 50)).filter((i) => i.slug === slug) : [];
    return [...catalog, ...featured, ...ficha, ...related];
  }

  beforeAll(async () => {
    db = await useTestDb();
    const { tenant, agent } = await seedTenant(db, "priv");
    tenantId = tenant.id;
    m = member(tenant.id, { agentId: agent.id });
    await db.insert(user).values({ id: m.userId, name: "Priv", email: "priv@test.dev" });
  });

  it("approximate location: no address and coordinates rounded to ~1 km in every view", async () => {
    const p = await published("Casa aproximada en Quito", { locationPrivacy: "approximate" });
    const views = await everyPublicView(p.slug);
    expect(views.length).toBeGreaterThanOrEqual(3);
    for (const v of views) {
      expect(v.address).toBeNull();
      expect(v.map).toEqual({ lat: -0.19, lng: -78.48, radiusMeters: 800 });
      const json = JSON.stringify(v);
      for (const d of COORD_DIGITS) expect(json).not.toContain(d);
      expect(json).not.toContain("Los Cedros");
      expect(v).not.toHaveProperty("lat");
      expect(v).not.toHaveProperty("lng");
    }
  });

  it("hidden location: no map and no address", async () => {
    const p = await published("Casa oculta en Quito", { locationPrivacy: "hidden" });
    for (const v of await everyPublicView(p.slug)) {
      expect(v.map).toBeNull();
      expect(v.address).toBeNull();
      const json = JSON.stringify(v);
      for (const d of COORD_DIGITS) expect(json).not.toContain(d);
    }
  });

  it("exact location is shown only when the agent chose it", async () => {
    const p = await published("Casa exacta en Quito", { locationPrivacy: "exact" });
    const [v] = await everyPublicView(p.slug);
    expect(v?.address).toBe(EXACT.address);
    expect(v?.map).toEqual({ lat: EXACT.lat, lng: EXACT.lng, radiusMeters: null });
  });

  it("strips import review data and internal ownership fields", async () => {
    const draft = await svc.createImportedDraft(m, {
      title: "Casa importada privada",
      values: { operation: "sale", propertyType: "house", price: 99000, priceKind: "sale", city: "Quito" },
      fieldConfidence: { price: "low" },
      reviewNotes: "• Se omitieron los linderos del PDF\n• Código catastral 1300107007001001007",
      sourceImportId: crypto.randomUUID(),
    });
    await svc.addPhoto(m, draft.id, await jpeg());
    await svc.markReviewed(m, draft.id);
    const p = await svc.changeStatus(m, draft.id, "published");
    for (const v of await everyPublicView(p.slug)) {
      for (const k of ["reviewNotes", "fieldConfidence", "sourceImportId", "createdBy", "needsReview"]) expect(v).not.toHaveProperty(k);
      const json = JSON.stringify(v);
      expect(json).not.toMatch(/linderos|catastral|1300107007001001007/i);
    }
  });

  it("an appraisal is never exposed as a price, even if a published listing is switched to it", async () => {
    const p = await published("Casa con precio real", { price: 210000 });
    // The autosave action forwards the client patch as-is: a crafted request must not turn the
    // public price into an internal bank appraisal.
    await expect(svc.updateDraft(m, p.id, { priceKind: "appraisal", price: 87000 })).rejects.toMatchObject({ code: "invalid" });
    for (const v of await everyPublicView(p.slug)) {
      expect(v.priceKind).not.toBe("appraisal");
      expect(v.price).toBe(210000);
    }
    // Defense in depth: whatever is stored, the projection drops an appraisal value.
    const row = (await svc.getForEdit(m, p.id)).property;
    const pub = svc.toPublic({ ...row, priceKind: "appraisal", price: 87000 }, []);
    expect(pub.price).toBeNull();
    expect(JSON.stringify(pub)).not.toContain("87000");
  });

  it("imported appraisal drafts can still be corrected to a real price", async () => {
    const d = await svc.createImportedDraft(m, {
      title: "Terreno del banco",
      values: { operation: "sale", propertyType: "land", price: 52290, priceKind: "appraisal", city: "Esmeraldas" },
      fieldConfidence: {},
      reviewNotes: null,
      sourceImportId: crypto.randomUUID(),
    });
    // Re-sending the current kind (wizard autosave) is not an attempt to set it.
    await expect(svc.updateDraft(m, d.id, { priceKind: "appraisal", title: "Terreno del banco en Esmeraldas" })).resolves.toMatchObject({ priceKind: "appraisal" });
    expect((await svc.updateDraft(m, d.id, { price: 60000 })).priceKind).toBe("sale");
  });

  it("drafts, paused and archived listings stay out of catalog, featured and sitemap", async () => {
    const draft = await svc.createDraft(m, "Borrador invisible");
    const paused = await published("Pausada invisible", {});
    await svc.changeStatus(m, paused.id, "paused");
    const archived = await published("Archivada invisible", {});
    await svc.changeStatus(m, archived.id, "archived");
    const sold = await published("Vendida visible por URL", {});
    await svc.changeStatus(m, sold.id, "sold");

    const catalog = (await svc.listCatalog(tenantId, {})).items.map((i) => i.slug);
    const featured = (await svc.listFeatured(tenantId, 50)).map((i) => i.slug);
    const sitemap = (await svc.listPublicSlugs(tenantId)).map((s) => s.slug);
    for (const hidden of [draft.slug, paused.slug, archived.slug]) {
      expect(catalog).not.toContain(hidden);
      expect(featured).not.toContain(hidden);
      expect(sitemap).not.toContain(hidden);
    }
    expect((await svc.getPublicProperty(tenantId, draft.slug)).kind).toBe("missing");
    expect((await svc.getPublicProperty(tenantId, paused.slug)).kind).toBe("missing");
    expect((await svc.getPublicProperty(tenantId, archived.slug)).kind).toBe("gone");
    // Sold listings keep their URL (and sitemap entry) but leave the catalog.
    expect(catalog).not.toContain(sold.slug);
    expect(sitemap).toContain(sold.slug);
    expect((await svc.getPublicProperty(tenantId, sold.slug)).kind).toBe("ok");
  });

  it("public reads are scoped to the tenant", async () => {
    const other = await seedTenant(db, "priv-otro");
    const p = await published("Casa solo del tenant priv", {});
    expect((await svc.listCatalog(other.tenant.id, {})).items).toEqual([]);
    expect(await svc.listFeatured(other.tenant.id)).toEqual([]);
    expect(await svc.listPublicSlugs(other.tenant.id)).toEqual([]);
    expect((await svc.getPublicProperty(other.tenant.id, p.slug)).kind).toBe("missing");
  });
});
