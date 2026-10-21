import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { member, seedTenant, useTestDb } from "../../../test/db";
import type { Db } from "@/server/db/create";
import { agentProfiles, availabilityRules, bookings, contacts, deals, funnels, funnelSubmissions, jobs, user } from "@/server/db/schema";
import * as admin from "./admin";

const profile = (displayName: string) => ({
  displayName,
  headline: "",
  bio: "",
  whatsapp: "",
  phone: "",
  email: "",
  city: "",
  affiliation: "",
  socials: Object.fromEntries(admin.SOCIAL_KEYS.map((k) => [k, ""])),
});

/** Horizontal access on the panel's profile, site and read models. */
describe("agents admin: tenant isolation and roles", () => {
  let db: Db;
  let A: Awaited<ReturnType<typeof seedTenant>>;
  let B: Awaited<ReturnType<typeof seedTenant>>;
  let mA: ReturnType<typeof member>;
  let mB: ReturnType<typeof member>;
  let dealB: string;
  let funnelB: string;

  beforeAll(async () => {
    db = await useTestDb();
    A = await seedTenant(db, "adm-a");
    B = await seedTenant(db, "adm-b");
    mA = member(A.tenant.id, { agentId: A.agent.id });
    mB = member(B.tenant.id, { agentId: B.agent.id });
    await db.insert(user).values([
      { id: mA.userId, name: "A", email: "adm-a@test.dev" },
      { id: mB.userId, name: "B", email: "adm-b@test.dev" },
    ]);

    // Tenant B has funnel activity, availability, a blocked job and a deal with answers.
    const [f] = await db.insert(funnels).values({ tenantId: B.tenant.id, agentId: B.agent.id, slug: "b", name: "Embudo B", vertical: "real_estate", headline: "h" }).returning();
    funnelB = f!.id;
    await db.insert(availabilityRules).values({ tenantId: B.tenant.id, agentId: B.agent.id, weekday: 2, startMinute: 600, endMinute: 660 });
    const [c] = await db.insert(contacts).values({ tenantId: B.tenant.id, name: "Cliente B", email: "cliente-b@correo.ec", source: "funnel" }).returning();
    const [d] = await db.insert(deals).values({ tenantId: B.tenant.id, contactId: c!.id, funnelId: funnelB, source: "funnel" }).returning();
    dealB = d!.id;
    await db.insert(funnelSubmissions).values({ tenantId: B.tenant.id, funnelId: funnelB, dealId: dealB, contactId: c!.id, answers: { a: "x" }, score: 5, qualified: true });
    await db.insert(bookings).values({
      tenantId: B.tenant.id,
      funnelId: funnelB,
      agentId: B.agent.id,
      contactId: c!.id,
      startsAt: new Date("2030-01-01T15:00:00Z"),
      endsAt: new Date("2030-01-01T15:30:00Z"),
      meetingKind: "video",
      manageTokenHash: "hash-b",
    });
    await db.insert(jobs).values({ tenantId: B.tenant.id, type: "whatsapp.send", status: "blocked", lastError: "no conectado", idempotencyKey: "b-1" });
  });

  it("read models never return another tenant's data", async () => {
    expect(await admin.getAvailability(mA, B.agent.id)).toEqual([]);
    expect(await admin.getAvailability(mB, B.agent.id)).toHaveLength(1);
    await expect(admin.funnelHasAvailability(mA, funnelB)).rejects.toMatchObject({ code: "not_found" });
    expect(await admin.funnelMetrics(mA)).toEqual({});
    expect(Object.keys(await admin.funnelMetrics(mB))).toEqual([funnelB]);
    expect(await admin.blockedJobCounts(mA)).toEqual([]);
    expect(await admin.blockedJobCounts(mB)).toEqual([{ type: "whatsapp.send", n: 1, lastError: "no conectado" }]);
    expect(await admin.dealSubmission(mA, dealB)).toBeNull();
    expect((await admin.dealSubmission(mB, dealB))?.funnelName).toBe("Embudo B");
  });

  it("site settings read and write only the member's tenant", async () => {
    expect((await admin.getSite(mA)).name).toBe("Tenant adm-a");
    await admin.updateSite({ ...mA, role: "admin" }, { name: "Sitio de A", tagline: "" });
    expect((await admin.getSite(mB)).name).toBe("Tenant adm-b");
    await expect(admin.updateSite({ ...mA, role: "agent" }, { name: "Hack", tagline: "" })).rejects.toMatchObject({ code: "forbidden" });
    expect((await admin.getSite(mA)).name).toBe("Sitio de A");
  });

  it("a member never edits a profile of another tenant, even with a foreign agentId in context", async () => {
    // A forged context (agentId of tenant B) falls back to tenant A's own primary profile.
    const forged = { ...mA, agentId: B.agent.id };
    const p = await admin.updateProfile(forged, profile("Perfil de A"));
    expect(p.id).toBe(A.agent.id);
    expect(p.tenantId).toBe(A.tenant.id);
    const [b] = await db.select().from(agentProfiles).where(eq(agentProfiles.id, B.agent.id));
    expect(b?.displayName).toBe("Agente adm-b");
    expect((await admin.getMyProfile(forged))?.id).toBe(A.agent.id);
  });

  it("an agent without a profile cannot edit the tenant's primary profile", async () => {
    const agent = member(A.tenant.id, { role: "agent", userId: "agente-sin-perfil", agentId: null });
    expect(await admin.getMyProfile(agent)).toBeNull();
    await expect(admin.updateProfile(agent, profile("Intruso"))).rejects.toMatchObject({ code: "not_found" });
    await expect(admin.setProfilePhoto(agent, Buffer.from("x"))).rejects.toMatchObject({ code: "not_found" });
    const [primary] = await db.select().from(agentProfiles).where(eq(agentProfiles.id, A.agent.id));
    expect(primary?.displayName).not.toBe("Intruso");
  });

  it("an agent with a profile edits only their own, not the primary one", async () => {
    const [own] = await db.insert(agentProfiles).values({ tenantId: A.tenant.id, slug: "propio", displayName: "Propio" }).returning();
    const agent = member(A.tenant.id, { role: "agent", userId: "agente-propio", agentId: own!.id });
    const p = await admin.updateProfile(agent, profile("Agente Propio"));
    expect(p.id).toBe(own!.id);
    const [primary] = await db.select().from(agentProfiles).where(eq(agentProfiles.id, A.agent.id));
    expect(primary?.displayName).toBe("Perfil de A");
  });

  it("profile photo: rejects unreadable files and stores under the member's tenant", async () => {
    await expect(admin.setProfilePhoto(mA, Buffer.from("no soy una imagen"))).rejects.toMatchObject({ code: "invalid" });
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
    await expect(admin.setProfilePhoto(mA, svg)).rejects.toMatchObject({ code: "invalid" });
    const jpeg = await sharp({ create: { width: 400, height: 500, channels: 3, background: "#998877" } }).jpeg().toBuffer();
    const url = await admin.setProfilePhoto(mA, jpeg);
    expect(url).toMatch(new RegExp(`^media:/media/tenants/${A.tenant.id}/agents/${A.agent.id}/photo-[0-9a-f-]{36}$`));
    const [b] = await db.select().from(agentProfiles).where(eq(agentProfiles.id, B.agent.id));
    expect(b?.photoUrl).toBeNull();
  });
});
