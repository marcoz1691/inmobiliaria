import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { seedTenant, useTestDb } from "../../../test/db";
import type { Db } from "@/server/db/create";
import { contacts, conversations, deals, funnels, jobs, messages, webhookEvents } from "@/server/db/schema";
import { runDueJobs } from "@/modules/jobs/runner";
import { createJobHandlers } from "@/modules/jobs/handlers";
import { BACKSTOP_DELAY_MS, extractEvents, processWebhookEvent, recordEvents } from "./meta-webhook";
import { WA_CREDS, mockFetch, testDeps } from "./testing";

type Seed = Awaited<ReturnType<typeof seedTenant>>;

const waBody = (id: string, text: string) => ({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba",
      changes: [
        {
          field: "messages",
          value: {
            metadata: { phone_number_id: WA_CREDS.whatsappPhoneNumberId },
            contacts: [{ wa_id: "593991112233", profile: { name: "Carlos Ruiz" } }],
            messages: [{ id, from: "593991112233", type: "text", text: { body: text } }],
          },
        },
      ],
    },
  ],
});

const leadBody = (leadgenId: string) => ({ object: "page", entry: [{ id: "555", changes: [{ field: "leadgen", value: { leadgen_id: leadgenId, page_id: "555", form_id: "77" } }] }] });

describe("Meta webhook processing", () => {
  let db: Db;
  let piloto: Seed;

  beforeAll(async () => {
    db = await useTestDb();
    // resolveTenant uses DEFAULT_TENANT_SLUG ("piloto" by default).
    piloto = await seedTenant(db, "piloto");
    await seedTenant(db, "otro");
    await db
      .insert(funnels)
      .values({ tenantId: piloto.tenant.id, agentId: piloto.agent.id, slug: "comprador", name: "Compradores", vertical: "real_estate", status: "active", headline: "x" });
  });

  it("is idempotent: the same WhatsApp message delivered twice is stored and answered once", async () => {
    const f = mockFetch(() => ({ json: { messages: [{ id: "wamid.out1" }] } }));
    const deps = testDeps(WA_CREDS, f.fetch);
    let replies = 0;
    const reply = async () => (replies++, "Hola, Carlos. ¿Qué tipo de propiedad buscas?");

    const first = await recordEvents(db, extractEvents(waBody("wamid.in1", "Hola, busco casa")), deps);
    const dup = await recordEvents(db, extractEvents(waBody("wamid.in1", "Hola, busco casa")), deps);
    expect(first).toHaveLength(1);
    expect(dup).toHaveLength(0);

    expect(await processWebhookEvent(db, first[0]!, deps, reply)).toEqual({ status: "processed" });
    expect(await processWebhookEvent(db, first[0]!, deps, reply)).toEqual({ status: "skipped" });
    expect(replies).toBe(1);
    expect(f.calls).toHaveLength(1);
    expect(JSON.parse(f.calls[0]!.body!)).toMatchObject({ to: "593991112233", type: "text", text: { body: "Hola, Carlos. ¿Qué tipo de propiedad buscas?" } });

    const [conv] = await db.select().from(conversations).where(and(eq(conversations.tenantId, piloto.tenant.id), eq(conversations.channel, "whatsapp")));
    expect(conv!.externalThreadId).toBe("593991112233");
    const history = await db.select().from(messages).where(eq(messages.conversationId, conv!.id)).orderBy(messages.createdAt);
    expect(history.map((m) => `${m.direction}:${m.role}`)).toEqual(["in:user", "out:assistant"]);
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, conv!.contactId!));
    expect(contact).toMatchObject({ name: "Carlos Ruiz", phone: "+593991112233", source: "whatsapp" });

    // The backstop job finds the event already processed and does nothing.
    const [backstop] = await db.select().from(jobs).where(eq(jobs.idempotencyKey, `webhook:${first[0]}`));
    expect(backstop!.runAt.getTime()).toBeGreaterThanOrEqual(Date.now() + BACKSTOP_DELAY_MS - 5_000);
  });

  it("does not reply (or pretend to) when WhatsApp is not connected; ignores other phone numbers", async () => {
    const f = mockFetch();
    const deps = testDeps({ whatsappPhoneNumberId: "999" }, f.fetch);
    expect(await recordEvents(db, extractEvents(waBody("wamid.in2", "Hola")), deps)).toHaveLength(0);

    const noCreds = testDeps({}, f.fetch);
    const [id] = await recordEvents(db, extractEvents(waBody("wamid.in3", "Hola otra vez")), noCreds);
    let asked = 0;
    await processWebhookEvent(db, id!, noCreds, async () => (asked++, "x"));
    expect(asked).toBe(0);
    expect(f.calls).toHaveLength(0);
  });

  it("Lead Ads: blocked without page token; with it creates contact + deal + agent alert + funnel invitation", async () => {
    const [blockedId] = await recordEvents(db, extractEvents(leadBody("111222333")), testDeps());
    expect(await processWebhookEvent(db, blockedId!, testDeps(), null)).toEqual({ status: "blocked", reason: "Lead Ads no conectado: falta META_PAGE_TOKEN" });
    const [row] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, blockedId!));
    expect(row!.status).toBe("blocked");

    const f = mockFetch(() => ({
      json: {
        id: "111222333",
        form_id: "77",
        ad_id: "4455",
        field_data: [
          { name: "full_name", values: ["María Torres"] },
          { name: "email", values: ["maria@correo.ec"] },
          { name: "phone_number", values: ["+593987654321"] },
        ],
      },
    }));
    const deps = testDeps({ metaPageToken: "page_test" }, f.fetch);
    // Once the token exists the backstop job (unblocked) processes the same stored event.
    expect(await processWebhookEvent(db, blockedId!, deps, null)).toEqual({ status: "processed" });
    expect(f.calls[0]!.url).toBe("https://graph.facebook.com/v23.0/111222333?fields=id,created_time,form_id,ad_id,field_data");
    expect(f.calls[0]!.headers.authorization).toBe("Bearer page_test");

    const [contact] = await db.select().from(contacts).where(and(eq(contacts.tenantId, piloto.tenant.id), eq(contacts.email, "maria@correo.ec")));
    expect(contact).toMatchObject({ name: "María Torres", phone: "+593987654321", source: "meta_lead_ads", consentAt: null });
    const [deal] = await db.select().from(deals).where(eq(deals.contactId, contact!.id));
    expect(deal).toMatchObject({ stage: "new", source: "meta_lead_ads", agentId: piloto.agent.id });
    const queued = await db.select().from(jobs).where(eq(jobs.tenantId, piloto.tenant.id));
    const mine = queued.filter((j) => (j.payload as { dealId?: string }).dealId === deal!.id).map((j) => `${j.type}:${(j.payload as { channel?: string }).channel ?? ""}`);
    expect(mine.sort()).toEqual(["message.send:email", "message.send:whatsapp", "notify.agent.new_lead:"]);

    // The invitation renders with the active funnel link (UTM tagged) once email is connected.
    const mail = mockFetch(() => ({ json: { id: "e1" } }));
    await db.update(jobs).set({ runAt: new Date(Date.now() + 3_600_000) }).where(eq(jobs.type, "meta.webhook"));
    await runDueJobs(db, createJobHandlers({ deps: testDeps({ resendApiKey: "re", emailFrom: "a@b.c" }, mail.fetch), reply: null }));
    const invite = mail.calls.map((c) => JSON.parse(c.body!)).find((b) => (b.to as string[]).includes("maria@correo.ec"));
    expect(invite.text).toContain("https://sitio.test/agenda/comprador?utm_source=facebook&utm_medium=lead_ads");
  });
});
