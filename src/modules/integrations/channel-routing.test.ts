import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { member, seedTenant, useTestDb } from "../../../test/db";
import type { Db } from "@/server/db/create";
import { withTenant } from "@/server/db/tenant-tx";
import { auditLog, channelAccounts, contacts, webhookEvents } from "@/server/db/schema";
import { listChannelAccounts, registerChannelAccount, removeChannelAccount } from "./channel-accounts";
import { extractEvents, processWebhookEvent, recordEvents, resolveTenant, type InboundEvent } from "./meta-webhook";
import { testDeps } from "./testing";

type Seed = Awaited<ReturnType<typeof seedTenant>>;

const waBody = (phoneNumberId: string, id: string, from: string) => ({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba",
      changes: [
        {
          field: "messages",
          value: {
            metadata: { phone_number_id: phoneNumberId },
            contacts: [{ wa_id: from, profile: { name: "Visitante" } }],
            messages: [{ id, from, type: "text", text: { body: "Hola, busco departamento" } }],
          },
        },
      ],
    },
  ],
});

const igEvent = (accountId: string): InboundEvent => ({ provider: "instagram", eventId: `ig-${accountId}`, accountId, senderId: "psid", text: "hola" });

describe("Meta webhook routing by channel_accounts", () => {
  let db: Db;
  let piloto: Seed;
  let A: Seed;
  let B: Seed;

  beforeAll(async () => {
    db = await useTestDb();
    piloto = await seedTenant(db, "piloto");
    A = await seedTenant(db, "a");
    B = await seedTenant(db, "b");
    await registerChannelAccount(member(A.tenant.id), { provider: "whatsapp", externalId: "1110000001", label: "WhatsApp A" });
    await registerChannelAccount(member(B.tenant.id), { provider: "whatsapp", externalId: "2220000002" });
    await registerChannelAccount(member(B.tenant.id), { provider: "page", externalId: "5550000005" });
  });

  it("routes each WhatsApp number to the tenant that registered it", async () => {
    const deps = testDeps();
    const [toA] = await recordEvents(db, extractEvents(waBody("1110000001", "wamid.a1", "593990000001")), deps);
    const [toB] = await recordEvents(db, extractEvents(waBody("2220000002", "wamid.b1", "593990000002")), deps);
    const rows = await db.select().from(webhookEvents);
    expect(rows.find((r) => r.id === toA)!.tenantId).toBe(A.tenant.id);
    expect(rows.find((r) => r.id === toB)!.tenantId).toBe(B.tenant.id);

    await processWebhookEvent(db, toA!, deps, null);
    await processWebhookEvent(db, toB!, deps, null);
    const phones = async (tenantId: string) => (await db.select().from(contacts).where(eq(contacts.tenantId, tenantId))).map((c) => c.phone);
    expect(await phones(A.tenant.id)).toEqual(["+593990000001"]);
    expect(await phones(B.tenant.id)).toEqual(["+593990000002"]);
    expect(await phones(piloto.tenant.id)).toEqual([]);
  });

  it("ignores an unknown id once accounts are registered: stored without tenant or content, never processed", async () => {
    const ids = await recordEvents(db, extractEvents(waBody("9990000009", "wamid.x1", "593990000009")), testDeps());
    expect(ids).toEqual([]);
    const [row] = await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, "wamid.x1"));
    expect(row).toMatchObject({ status: "ignored", tenantId: null, payload: { accountId: "9990000009" }, lastError: "Cuenta no registrada en channel_accounts" });
    expect(JSON.stringify(row!.payload)).not.toContain("593990000009");
    expect(await processWebhookEvent(db, row!.id, testDeps(), null)).toEqual({ status: "skipped" });
    expect(await db.select().from(contacts).where(eq(contacts.phone, "+593990000009"))).toHaveLength(0);
  });

  it("routes Lead Ads and Messenger by page id; unknown pages are ignored", async () => {
    expect(await resolveTenant(db, { provider: "meta_leadgen", eventId: "l1", accountId: "5550000005", leadgenId: "l1", formId: null, adId: null }, testDeps())).toEqual({
      tenantId: B.tenant.id,
      via: "account",
    });
    expect((await resolveTenant(db, { provider: "messenger", eventId: "m1", accountId: "5559999999", senderId: "s", text: "x" }, testDeps())).tenantId).toBeNull();
  });

  it("falls back to DEFAULT_TENANT_SLUG only while a provider has no registered accounts, and never in multi-tenant production", async () => {
    expect(await resolveTenant(db, igEvent("7770000007"), testDeps())).toEqual({ tenantId: piloto.tenant.id, via: "fallback" });
    expect(await resolveTenant(db, igEvent("7770000007"), testDeps({ production: true }))).toEqual({
      tenantId: null,
      reason: "Cuenta no registrada y hay más de un tenant",
    });
  });

  it("an id belongs to one tenant: another tenant cannot claim it; re-registering is idempotent", async () => {
    await expect(registerChannelAccount(member(B.tenant.id), { provider: "whatsapp", externalId: "1110000001" })).rejects.toMatchObject({ code: "conflict" });
    const again = await registerChannelAccount(member(A.tenant.id), { provider: "whatsapp", externalId: "1110000001" });
    expect(again.tenantId).toBe(A.tenant.id);
    await expect(registerChannelAccount(member(A.tenant.id, { role: "agent" }), { provider: "page", externalId: "1234567" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(registerChannelAccount(member(A.tenant.id), { provider: "page", externalId: "abc" })).rejects.toMatchObject({ code: "invalid" });
  });

  it("isolation: each tenant lists and removes only its own accounts", async () => {
    const listA = await listChannelAccounts(member(A.tenant.id));
    expect(listA.map((a) => a.externalId)).toEqual(["1110000001"]);
    const underRls = await withTenant(db, A.tenant.id, (tx) => tx.select().from(channelAccounts));
    expect(underRls.every((r) => r.tenantId === A.tenant.id)).toBe(true);

    const [bPage] = (await listChannelAccounts(member(B.tenant.id))).filter((a) => a.provider === "page");
    await expect(removeChannelAccount(member(A.tenant.id), bPage!.id)).rejects.toMatchObject({ code: "not_found" });
    await removeChannelAccount(member(B.tenant.id), bPage!.id);
    expect((await listChannelAccounts(member(B.tenant.id))).map((a) => a.provider)).toEqual(["whatsapp"]);
    const trail = await db.select().from(auditLog).where(eq(auditLog.tenantId, B.tenant.id));
    expect(trail.map((t) => t.action)).toEqual(expect.arrayContaining(["channel_account.register", "channel_account.remove"]));
  });
});
