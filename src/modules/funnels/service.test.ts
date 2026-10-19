import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { member, seedTenant, useTestDb } from "../../../test/db";
import type { Db } from "@/server/db/create";
import { availabilityRules, deals, jobs, user } from "@/server/db/schema";
import * as f from "./service";

// Sunday 2026-10-18 12:00 UTC; Monday 09:00 Guayaquil = 14:00 UTC.
const NOW = new Date("2026-10-18T12:00:00Z");
const MON_9 = new Date("2026-10-19T14:00:00Z");

const good = {
  answers: { objetivo: "vivir", presupuesto: "150-300", pago: "contado", plazo: "1m" },
  name: "Ana Pérez",
  email: "ana@correo.ec",
  phone: "0991234567",
  consent: true as const,
  utm: { utm_source: "facebook", utm_campaign: "compradores-quito" },
  fbclid: "abc",
};

describe("funnel → booking", () => {
  let db: Db;
  let A: Awaited<ReturnType<typeof seedTenant>>;
  let B: Awaited<ReturnType<typeof seedTenant>>;
  let funnelId: string;

  beforeAll(async () => {
    db = await useTestDb();
    A = await seedTenant(db, "a");
    B = await seedTenant(db, "b");
    const m = member(A.tenant.id, { agentId: A.agent.id });
    await db.insert(user).values({ id: m.userId, name: "A", email: "a@t.dev" });
    const funnel = await f.createFunnelFromTemplate(m, "real_estate_buyer", "comprador");
    await f.setFunnelStatus(m, funnel.id, "active");
    funnelId = funnel.id;
    await db.insert(availabilityRules).values({ tenantId: A.tenant.id, agentId: A.agent.id, weekday: 1, startMinute: 540, endMinute: 720 });
  });

  it("qualified visitor books, gets reminders and moves to 'booked'", async () => {
    const out = await f.submitFunnel(A.tenant.id, funnelId, f.submissionSchema.parse(good));
    expect(out.qualified).toBe(true);
    if (!out.qualified) return;
    const { slots } = await f.availableSlots(A.tenant.id, funnelId, { now: NOW });
    expect(slots[0]).toEqual(MON_9);
    const { booking, manageToken } = await f.bookSlot(A.tenant.id, { submissionId: out.submissionId, pass: out.pass, startsAt: MON_9, now: NOW });
    expect(booking.status).toBe("confirmed");
    const [deal] = await db.select().from(deals).where(eq(deals.id, booking.dealId!));
    expect(deal!.stage).toBe("booked");
    const queued = await db.select().from(jobs).where(eq(jobs.tenantId, A.tenant.id));
    const types = queued.map((j) => `${j.type}:${(j.payload as { template?: string }).template ?? (j.payload as { eventName?: string }).eventName ?? ""}`);
    expect(types).toEqual(
      expect.arrayContaining([
        "message.send:booking_confirmation",
        "message.send:booking_reminder_24h",
        "message.send:booking_reminder_1h",
        "meta.capi:Lead",
        "meta.capi:Schedule",
        "calendar.sync:",
      ]),
    );
    // Slot is gone for the next visitor.
    expect((await f.availableSlots(A.tenant.id, funnelId, { now: NOW })).slots[0]).not.toEqual(MON_9);
    // Cancelling via the signed link frees the slot and cancels reminders.
    await f.cancelBookingByToken(A.tenant.id, manageToken);
    expect((await f.availableSlots(A.tenant.id, funnelId, { now: NOW })).slots[0]).toEqual(MON_9);
    const reminders = await db.select().from(jobs).where(and(eq(jobs.tenantId, A.tenant.id), eq(jobs.status, "cancelled")));
    expect(reminders.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects double booking of the same slot", async () => {
    const one = await f.submitFunnel(A.tenant.id, funnelId, f.submissionSchema.parse({ ...good, email: "uno@x.ec", phone: "0990000001" }));
    const two = await f.submitFunnel(A.tenant.id, funnelId, f.submissionSchema.parse({ ...good, email: "dos@x.ec", phone: "0990000002" }));
    if (!one.qualified || !two.qualified) throw new Error("expected qualified");
    const results = await Promise.allSettled([
      f.bookSlot(A.tenant.id, { submissionId: one.submissionId, pass: one.pass, startsAt: MON_9, now: NOW }),
      f.bookSlot(A.tenant.id, { submissionId: two.submissionId, pass: two.pass, startsAt: MON_9, now: NOW }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("unqualified visitor never sees the calendar and enters nurturing", async () => {
    const out = await f.submitFunnel(A.tenant.id, funnelId, f.submissionSchema.parse({ ...good, email: "explora@x.ec", phone: "0990000003", answers: { ...good.answers, plazo: "explorando" } }));
    expect(out.qualified).toBe(false);
    await expect(f.bookSlot(A.tenant.id, { submissionId: out.submissionId, pass: f.bookingPass(out.submissionId), startsAt: MON_9, now: NOW })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects forged passes, off-grid times and other tenants", async () => {
    const out = await f.submitFunnel(A.tenant.id, funnelId, f.submissionSchema.parse({ ...good, email: "cuatro@x.ec", phone: "0990000004" }));
    if (!out.qualified) throw new Error("expected qualified");
    await expect(f.bookSlot(A.tenant.id, { submissionId: out.submissionId, pass: "forged", startsAt: MON_9, now: NOW })).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      f.bookSlot(A.tenant.id, { submissionId: out.submissionId, pass: out.pass, startsAt: new Date("2026-10-19T14:07:00Z"), now: NOW }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(f.bookSlot(B.tenant.id, { submissionId: out.submissionId, pass: out.pass, startsAt: MON_9, now: NOW })).rejects.toMatchObject({ code: "forbidden" });
  });
});
