import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { member, seedTenant, useTestDb } from "../../../test/db";
import type { Db } from "@/server/db/create";
import { auditLog, funnels, tenants, user } from "@/server/db/schema";
import { setWeeklyAvailability } from "@/modules/funnels/service";
import * as admin from "./admin";

describe("agents admin", () => {
  let db: Db;
  let A: Awaited<ReturnType<typeof seedTenant>>;
  let mA: ReturnType<typeof member>;
  let mB: ReturnType<typeof member>;

  beforeAll(async () => {
    db = await useTestDb();
    A = await seedTenant(db, "ag-a");
    const B = await seedTenant(db, "ag-b");
    mA = member(A.tenant.id, { agentId: A.agent.id });
    mB = member(B.tenant.id, { agentId: B.agent.id });
    await db.insert(user).values([
      { id: mA.userId, name: "A", email: "ag-a@test.dev" },
      { id: mB.userId, name: "B", email: "ag-b@test.dev" },
    ]);
  });

  const base = { displayName: "Ana Pérez", headline: "", bio: "", whatsapp: "", phone: "", email: "", city: "", affiliation: "", socials: Object.fromEntries(admin.SOCIAL_KEYS.map((k) => [k, ""])) };

  it("validates and saves the profile with an audit entry, empty values stay null", async () => {
    await expect(admin.updateProfile(mA, { ...base, email: "no-es-correo" })).rejects.toMatchObject({ code: "invalid", details: { issues: { email: ["Correo no válido"] } } });
    await expect(admin.updateProfile(mA, { ...base, socials: { ...base.socials, instagram: "instagram.com/x" } })).rejects.toMatchObject({ code: "invalid" });
    const p = await admin.updateProfile(mA, { ...base, whatsapp: "+593 99 123 4567", socials: { ...base.socials, instagram: "https://instagram.com/ana" } });
    expect(p.displayName).toBe("Ana Pérez");
    expect(p.headline).toBeNull();
    expect(p.socials).toEqual({ instagram: "https://instagram.com/ana" });
    expect(admin.missingProfileFields(p)).toEqual(["foto", "titular", "biografía", "correo"]);
    const log = await db.select().from(auditLog).where(eq(auditLog.entityId, A.agent.id));
    expect(log.some((l) => l.action === "agent.profile.update")).toBe(true);
    // Other tenant edits its own profile only.
    await admin.updateProfile(mB, { ...base, displayName: "Otro" });
    expect((await admin.getMyProfile(mA))?.displayName).toBe("Ana Pérez");
  });

  it("only owners/admins change the site name and tagline", async () => {
    await expect(admin.updateSite({ ...mA, role: "agent" }, { name: "X", tagline: "" })).rejects.toMatchObject({ code: "forbidden" });
    await admin.updateSite(mA, { name: "Ana Pérez Bienes Raíces", tagline: "Casas en Quito" });
    expect(await admin.getSite(mA)).toEqual({ name: "Ana Pérez Bienes Raíces", tagline: "Casas en Quito" });
    const [b] = await db.select().from(tenants).where(eq(tenants.id, mB.tenantId));
    expect(b?.name).toBe("Tenant ag-b");
  });

  it("knows whether a funnel's agent has weekly hours", async () => {
    const [f] = await db.insert(funnels).values({ tenantId: A.tenant.id, agentId: A.agent.id, slug: "comprador", name: "F", vertical: "real_estate", headline: "h" }).returning();
    expect(await admin.funnelHasAvailability(mA, f!.id)).toBe(false);
    await setWeeklyAvailability(mA, A.agent.id, [{ weekday: 1, startMinute: 540, endMinute: 720 }]);
    expect(await admin.funnelHasAvailability(mA, f!.id)).toBe(true);
    expect(await admin.getAvailability(mA, A.agent.id)).toEqual([{ weekday: 1, startMinute: 540, endMinute: 720 }]);
    await expect(admin.funnelHasAvailability(mB, f!.id)).rejects.toMatchObject({ code: "not_found" });
    expect(await admin.funnelMetrics(mA)).toEqual({});
    expect(await admin.blockedJobCounts(mA)).toEqual([]);
  });

  it("labels funnel answers with the option text", () => {
    const answers = admin.labelAnswers(
      [
        { id: "a", label: "¿Qué buscas?", type: "single", required: true, options: [{ value: "vivir", label: "Comprar para vivir", score: 2 }] },
        { id: "b", label: "Comentario", type: "text", required: false },
      ],
      { a: "vivir", b: "" },
    );
    expect(answers).toEqual([{ question: "¿Qué buscas?", answer: "Comprar para vivir" }]);
  });
});
