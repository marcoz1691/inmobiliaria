import { and, eq } from "drizzle-orm";
import { decrypt, encrypt, safeEqual } from "@/lib/crypto";
import type { Db } from "@/server/db/create";
import { withTenant } from "@/server/db/tenant-tx";
import { calendarConnections } from "@/server/db/schema";
import type { BusyProvider } from "@/modules/funnels/service";
import { errorInfo, log } from "@/lib/logger";
import { channelReady, defaultDeps, type IntegrationDeps } from "./config";
import { requestJson } from "./http";
import { sign, verify } from "./signing";

/** Minimal scopes: create/delete events and read free/busy. No full calendar or profile access. */
export const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy"];

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";

/* ───────────── OAuth state ───────────── */

export type OAuthState = { tenantId: string; userId: string; agentId: string; nonce: string; exp: number };

const STATE_TTL_MS = 10 * 60_000;

export function createOAuthState(s: Omit<OAuthState, "exp">, now = Date.now()): string {
  return sign("google-oauth", JSON.stringify({ ...s, exp: now + STATE_TTL_MS }));
}

/** Returns the state only if the signature is valid, it has not expired and the nonce matches the browser cookie. */
export function readOAuthState(token: string | null, nonceCookie: string | null | undefined, now = Date.now()): OAuthState | null {
  const raw = verify("google-oauth", token);
  if (!raw || !nonceCookie) return null;
  try {
    const s = JSON.parse(raw) as OAuthState;
    if (typeof s.exp !== "number" || s.exp < now) return null;
    if (typeof s.nonce !== "string" || !safeEqual(s.nonce, nonceCookie)) return null;
    if (![s.tenantId, s.userId, s.agentId].every((v) => typeof v === "string" && v.length > 0)) return null;
    return s;
  } catch {
    return null;
  }
}

export function authorizationUrl(clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };

