import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { member, seedTenant, useTestDb } from "../../../test/db";
import type { Db } from "@/server/db/create";
import { adEvents, availabilityRules, funnelSubmissions, jobs, user } from "@/server/db/schema";
import { handleMetaCapi } from "@/modules/integrations/capi";
import { mockFetch, testDeps } from "@/modules/integrations/testing";
import { runDueJobs } from "@/modules/jobs/runner";
import { CLIENT_DATA_TTL_MS, clientNetworkFromHeaders } from "./client-data";
import * as f from "./service";

const NOW = new Date("2026-10-18T12:00:00Z");
const MON_9 = new Date("2026-10-19T14:00:00Z");
const CAPI = { metaPixelId: "PIXEL1", metaCapiToken: "capi_test" };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)";

const visitor = (n: number) =>
  f.submissionSchema.parse({
    answers: { objetivo: "vivir", presupuesto: "150-300", pago: "contado", plazo: "1m" },
    name: "Ana Pérez",
    email: `ana${n}@correo.ec`,
    phone: `099000000${n}`,
    consent: true,
    utm: {},
  });

describe("client IP / user agent for the Conversions API", () => {
  it("reads the platform-set client address and drops invalid or loopback values", () => {
    const h = (o: Record<string, string>) => new Headers(o);
    expect(clientNetworkFromHeaders(h({ "x-vercel-forwarded-for": "190.12.1.1", "x-forwarded-for": "6.6.6.6", "user-agent": UA }))).toEqual({ ip: "190.12.1.1", userAgent: UA });
    expect(clientNetworkFromHeaders(h({ "x-forwarded-for": "2800:bf0::1, 10.0.0.1" }))).toEqual({ ip: "2800:bf0::1", userAgent: null });
    expect(clientNetworkFromHeaders(h({ "x-forwarded-for": "not-an-ip", "user-agent": "x".repeat(900) }))).toEqual({ ip: null, userAgent: "x".repeat(512) });
    expect(clientNetworkFromHeaders(h({ "x-real-ip": "127.0.0.1" }))).toBeNull();
    expect(clientNetworkFromHeaders(h({}))).toBeNull();
  });

  describe("lifecycle", () => {
    let db: Db;
    let tenantId: string;
    let funnelId: string;

    const submission = async (id: string) => (await db.select().from(funnelSubmissions).where(eq(funnelSubmissions.id, id)))[0]!;
    const capiJob = async (eventName: string, submissionId: string) => {
      const rows = await db.select().from(jobs).where(and(eq(jobs.tenantId, tenantId), eq(jobs.type, "meta.capi")));
      return rows.find((j) => (j.payload as { eventName: string; submissionId: string }).eventName === eventName && (j.payload as { submissionId: string }).submissionId === submissionId)!;
    };

    beforeAll(async () => {
      db = await useTestDb();
      const A = await seedTenant(db, "a");
      tenantId = A.tenant.id;
      const m = member(tenantId, { agentId: A.agent.id });
      await db.insert(user).values({ id: m.userId, name: "A", email: "a@t.dev" });
      const funnel = await f.createFunnelFromTemplate(m, "real_estate_buyer", "comprador");
      await f.setFunnelStatus(m, funnel.id, "active");
      funnelId = funnel.id;
      await db.insert(availabilityRules).values({ tenantId, agentId: A.agent.id, weekday: 1, startMinute: 540, endMinute: 720 });
    });

    it("is sent with each event, never stored in ad_events, and cleared once the last captured event is sent", async () => {
      const out = await f.submitFunnel(tenantId, funnelId, visitor(1), { client: { ip: "190.12.1.1", userAgent: UA } });
      if (!out.qualified) throw new Error("expected qualified");
      expect(await submission(out.submissionId)).toMatchObject({ clientIp: "190.12.1.1", clientUa: UA });
      // Booking refreshes the data for the "Schedule" event.
      await f.bookSlot(tenantId, { submissionId: out.submissionId, pass: out.pass, startsAt: MON_9, now: NOW, client: { ip: "190.12.1.2", userAgent: UA } });

      const meta = mockFetch(() => ({ json: { events_received: 1 } }));
      await handleMetaCapi(await capiJob("Lead", out.submissionId), db, testDeps(CAPI, meta.fetch));
      expect(JSON.parse(meta.calls[0]!.body!).data[0].user_data).toMatchObject({ client_ip_address: "190.12.1.2", client_user_agent: UA });
      // Captured again after the Lead job was created: kept for the pending Schedule event.
      expect((await submission(out.submissionId)).clientIp).toBe("190.12.1.2");

      await handleMetaCapi(await capiJob("Schedule", out.submissionId), db, testDeps(CAPI, meta.fetch));
      expect(JSON.parse(meta.calls[1]!.body!).data[0].user_data.client_ip_address).toBe("190.12.1.2");
      expect(await submission(out.submissionId)).toMatchObject({ clientIp: null, clientUa: null, clientCapturedAt: null });

      const stored = await db.select().from(adEvents).where(eq(adEvents.tenantId, tenantId));
      expect(stored.map((e) => e.status)).toEqual(["sent", "sent"]);
      expect(JSON.stringify(stored.map((e) => e.payload))).not.toMatch(/client_ip_address|client_user_agent|190\.12/);
    });

    it("a failed send keeps the data for the retry", async () => {
      const out = await f.submitFunnel(tenantId, funnelId, visitor(2), { client: { ip: "190.12.2.1", userAgent: UA } });
      const down = mockFetch(() => ({ status: 500, json: { error: { message: "boom" } } }));
      await expect(handleMetaCapi(await capiJob("Lead", out.submissionId), db, testDeps(CAPI, down.fetch))).rejects.toThrow();
      expect((await submission(out.submissionId)).clientIp).toBe("190.12.2.1");
    });

    it("the job runner purges data older than 7 days (e.g. CAPI blocked or never sent)", async () => {
      const old = await f.submitFunnel(tenantId, funnelId, visitor(3), { client: { ip: "190.12.3.1", userAgent: UA } });
      const recent = await f.submitFunnel(tenantId, funnelId, visitor(4), { client: { ip: "190.12.4.1", userAgent: UA } });
      await db.update(funnelSubmissions).set({ clientCapturedAt: new Date(Date.now() - CLIENT_DATA_TTL_MS - 60_000) }).where(eq(funnelSubmissions.id, old.submissionId));
      await db.update(funnelSubmissions).set({ clientCapturedAt: new Date(Date.now() - CLIENT_DATA_TTL_MS + 3_600_000) }).where(eq(funnelSubmissions.id, recent.submissionId));

      const summary = await runDueJobs(db, {}, 0);
      expect(summary.purged).toBeGreaterThanOrEqual(1);
      expect(await submission(old.submissionId)).toMatchObject({ clientIp: null, clientUa: null, clientCapturedAt: null });
      expect((await submission(recent.submissionId)).clientIp).toBe("190.12.4.1");
    });

    it("nothing is stored when the caller passes no client data", async () => {
      const out = await f.submitFunnel(tenantId, funnelId, visitor(5));
      expect(await submission(out.submissionId)).toMatchObject({ clientIp: null, clientUa: null, clientCapturedAt: null });
    });
  });
});
