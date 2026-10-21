import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { member, seedTenant, useTestDb } from "../../../test/db";
import { user } from "@/server/db/schema";
import * as svc from "./service";

const jpeg = () => sharp({ create: { width: 640, height: 480, channels: 3, background: "#5a6a7a" } }).jpeg().toBuffer();

describe("published listing completeness and search literals", () => {
  let tenantId: string;
  let m: ReturnType<typeof member>;

  beforeAll(async () => {
    const db = await useTestDb();
    const { tenant, agent } = await seedTenant(db, "inv");
    tenantId = tenant.id;
    m = member(tenant.id, { agentId: agent.id });
    await db.insert(user).values({ id: m.userId, name: "Inv", email: "inv@test.dev" });
  });

  async function published(title: string, extra: Record<string, unknown> = {}) {
    const p = await svc.createDraft(m, title);
    await svc.updateDraft(m, p.id, { operation: "sale", propertyType: "house", price: 120000, city: "Quito", ...extra });
    await svc.addPhoto(m, p.id, await jpeg());
    return svc.changeStatus(m, p.id, "published");
  }

  it("lets a draft drop its price and its only photo", async () => {
    const p = await svc.createDraft(m, "Borrador incompleto a propósito");
    await svc.updateDraft(m, p.id, { operation: "sale", propertyType: "house", price: 80000, city: "Loja" });
    const photo = await svc.addPhoto(m, p.id, await jpeg());
    await svc.updateDraft(m, p.id, { price: null });
    await svc.removePhoto(m, p.id, photo.id);
    const { property, media } = await svc.getForEdit(m, p.id);
    expect(property.status).toBe("draft");
    expect(property.price).toBeNull();
    expect(media).toHaveLength(0);
  });

  // QA-04: r4/product should reject these; today updateDraft/removePhoto do not re-check publishProblems.
  it.fails("rejects clearing the price of a published listing (QA-04)", async () => {
    const p = await published("Publicada sin borrar el precio");
    await expect(svc.updateDraft(m, p.id, { price: null })).rejects.toMatchObject({ code: "invalid" });
    const view = await svc.getPublicProperty(tenantId, p.slug);
    expect(view.kind).toBe("ok");
    if (view.kind === "ok") expect(view.listing.price).toBe(120000);
  });

  it.fails("rejects removing the last photo of a published listing (QA-04)", async () => {
    const p = await published("Publicada sin quedarse sin fotos");
    const { media } = await svc.getForEdit(m, p.id);
    expect(media).toHaveLength(1);
    await expect(svc.removePhoto(m, p.id, media[0]!.id)).rejects.toMatchObject({ code: "invalid" });
    const view = await svc.getPublicProperty(tenantId, p.slug);
    expect(view.kind).toBe("ok");
    if (view.kind === "ok") expect(view.listing.images).toHaveLength(1);
  });

  // QA-09: catalog and panel interpolate q into ILIKE without escaping % / _.
  it.fails("treats % and _ as literals in catalog and panel search (QA-09)", async () => {
    const percent = await published("Casa 50% en Tumbaco", { city: "Tumbaco" });
    const wildcard = await published("Casa 50X en Tumbaco", { city: "Tumbaco" });
    const underscore = await published("Depto A_B en Cumbayá", { city: "Cumbayá" });
    const anyChar = await published("Depto AXB en Cumbayá", { city: "Cumbayá" });

    const byPercent = (await svc.listCatalog(tenantId, { q: "50%" })).items.map((i) => i.id);
    expect(byPercent).toContain(percent.id);
    expect(byPercent).not.toContain(wildcard.id);

    const byUnderscore = (await svc.listCatalog(tenantId, { q: "A_B" })).items.map((i) => i.id);
    expect(byUnderscore).toContain(underscore.id);
    expect(byUnderscore).not.toContain(anyChar.id);

    const panelPercent = (await svc.listForPanel(m, { q: "50%" })).map((r) => r.id);
    expect(panelPercent).toContain(percent.id);
    expect(panelPercent).not.toContain(wildcard.id);

    const panelUnder = (await svc.listForPanel(m, { q: "A_B" })).map((r) => r.id);
    expect(panelUnder).toContain(underscore.id);
    expect(panelUnder).not.toContain(anyChar.id);
  });
});