export async function exchangeCode(deps: IntegrationDeps, code: string, redirectUri: string): Promise<TokenResponse> {
  const { googleClientId, googleClientSecret } = deps.config;
  if (!googleClientId || !googleClientSecret) throw new Error("Google no configurado");
  return requestJson<TokenResponse>(deps.fetch, "Google OAuth", TOKEN_URL, {
    form: { code, client_id: googleClientId, client_secret: googleClientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" },
  });
}

async function refreshToken(deps: IntegrationDeps, refresh: string): Promise<TokenResponse> {
  const { googleClientId, googleClientSecret } = deps.config;
  if (!googleClientId || !googleClientSecret) throw new Error("Google no configurado");
  return requestJson<TokenResponse>(deps.fetch, "Google OAuth", TOKEN_URL, {
    form: { refresh_token: refresh, client_id: googleClientId, client_secret: googleClientSecret, grant_type: "refresh_token" },
  });
}

/* ───────────── connections ───────────── */

export type CalendarConnection = typeof calendarConnections.$inferSelect;

/** Saves (or replaces) the agent's connection with tokens encrypted at rest. */
export async function saveConnection(
  db: Db,
  c: { tenantId: string; agentId: string; tokens: TokenResponse; now: Date },
): Promise<void> {
  const values = {
    accessTokenEnc: encrypt(c.tokens.access_token),
    expiresAt: new Date(c.now.getTime() + (c.tokens.expires_in ?? 3600) * 1000),
    ...(c.tokens.refresh_token ? { refreshTokenEnc: encrypt(c.tokens.refresh_token) } : {}),
  };
  await withTenant(db, c.tenantId, (tx) =>
    tx
      .insert(calendarConnections)
      .values({ tenantId: c.tenantId, agentId: c.agentId, provider: "google", ...values })
      .onConflictDoUpdate({ target: [calendarConnections.agentId, calendarConnections.provider], set: values }),
  );
}

/**
 * Decrypts the access token, refreshing it first when it expires within a minute. The refreshed
 * token is persisted unless `persist` is false (used where we must not open a transaction).
 */
export async function accessToken(
  deps: IntegrationDeps,
  conn: CalendarConnection,
  persist?: (patch: { accessTokenEnc: string; expiresAt: Date }) => Promise<void>,
): Promise<string> {
  const now = deps.now();
  if (conn.accessTokenEnc && conn.expiresAt && conn.expiresAt.getTime() > now.getTime() + 60_000) return decrypt(conn.accessTokenEnc);
  if (!conn.refreshTokenEnc) throw new Error("Google Calendar: la conexión no tiene refresh token; vuelve a conectar");
  const fresh = await refreshToken(deps, decrypt(conn.refreshTokenEnc));
  const patch = { accessTokenEnc: encrypt(fresh.access_token), expiresAt: new Date(now.getTime() + (fresh.expires_in ?? 3600) * 1000) };
  if (persist) await persist(patch);
  return fresh.access_token;
}

/* ───────────── Calendar API ───────────── */

export type CalendarEventInput = {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  timezone: string;
  requestId: string;
  withMeet: boolean;
};

export async function createEvent(deps: IntegrationDeps, token: string, calendarId: string, e: CalendarEventInput) {
  const url = `${API}/calendars/${encodeURIComponent(calendarId)}/events${e.withMeet ? "?conferenceDataVersion=1" : ""}`;
  const body = {
    summary: e.summary.slice(0, 200),
    description: e.description.slice(0, 4000),
    start: { dateTime: e.start.toISOString(), timeZone: e.timezone },
    end: { dateTime: e.end.toISOString(), timeZone: e.timezone },
    reminders: { useDefault: true },
    ...(e.withMeet ? { conferenceData: { createRequest: { requestId: e.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } } } : {}),
  };
  return requestJson<{ id: string; hangoutLink?: string }>(deps.fetch, "Google Calendar", url, {
    headers: { authorization: `Bearer ${token}` },
    body,
  });
}

/** Deletes an event; an already-deleted event (404/410) counts as success. */
export async function deleteEvent(deps: IntegrationDeps, token: string, calendarId: string, eventId: string): Promise<void> {
  const url = `${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  const res = await deps.fetch(url, { method: "DELETE", headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Google Calendar respondió ${res.status} al eliminar el evento`);
}

export async function freeBusy(deps: IntegrationDeps, token: string, calendarId: string, from: Date, to: Date) {
  const res = await requestJson<{ calendars?: Record<string, { busy?: { start: string; end: string }[] }> }>(
    deps.fetch,
    "Google Calendar",
    `${API}/freeBusy`,
    { headers: { authorization: `Bearer ${token}` }, body: { timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: calendarId }] } },
  );
  return (res.calendars?.[calendarId]?.busy ?? []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

/**
 * Busy provider for `availableSlots` / `bookSlot` (src/modules/funnels/service.ts).
 *
 * Connections are loaded *before* the slot query opens its transaction: the provider itself only
 * calls Google, so it never nests a second transaction (PGlite has a single connection). Refreshed
 * tokens are used in memory only; the calendar.sync job persists them. Errors yield no busy times:
 * our own agenda remains the source of truth.
 */
export async function googleBusyProvider(db: Db, tenantId: string, deps: IntegrationDeps = defaultDeps()): Promise<BusyProvider | undefined> {
  if (!channelReady.google(deps.config)) return undefined;
  const conns = await withTenant(db, tenantId, (tx) =>
    tx
      .select()
      .from(calendarConnections)
      .where(and(eq(calendarConnections.tenantId, tenantId), eq(calendarConnections.provider, "google"))),
  );
  if (!conns.length) return undefined;
  const byAgent = new Map(conns.map((c) => [c.agentId, c]));
  return async (agentId, from, to) => {
    const conn = byAgent.get(agentId);
    if (!conn) return [];
    try {
      return await freeBusy(deps, await accessToken(deps, conn), conn.calendarId, from, to);
    } catch (err) {
      log.warn("google freebusy failed", { tenantId, agentId, ...errorInfo(err) });
      return [];
    }
  };
}
