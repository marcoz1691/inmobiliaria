import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { seedTenant, useTestDb } from "../../../test/db";
import type { Db } from "@/server/db/create";
import { activities, contacts, webhookEvents } from "@/server/db/schema";
import { optOutToken } from "@/modules/integrations/signing";

// `env` is parsed when first imported: configure it before any import runs.
vi.hoisted(() => {
  process.env.META_APP_SECRET = "route-test-secret";
  process.env.META_VERIFY_TOKEN = "route-verify";
});
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void Promise.resolve().then(fn) }));

const webhook = () => import("./webhooks/meta/route");
const optout = () => import("./opt-out/route");

const signed = (body: string) =>
  new Request("http://localhost/api/webhooks/meta", {
    method: "POST",
    body,
    headers: { "x-hub-signature-256": `sha256=${createHmac("sha256", "route-test-secret").update(body).digest("hex")}` },
  });

describe("route handlers", () => {
  let db: Db;
  let tenantId: string;
  let contactId: string;

  beforeAll(async () => {
    db = await useTestDb();
    tenantId = (await seedTenant(db, "piloto")).tenant.id;
    const [c] = await db.insert(contacts).values({ tenantId, name: "Ana", email: "ana@correo.ec", source: "x" }).returning();
    contactId = c!.id;
  });

  it("webhook GET verifies the subscription token", async () => {
    const { GET } = await webhook();
    const ok = await GET(new Request("http://localhost/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=route-verify&hub.challenge=42"));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("42");
    expect((await GET(new Request("http://localhost/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42"))).status).toBe(403);
  });

  it("webhook POST rejects bad signatures and records a signed event once", async () => {
    const { POST } = await webhook();
    const body = JSON.stringify({ object: "page", entry: [{ id: "1", messaging: [{ sender: { id: "psid" }, recipient: { id: "1" }, message: { mid: "m.route", text: "Hola" } }] }] });
    const bad = await POST(new Request("http://localhost/api/webhooks/meta", { method: "POST", body, headers: { "x-hub-signature-256": "sha256=00" } }));
    expect(bad.status).toBe(401);
    expect((await POST(signed(body))).status).toBe(200);
    expect((await POST(signed(body))).status).toBe(200);
    const rows = await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, "m.route"));
    expect(rows).toHaveLength(1);
  });

  it("opt-out: GET only confirms, POST unsubscribes, invalid tokens get 400", async () => {
    const { GET, POST } = await optout();
    const t = optOutToken(tenantId, contactId);
    const page = await GET(new Request(`http://localhost/api/opt-out?t=${t}`));
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("Confirmar baja");
    expect((await db.select().from(contacts).where(eq(contacts.id, contactId)))[0]!.optedOutAt).toBeNull();

    const form = new FormData();
    form.set("t", t);
    const done = await POST(new Request("http://localhost/api/opt-out", { method: "POST", body: form }));
    expect(done.status).toBe(200);
    expect(await done.text()).toContain("ya no recibirás mensajes");
    expect((await db.select().from(contacts).where(eq(contacts.id, contactId)))[0]!.optedOutAt).not.toBeNull();
    expect((await db.select().from(activities).where(eq(activities.contactId, contactId))).map((a) => a.type)).toContain("opted_out");

    // RFC 8058 one-click (token in the URL, form body "List-Unsubscribe=One-Click").
    const oneClick = await POST(new Request(`http://localhost/api/opt-out?t=${t}`, { method: "POST", body: "List-Unsubscribe=One-Click", headers: { "content-type": "application/x-www-form-urlencoded" } }));
    expect(oneClick.status).toBe(200);
    expect((await GET(new Request("http://localhost/api/opt-out?t=forged.token"))).status).toBe(400);
  });
});
