import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { member, seedTenant, useTestDb } from "../../../test/db";
import { user } from "@/server/db/schema";
import * as props from "@/modules/properties/service";
import { effectivePlan, PLANS } from "./plans";
import { planUsage, setPlan } from "./service";

const jpeg = () => sharp({ create: { width: 1200, height: 800, channels: 3, background: "#7a8c99" } }).jpeg().toBuffer();

describe("effectivePlan", () => {
  it("falls back to Gratis for unknown or expired plans", () => {
    const now = new Date("2026-11-16T12:00:00Z");
    expect(effectivePlan("pro", null, now).id).toBe("pro");
    expect(effectivePlan("pro", new Date("2026-12-01"), now).id).toBe("pro");
    expect(effectivePlan("pro", new Date("2026-11-01"), now).id).toBe("free");
    expect(effectivePlan("platino", null, now).id).toBe("free");
    expect(effectivePlan(null, null, now).id).toBe("free");
  });

  it("keeps every paid plan above the free one", () => {
    for (const p of [PLANS.agente, PLANS.pro, PLANS.inmobiliaria]) {
      expect(p.maxListings).toBeGreaterThan(PLANS.free.maxListings);
      expect(p.aiImportsPerMonth).toBeGreaterThan(PLANS.free.aiImportsPerMonth);
    }
  });
});

describe("plan limits", () => {
  let m: ReturnType<typeof member>;

  const ready = async (title: string) => {
    const p = await props.createDraft(m, title);
    await props.updateDraft(m, p.id, { operation: "sale", propertyType: "house", price: 90000, city: "Quito" });
    await props.addPhoto(m, p.id, await jpeg());
    return p;
  };

  beforeAll(async () => {
    const db = await useTestDb();
    const t = await seedTenant(db, "plan-free", "free");
    m = member(t.tenant.id, { agentId: t.agent.id, userId: "u-plan", tenantSlug: "plan-free" });
    await db.insert(user).values({ id: "u-plan", name: "Plan", email: "plan@test.dev" });
  });

  it("Gratis publishes one listing; the second one asks to upgrade", async () => {
    const first = await ready("Primera casa del plan gratis");
    const second = await ready("Segunda casa del plan gratis");
    await props.changeStatus(m, first.id, "published");
    await expect(props.changeStatus(m, second.id, "published")).rejects.toMatchObject({ code: "forbidden", details: { upgrade: true } });
    // Reserving the live one does not take a new slot.
    await expect(props.changeStatus(m, first.id, "reserved")).resolves.toMatchObject({ status: "reserved" });
    await expect(props.updateDraft(m, first.id, { featured: true })).rejects.toMatchObject({ code: "forbidden" });
    expect(await planUsage(m)).toMatchObject({ plan: { id: "free" }, live: 1, featured: 0 });
  });

  it("a paid plan lifts the limits, and an expired one blocks new publishing again", async () => {
    await setPlan("plan-free", "agente", 1);
    const third = await ready("Tercera casa ya con plan agente");
    await expect(props.changeStatus(m, third.id, "published")).resolves.toMatchObject({ status: "published" });
    await expect(props.updateDraft(m, third.id, { featured: true })).resolves.toMatchObject({ featured: true });
    const fourth = await ready("Cuarta casa destacada de más");
    await expect(props.updateDraft(m, fourth.id, { featured: true })).rejects.toMatchObject({ code: "forbidden" });

    await setPlan("plan-free", "agente", -1); // already expired
    await expect(props.changeStatus(m, fourth.id, "published")).rejects.toMatchObject({ code: "forbidden" });
    const usage = await planUsage(m);
    expect(usage.plan).toMatchObject({ id: "free", chosen: "agente" });
    expect(usage.live).toBe(2); // nothing was unpublished
  });

  it("rejects unknown workspaces and plans", async () => {
    await expect(setPlan("no-existe", "pro", 1)).rejects.toMatchObject({ code: "not_found" });
    // @ts-expect-error invalid on purpose
    await expect(setPlan("plan-free", "platino", 1)).rejects.toMatchObject({ code: "invalid" });
  });
});
