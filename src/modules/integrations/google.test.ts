import { describe, expect, it } from "vitest";
import { GOOGLE_SCOPES, authorizationUrl, createOAuthState, readOAuthState } from "./google";
import { optOutToken, readOptOutToken, sign } from "./signing";

const base = { tenantId: "t-1", userId: "u-1", agentId: "a-1", nonce: "nonce-abc" };

describe("Google OAuth state", () => {
  it("round-trips a valid state bound to the browser nonce", () => {
    const state = createOAuthState(base, 1_000);
    expect(readOAuthState(state, "nonce-abc", 2_000)).toMatchObject(base);
  });

  it("rejects manipulated, foreign, expired or unbound states", () => {
    const state = createOAuthState(base, 1_000);
    const [data, mac] = state.split(".");
    const forged = Buffer.from(JSON.stringify({ ...base, tenantId: "t-2", exp: 9e15 })).toString("base64url");
    expect(readOAuthState(`${forged}.${mac}`, "nonce-abc", 2_000)).toBeNull();
    expect(readOAuthState(`${data}.${mac}x`, "nonce-abc", 2_000)).toBeNull();
    expect(readOAuthState(sign("opt-out", JSON.stringify({ ...base, exp: 9e15 })), "nonce-abc", 2_000)).toBeNull();
    expect(readOAuthState(state, "other-nonce", 2_000)).toBeNull();
    expect(readOAuthState(state, null, 2_000)).toBeNull();
    expect(readOAuthState(state, "nonce-abc", 1_000 + 11 * 60_000)).toBeNull();
    expect(readOAuthState(null, "nonce-abc")).toBeNull();
  });

  it("asks only for calendar.events and calendar.freebusy, offline", () => {
    const url = new URL(authorizationUrl("cid", "https://sitio.test/api/integrations/google/callback", "st"));
    expect(url.searchParams.get("scope")!.split(" ")).toEqual(GOOGLE_SCOPES);
    expect(GOOGLE_SCOPES).toEqual(["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy"]);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("state")).toBe("st");
  });
});

describe("opt-out token", () => {
  it("only accepts tokens signed for opt-out", () => {
    const t = "0b9f1f8e-1b1a-4c1e-9d55-2d0a1f9b6c01";
    const c = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
    expect(readOptOutToken(optOutToken(t, c))).toEqual({ tenantId: t, contactId: c });
    expect(readOptOutToken(sign("chat", `${t}:${c}`))).toBeNull();
    expect(readOptOutToken("garbage")).toBeNull();
  });
});
