import { createHmac } from "node:crypto";
import { safeEqual, sha256 } from "@/lib/crypto";
import type { IntegrationDeps } from "./config";
import { requestJson } from "./http";

/* ───────────── webhook signature ───────────── */

/**
 * Verifies `X-Hub-Signature-256: sha256=<hex>` = HMAC-SHA256(app secret, raw body).
 * Must run on the raw bytes: re-serialized JSON would not match. Constant-time comparison.
 */
export function verifyMetaSignature(rawBody: string | Buffer, header: string | null, appSecret: string): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return safeEqual(expected, header.slice("sha256=".length).toLowerCase());
}

/* ───────────── Conversions API ───────────── */

export function normalizeEmailForMeta(email: string): string {
  return email.trim().toLowerCase();
}

/** Digits only, with country code, no leading zeros or "+" (Meta's normalization rules). */
export function normalizePhoneForMeta(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (/^09\d{8}$/.test(digits)) return `593${digits.slice(1)}`;
  return digits.replace(/^0+/, "");
}

export type CapiInput = {
  eventName: string;
  eventId: string;
  eventTime: Date;
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  eventSourceUrl?: string | null;
  customData?: Record<string, unknown>;
};

/** Builds one server event. Personal identifiers are SHA-256 hashed after normalization; fbc/fbp/ip/ua go in clear as Meta requires. */
export function buildCapiEvent(e: CapiInput) {
  const userData: Record<string, unknown> = {};
  if (e.email) userData.em = [sha256(normalizeEmailForMeta(e.email))];
  if (e.phone) userData.ph = [sha256(normalizePhoneForMeta(e.phone))];
  if (e.externalId) userData.external_id = [sha256(e.externalId)];
  if (e.fbc) userData.fbc = e.fbc;
  if (e.fbp) userData.fbp = e.fbp;
  if (e.clientIp) userData.client_ip_address = e.clientIp;
  if (e.userAgent) userData.client_user_agent = e.userAgent;
  return {
    event_name: e.eventName,
    event_time: Math.floor(e.eventTime.getTime() / 1000),
    event_id: e.eventId,
    action_source: "website" as const,
    ...(e.eventSourceUrl ? { event_source_url: e.eventSourceUrl } : {}),
    user_data: userData,
    custom_data: e.customData ?? {},
  };
}

export type CapiEvent = ReturnType<typeof buildCapiEvent>;

export async function sendCapiEvent(deps: IntegrationDeps, event: CapiEvent): Promise<unknown> {
  const { metaPixelId, metaCapiToken, metaGraphVersion } = deps.config;
  if (!metaPixelId || !metaCapiToken) throw new Error("Conversions API no conectada");
  return requestJson(deps.fetch, "Meta CAPI", `https://graph.facebook.com/${metaGraphVersion}/${encodeURIComponent(metaPixelId)}/events`, {
    body: { data: [event], access_token: metaCapiToken },
  });
}

/* ───────────── Graph API: Lead Ads and page messaging ───────────── */

export type LeadAdsLead = {
  id: string;
  createdTime: string | null;
  formId: string | null;
  adId: string | null;
  fields: Record<string, string>;
};

type GraphLead = { id: string; created_time?: string; form_id?: string; ad_id?: string; field_data?: { name: string; values?: string[] }[] };

export async function fetchLead(deps: IntegrationDeps, leadgenId: string): Promise<LeadAdsLead> {
  const { metaPageToken, metaGraphVersion } = deps.config;
  if (!metaPageToken) throw new Error("Lead Ads no conectado");
  if (!/^\d{1,32}$/.test(leadgenId)) throw new Error("leadgen_id no válido");
  const url = `https://graph.facebook.com/${metaGraphVersion}/${leadgenId}?fields=id,created_time,form_id,ad_id,field_data`;
  const lead = await requestJson<GraphLead>(deps.fetch, "Meta Graph", url, { headers: { authorization: `Bearer ${metaPageToken}` } });
  const fields: Record<string, string> = {};
  for (const f of lead.field_data ?? []) {
    const value = f.values?.[0]?.trim();
    if (value) fields[f.name.toLowerCase()] = value.slice(0, 500);
  }
  return { id: lead.id, createdTime: lead.created_time ?? null, formId: lead.form_id ?? null, adId: lead.ad_id ?? null, fields };
}

/** Maps common Lead Ads field names (standard and custom Spanish labels) to contact data. */
export function leadContactFields(fields: Record<string, string>) {
  const pick = (...keys: string[]) => keys.map((k) => fields[k]).find(Boolean) ?? null;
  const first = pick("first_name", "nombre");
  const last = pick("last_name", "apellido");
  return {
    name: pick("full_name", "nombre_completo", "nombre_y_apellido") ?? ([first, last].filter(Boolean).join(" ") || null),
    email: pick("email", "correo", "correo_electronico"),
    phone: pick("phone_number", "telefono", "teléfono", "celular", "whatsapp"),
  };
}

/** Messenger / Instagram reply via the page (Send API). Valid within the 24 h messaging window. */
export async function sendPageMessage(deps: IntegrationDeps, recipientId: string, text: string): Promise<{ id: string | null }> {
  const { metaPageToken, metaGraphVersion } = deps.config;
  if (!metaPageToken) throw new Error("Mensajería de página no conectada");
  const res = await requestJson<{ message_id?: string }>(deps.fetch, "Meta Send API", `https://graph.facebook.com/${metaGraphVersion}/me/messages`, {
    headers: { authorization: `Bearer ${metaPageToken}` },
    body: { recipient: { id: recipientId }, messaging_type: "RESPONSE", message: { text: text.slice(0, 2000) } },
  });
  return { id: res?.message_id ?? null };
}
