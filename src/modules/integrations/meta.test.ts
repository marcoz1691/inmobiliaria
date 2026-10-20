import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256 } from "@/lib/crypto";
import { buildCapiEvent, leadContactFields, normalizePhoneForMeta, verifyMetaSignature } from "./meta";
import { extractEvents } from "./meta-webhook";

const SECRET = "app-secret-test";
const sig = (body: string, secret = SECRET) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

describe("Meta webhook signature", () => {
  const body = JSON.stringify({ object: "page", entry: [] });

  it("accepts the HMAC of the raw body", () => {
    expect(verifyMetaSignature(body, sig(body), SECRET)).toBe(true);
    expect(verifyMetaSignature(Buffer.from(body), sig(body), SECRET)).toBe(true);
  });

  it("rejects a wrong secret, a tampered body, a missing or malformed header", () => {
    expect(verifyMetaSignature(body, sig(body, "other"), SECRET)).toBe(false);
    expect(verifyMetaSignature(body + " ", sig(body), SECRET)).toBe(false);
    expect(verifyMetaSignature(body, null, SECRET)).toBe(false);
    expect(verifyMetaSignature(body, sig(body).replace("sha256=", "sha1="), SECRET)).toBe(false);
    expect(verifyMetaSignature(body, "sha256=abc", SECRET)).toBe(false);
  });
});

describe("Conversions API payload", () => {
  it("hashes normalized email/phone, keeps event_id and action_source", () => {
    const e = buildCapiEvent({
      eventName: "Lead",
      eventId: "evt-123",
      eventTime: new Date("2026-10-19T15:00:00Z"),
      email: "  Ana@Correo.EC ",
      phone: "099 123 4567",
      externalId: "contact-1",
      fbc: "fb.1.1700000000.abc",
      fbp: "fb.1.1700000000.999",
      customData: { content_name: "Compradores" },
    });
    expect(e).toMatchObject({ event_name: "Lead", event_id: "evt-123", event_time: 1792422000, action_source: "website" });
    expect(e.user_data).toEqual({
      em: [sha256("ana@correo.ec")],
      ph: [sha256("593991234567")],
      external_id: [sha256("contact-1")],
      fbc: "fb.1.1700000000.abc",
      fbp: "fb.1.1700000000.999",
    });
    expect(JSON.stringify(e)).not.toContain("ana@correo.ec");
    expect(e.custom_data).toEqual({ content_name: "Compradores" });
  });

  it("normalizes phones to digits with country code", () => {
    expect(normalizePhoneForMeta("+593 99 123 4567")).toBe("593991234567");
    expect(normalizePhoneForMeta("0991234567")).toBe("593991234567");
  });
});

describe("webhook event extraction", () => {
  it("reads WhatsApp messages, Messenger/Instagram messages (no echoes) and leadgen changes", () => {
    const events = extractEvents({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "1234567890" },
                contacts: [{ wa_id: "593991234567", profile: { name: "Ana" } }],
                messages: [{ id: "wamid.1", from: "593991234567", type: "text", text: { body: "Hola" } }],
              },
            },
            { field: "messages", value: { statuses: [{ id: "x" }] } },
          ],
        },
      ],
    });
    expect(events).toEqual([{ provider: "whatsapp", eventId: "wamid.1", accountId: "1234567890", from: "593991234567", name: "Ana", text: "Hola", kind: "text" }]);

    const page = extractEvents({
      object: "page",
      entry: [
        {
          id: "555",
          messaging: [
            { sender: { id: "psid-1" }, recipient: { id: "555" }, message: { mid: "m.1", text: "Info" } },
            { sender: { id: "555" }, recipient: { id: "psid-1" }, message: { mid: "m.2", text: "eco", is_echo: true } },
          ],
          changes: [{ field: "leadgen", value: { leadgen_id: 987654321, page_id: "555", form_id: "f1" } }],
        },
      ],
    });
    expect(page.map((e) => `${e.provider}:${e.eventId}`)).toEqual(["meta_leadgen:987654321", "messenger:m.1"]);
    expect(extractEvents({ nope: true })).toEqual([]);
  });

  it("maps Lead Ads fields to a contact", () => {
    expect(leadContactFields({ full_name: "Ana Pérez", email: "ana@correo.ec", phone_number: "+593991234567" })).toEqual({
      name: "Ana Pérez",
      email: "ana@correo.ec",
      phone: "+593991234567",
    });
    expect(leadContactFields({ first_name: "Ana", last_name: "Pérez" }).name).toBe("Ana Pérez");
  });
});
