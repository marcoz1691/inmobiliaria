import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { safeEqual, sha256 } from "@/lib/crypto";
import { appSecret } from "@/server/secrets";
import { rateLimit } from "@/server/rate-limit";

/** Name of the hidden honeypot input. Humans never see or fill it. */
export const HONEYPOT_FIELD = "sitio_web";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const sign = (issuedAt: number) => createHmac("sha256", appSecret()).update(`form:${issuedAt}`).digest("base64url");

/** Server-issued timestamp, signed so a bot cannot backdate it to skip the minimum fill time. */
export function issueFormToken(now = Date.now()): string {
  return `${now}.${sign(now)}`;
}

export type GuardFailure = "bot" | "too_fast" | "expired" | "rate_limited";

/**
 * Anti-spam checks for public forms: honeypot, minimum fill time (signed token) and a
 * per-IP fixed-window rate limit keyed by a hash of the IP (the raw IP is never stored).
 */
export async function checkPublicForm(opts: {
  honeypot: unknown;
  token: unknown;
  minMs: number;
  scope: string;
  max: number;
  windowSec: number;
}): Promise<GuardFailure | null> {
  if (typeof opts.honeypot === "string" && opts.honeypot.trim() !== "") return "bot";
  const [ts, sig] = typeof opts.token === "string" ? opts.token.split(".") : [];
  const issuedAt = Number(ts);
  if (!ts || !sig || !Number.isFinite(issuedAt) || !safeEqual(sign(issuedAt), sig)) return "bot";
  const age = Date.now() - issuedAt;
  if (age < opts.minMs) return "too_fast";
  if (age > MAX_AGE_MS) return "expired";
  const ok = await rateLimit(`${opts.scope}:${sha256(await clientIp())}`, opts.max, opts.windowSec);
  return ok ? null : "rate_limited";
}

export const GUARD_MESSAGE: Record<GuardFailure, string> = {
  bot: "No pudimos enviar el formulario. Recarga la página e inténtalo de nuevo.",
  too_fast: "Revisa tus datos y vuelve a enviar en unos segundos.",
  expired: "El formulario caducó. Recarga la página e inténtalo de nuevo.",
  rate_limited: "Recibimos varios envíos seguidos. Espera unos minutos e inténtalo de nuevo.",
};

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
