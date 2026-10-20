import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/crypto";
import { appSecret } from "@/server/secrets";

/**
 * Compact signed tokens: `<base64url(data)>.<hmac>`. The purpose is part of the MAC so a token
 * minted for one use (e.g. opt-out) is rejected for another (e.g. OAuth state).
 */
export function sign(purpose: string, data: string): string {
  const encoded = Buffer.from(data, "utf8").toString("base64url");
  return `${encoded}.${mac(purpose, encoded)}`;
}

export function verify(purpose: string, token: string | null | undefined): string | null {
  if (!token || token.length > 2000) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  if (!safeEqual(mac(purpose, encoded), token.slice(dot + 1))) return null;
  return Buffer.from(encoded, "base64url").toString("utf8");
}

function mac(purpose: string, encoded: string): string {
  return createHmac("sha256", appSecret()).update(`${purpose}:${encoded}`).digest("base64url");
}

const UUID = /^[0-9a-f-]{36}$/i;

/** Opt-out link token: identifies tenant + contact; no expiry (LOPDP: unsubscribing must always work). */
export function optOutToken(tenantId: string, contactId: string): string {
  return sign("opt-out", `${tenantId}:${contactId}`);
}

export function readOptOutToken(token: string | null | undefined): { tenantId: string; contactId: string } | null {
  const data = verify("opt-out", token);
  const [tenantId, contactId] = data?.split(":") ?? [];
  return tenantId && contactId && UUID.test(tenantId) && UUID.test(contactId) ? { tenantId, contactId } : null;
}
