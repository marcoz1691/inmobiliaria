import { randomBytes } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { seedTenant, useTestDb } from "../../../test/db";
import type { Db } from "@/server/db/create";
import { activities, adEvents, agentProfiles, bookings, calendarConnections, contacts, deals, funnelSubmissions, funnels, jobs } from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant-tx";
import { encrypt, sha256 } from "@/lib/crypto";
import { enqueue } from "@/modules/jobs/queue";
import { runDueJobs } from "@/modules/jobs/runner";
import { createJobHandlers } from "@/modules/jobs/handlers";
import type { IntegrationConfig } from "./config";
import { EMAIL_CREDS, WA_CREDS, mockFetch, testDeps } from "./testing";
import { readOptOutToken } from "./signing";

process.env.ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

type Seed = Awaited<ReturnType<typeof seedTenant>>;

describe("integration job handlers", () => {
  let db: Db;
  let A: Seed;
  let contactId: string;
  let dealId: string;
  let bookingId: string;
  let n = 0;

  const run = async (type: string, payload: Record<string, unknown>, config: Partial<IntegrationConfig>, responder?: Parameters<typeof mockFetch>[0]) => {
    const key = `t-${++n}`;
    await withTenant(db, A.tenant.id, (tx) => enqueue(tx, { tenantId: A.tenant.id, type, payload, idempotencyKey: key }));
    const f = mockFetch(responder);
    const summary = await runDueJobs(db, createJobHandlers({ deps: testDeps(config, f.fetch), reply: null }));
    const [job] = await db.select().from(jobs).where(and(eq(jobs.tenantId, A.tenant.id), eq(jobs.idempotencyKey, key)));
    return { summary, job: job!, calls: f.calls };
  };
  const timeline = () => db.select().from(activities).where(eq(activities.contactId, contactId));

  beforeAll(async () => {
    db = await useTestDb();
    A = await seedTenant(db, "a");
    await db.update(agentProfiles).set({ email: "agente@sitio.test", whatsapp: "+593990000000", displayName: "Laura Mena" }).where(eq(agentProfiles.id, A.agent.id));
    const [c] = await db.insert(contacts).values({ tenantId: A.tenant.id, name: "Ana Pérez", email: "ana@correo.ec", phone: "+593991234567", source: "funnel" }).returning();
    contactId = c!.id;
    const [f] = await db
      .insert(funnels)
      .values({ tenantId: A.tenant.id, agentId: A.agent.id, slug: "comprador", name: "Compradores", vertical: "real_estate", status: "active", headline: "x" })
      .returning();
    const [d] = await db.insert(deals).values({ tenantId: A.tenant.id, contactId, funnelId: f!.id, agentId: A.agent.id, stage: "booked", source: "funnel" }).returning();
    dealId = d!.id;
    const [b] = await db
      .insert(bookings)
      .values({
        tenantId: A.tenant.id,
        agentId: A.agent.id,
        funnelId: f!.id,
        contactId,
        dealId,
        startsAt: new Date("2026-10-20T14:00:00Z"),
        endsAt: new Date("2026-10-20T14:30:00Z"),
        meetingKind: "video",
        manageTokenHash: sha256("manage-secret"),
      })
      .returning();
    bookingId = b!.id;
  });

  beforeEach(async () => {
    await db.update(contacts).set({ optedOutAt: null }).where(eq(contacts.id, contactId));
  });

  const confirmation = () => ({ channel: "email", template: "booking_confirmation", contactId, dealId, bookingId });

  it("message.send without credentials stays blocked with an honest reason", async () => {
    const { job, calls } = await run("message.send", confirmation(), {});
    expect(job.status).toBe("blocked");
    expect(job.lastError).toBe("Email no conectado: falta RESEND_API_KEY y EMAIL_FROM");
    expect(calls).toHaveLength(0);
    const wa = await run("message.send", { ...confirmation(), channel: "whatsapp" }, {});
    expect(wa.job.lastError).toBe("WhatsApp no conectado: falta WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID");
  });

  it("message.send with credentials sends via Resend and records the activity", async () => {
    const manageTokenEnc = encrypt("manage-secret");
    const { job, calls } = await run("message.send", { ...confirmation(), manageTokenEnc }, EMAIL_CREDS, () => ({ json: { id: "email-1" } }));
    expect(job.status).toBe("done");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect(calls[0]!.headers.authorization).toBe("Bearer re_test");
    const sent = JSON.parse(calls[0]!.body!);
    expect(sent.to).toEqual(["ana@correo.ec"]);
    expect(sent.reply_to).toBe("agente@sitio.test");
    expect(sent.subject).toContain("Cita confirmada");
    expect(sent.text).toContain("Laura Mena");
    expect(sent.text).toContain("https://sitio.test/cita/manage-secret");
    const optOutUrl = /https:\/\/sitio\.test\/api\/opt-out\?t=(\S+)/.exec(sent.text)![1]!;
    expect(readOptOutToken(optOutUrl)).toEqual({ tenantId: A.tenant.id, contactId });
    expect(sent.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    const logged = (await timeline()).find((a) => a.type === "message_sent");
    expect(logged?.data).toMatchObject({ channel: "email", template: "booking_confirmation", providerId: "email-1" });
  });

  it("message.send via WhatsApp uses the approved template with parameters", async () => {
    const { job, calls } = await run("message.send", { ...confirmation(), channel: "whatsapp" }, WA_CREDS, () => ({ json: { messages: [{ id: "wamid.x" }] } }));
    expect(job.status).toBe("done");
    expect(calls[0]!.url).toBe("https://graph.facebook.com/v23.0/1234567890/messages");
    const body = JSON.parse(calls[0]!.body!);
    expect(body).toMatchObject({ messaging_product: "whatsapp", to: "593991234567", type: "template", template: { name: "cita_confirmada", language: { code: "es" } } });
    expect(body.template.components[0].parameters[0]).toEqual({ type: "text", text: "Ana" });
  });

  it("message.send skips opted-out contacts and cancelled bookings without sending", async () => {
    await db.update(contacts).set({ optedOutAt: new Date() }).where(eq(contacts.id, contactId));
    const out = await run("message.send", confirmation(), EMAIL_CREDS);
    expect(out.job.status).toBe("done");
    expect(out.calls).toHaveLength(0);
    expect((await timeline()).some((a) => a.type === "message_skipped" && a.body?.includes("no recibir"))).toBe(true);
    await db.update(contacts).set({ optedOutAt: null }).where(eq(contacts.id, contactId));

    await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, bookingId));
    const cancelled = await run("message.send", { ...confirmation(), template: "booking_reminder_24h" }, EMAIL_CREDS);
    expect(cancelled.calls).toHaveLength(0);
    expect(cancelled.job.status).toBe("done");
    await db.update(bookings).set({ status: "confirmed" }).where(eq(bookings.id, bookingId));
  });

  it("message.send without email is done with an 'omitido: sin email' activity", async () => {
    const [c] = await db.insert(contacts).values({ tenantId: A.tenant.id, name: "Sin Correo", phone: "+593990001111", source: "x" }).returning();
    const { job, calls } = await run("message.send", { channel: "email", template: "nurture_welcome", contactId: c!.id }, EMAIL_CREDS);
    expect(job.status).toBe("done");
    expect(calls).toHaveLength(0);
    const [a] = await db.select().from(activities).where(eq(activities.contactId, c!.id));
    expect(a?.body).toBe("Omitido: sin email");
  });

  it("agent notifications: blocked without channels, sent by email and WhatsApp when connected", async () => {
    const none = await run("notify.agent.new_lead", { dealId }, {});
    expect(none.job.status).toBe("blocked");
    expect(none.job.lastError).toContain("Email no conectado");
    const both = await run("notify.agent.booking", { bookingId }, { ...EMAIL_CREDS, ...WA_CREDS });
    expect(both.job.status).toBe("done");
    expect(both.calls.map((c) => c.url)).toEqual(["https://api.resend.com/emails", "https://graph.facebook.com/v23.0/1234567890/messages"]);
    expect(JSON.parse(both.calls[0]!.body!).to).toEqual(["agente@sitio.test"]);
    expect(JSON.parse(both.calls[0]!.body!).text).toContain(`/panel/prospectos/${dealId}`);
  });

  it("meta.capi: blocked without credentials; sends once with hashed data and dedupes in ad_events", async () => {
    const [f] = await db.select().from(funnels).where(eq(funnels.tenantId, A.tenant.id));
    const [sub] = await db
      .insert(funnelSubmissions)
      .values({ tenantId: A.tenant.id, funnelId: f!.id, contactId, dealId, answers: {}, score: 10, qualified: true, fbc: "fb.1.1.abc", fbp: "fb.1.1.999" })
      .returning();
    const payload = { eventName: "Lead", eventId: "lead-evt-1", submissionId: sub!.id, contactId };
    expect((await run("meta.capi", payload, {})).job.lastError).toBe("Conversions API no conectada: falta META_PIXEL_ID y META_CAPI_TOKEN");

    const creds = { metaPixelId: "PIXEL1", metaCapiToken: "capi_test" };
    const first = await run("meta.capi", payload, creds, () => ({ json: { events_received: 1 } }));
    expect(first.job.status).toBe("done");
    expect(first.calls[0]!.url).toBe("https://graph.facebook.com/v23.0/PIXEL1/events");
    const ev = JSON.parse(first.calls[0]!.body!).data[0];
    expect(ev).toMatchObject({ event_name: "Lead", event_id: "lead-evt-1", action_source: "website" });
    expect(ev.user_data).toMatchObject({ em: [sha256("ana@correo.ec")], ph: [sha256("593991234567")], fbc: "fb.1.1.abc", fbp: "fb.1.1.999" });
    expect(ev.event_source_url).toBe("https://sitio.test/agenda/comprador");

    const again = await run("meta.capi", payload, creds);
    expect(again.calls).toHaveLength(0);
    const rows = await db.select().from(adEvents).where(eq(adEvents.tenantId, A.tenant.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("sent");
  });

  it("calendar.sync: done with a note when not connected; creates (refreshing the token) and deletes the event", async () => {
    const notConnected = await run("calendar.sync", { bookingId, action: "create" }, {});
    expect(notConnected.job.status).toBe("done");
    expect((await timeline()).some((a) => a.type === "calendar_not_synced")).toBe(true);

    await db.insert(calendarConnections).values({
      tenantId: A.tenant.id,
      agentId: A.agent.id,
      accessTokenEnc: encrypt("old-access"),
      refreshTokenEnc: encrypt("refresh-1"),
      expiresAt: new Date(Date.now() - 60_000),
    });
    const google = { googleClientId: "cid", googleClientSecret: "csecret", encryption: true };
    const created = await run("calendar.sync", { bookingId, action: "create" }, google, (c) =>
      c.url.startsWith("https://oauth2.googleapis.com/token")
        ? { json: { access_token: "new-access", expires_in: 3600 } }
        : { json: { id: "gevt-1", hangoutLink: "https://meet.google.com/abc-defg-hij" } },
    );
    expect(created.job.status).toBe("done");
    expect(created.calls[0]!.body).toContain("grant_type=refresh_token");
    expect(created.calls[1]!.url).toContain("/calendars/primary/events?conferenceDataVersion=1");
    expect(created.calls[1]!.headers.authorization).toBe("Bearer new-access");
    const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    expect(b).toMatchObject({ googleEventId: "gevt-1", meetingUrl: "https://meet.google.com/abc-defg-hij" });
    const [conn] = await db.select().from(calendarConnections).where(eq(calendarConnections.agentId, A.agent.id));
    expect(conn!.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    expect(conn!.accessTokenEnc).not.toContain("new-access");

    const deleted = await run("calendar.sync", { bookingId, action: "cancel" }, google, () => ({ status: 204 }));
    expect(deleted.job.status).toBe("done");
    expect(deleted.calls[0]).toMatchObject({ method: "DELETE" });
    expect(deleted.calls[0]!.url).toContain("/events/gevt-1");
    const [after] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    expect(after!.googleEventId).toBeNull();
  });
});
