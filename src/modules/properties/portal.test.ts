import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { sql } from "drizzle-orm";
import { member, seedTenant, useTestDb } from "../../../test/db";
import type { Db } from "@/server/db/create";
import { withPortal } from "@/server/db/tenant-tx";
import { properties, user } from "@/server/db/schema";
import { getListingAgent, getPortalAgent, listPortalAgents } from "@/modules/agents/portal";
import * as svc from "./service";

const jpeg = () => sharp({ create: { width: 1200, height: 800, channels: 3, background: "#7a8c99" } }).jpeg().toBuffer();

describe("portal: one catalog across tenants", () => {
  let db: Db;
  let A: Awaited<ReturnType<typeof seedTenant>>;
  let B: Awaited<ReturnType<typeof seedTenant>>;
  let aPublished: svc.PropertyRow;
  let bPublished: svc.PropertyRow;
  let aDraft: svc.PropertyRow;

  const publish = async (m: ReturnType<typeof member>, title: string, data: Record<string, unknown>) => {
    const p = await svc.createDraft(m, title);
    await svc.updateDraft(m, p.id, { operation: "sale", propertyType: "house", price: 100000, ...data });
    await svc.addPhoto(m, p.id, await jpeg());
    return svc.changeStatus(m, p.id, "published");
  };

  beforeAll(async () => {
    db = await useTestDb();
    A = await seedTenant(db, "pa");
    B = await seedTenant(db, "pb");
    const mA = member(A.tenant.id, { agentId: A.agent.id, userId: "u-pa" });
    const mB = member(B.tenant.id, { agentId: B.agent.id, userId: "u-pb" });
    await db.insert(user).values([
      { id: "u-pa", name: "A", email: "pa@test.dev" },
      { id: "u-pb", name: "B", email: "pb@test.dev" },
    ]);
    // Same title in both tenants: slugs must still be unique across the portal.
    aPublished = await publish(mA, "Casa con jardín", { city: "Sangolquí" });
    bPublished = await publish(mB, "Casa con jardín", { city: "Guayaquil", province: "Guayas" });
    aDraft = await svc.createDraft(mA, "Borrador privado de A");
    await svc.updateDraft(mA, aDraft.id, { city: "Quito", operation: "sale", propertyType: "house" });
    await db.update(properties).set({ reviewNotes: "nota interna" }).where(sql`${properties.id} = ${aPublished.id}`);
  });

  it("gives every listing a slug unique across tenants", () => {
    expect(aPublished.slug).toBe("casa-con-jardin");
    expect(bPublished.slug).toBe("casa-con-jardin-2");
  });

  it("lists public listings of every tenant and never drafts", async () => {
    const all = await svc.listCatalog(svc.PORTAL, {});
    const slugs = all.items.map((i) => i.slug);
    expect(slugs).toEqual(expect.arrayContaining([aPublished.slug, bPublished.slug]));
    expect(slugs).not.toContain(aDraft.slug);
    expect((await svc.getPublicProperty(svc.PORTAL, aDraft.slug)).kind).toBe("missing");
    expect((await svc.getPublicProperty(svc.PORTAL, bPublished.slug)).kind).toBe("ok");
    expect((await svc.listPublicSlugs(svc.PORTAL)).map((r) => r.slug)).not.toContain(aDraft.slug);
  });

  it("filters by canton and province, matching how agents typed the city", async () => {
    const rumi = await svc.listCatalog(svc.PORTAL, { city: "ruminahui" });
    expect(rumi.items.map((i) => i.slug)).toEqual([aPublished.slug]);
    const pichincha = await svc.listCatalog(svc.PORTAL, { province: "pichincha" });
    expect(pichincha.items.map((i) => i.slug)).toEqual([aPublished.slug]);
    const guayas = await svc.listCatalog(svc.PORTAL, { province: "guayas", city: "guayaquil" });
    expect(guayas.items.map((i) => i.slug)).toEqual([bPublished.slug]);
    expect((await svc.listCatalog(svc.PORTAL, { province: "galapagos" })).total).toBe(0);
  });

  it("the portal role cannot read private columns, drafts or write anything", async () => {
    await expect(withPortal(db, (tx) => tx.execute(sql`select review_notes from properties`))).rejects.toThrow();
    await expect(withPortal(db, (tx) => tx.execute(sql`select user_id from agent_profiles`))).rejects.toThrow();
    await expect(withPortal(db, (tx) => tx.execute(sql`select * from contacts`))).rejects.toThrow();
    const rows = await withPortal(db, (tx) => tx.select({ id: properties.id }).from(properties));
    expect(rows.map((r) => r.id)).not.toContain(aDraft.id);
    await expect(withPortal(db, (tx) => tx.update(properties).set({ title: "hack" }).where(sql`true`))).rejects.toThrow();
  });

  it("tells which tenant owns a public listing, and nothing for drafts", async () => {
    expect(await svc.publicListingOwner(bPublished.id)).toMatchObject({ tenantId: B.tenant.id });
    expect(await svc.publicListingOwner(aDraft.id)).toBeNull();
    expect(await svc.publicListingOwner("not-a-uuid")).toBeNull();
  });

  it("shows agents with live listings and who answers for each listing", async () => {
    const agents = await listPortalAgents();
    expect(agents.map((a) => a.tenantSlug).sort()).toEqual(["pa", "pb"]);
    expect(await getPortalAgent("pb")).toMatchObject({ displayName: "Agente pb", listings: 1, tenantId: B.tenant.id });
    expect(await getPortalAgent("../pb")).toBeNull();
    expect(await getListingAgent(A.tenant.id, null)).toMatchObject({ displayName: "Agente pa", tenantSlug: "pa" });
  });
});
