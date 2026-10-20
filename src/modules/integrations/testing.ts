import type { FetchLike, IntegrationConfig, IntegrationDeps } from "./config";

/** Test helpers: a recording `fetch` and deps with no credentials unless given. Never used at runtime. */
export type FetchCall = { url: string; method: string; headers: Record<string, string>; body: string | undefined };
type Responder = (call: FetchCall) => { status?: number; json?: unknown } | undefined;

export function mockFetch(responder: Responder = () => undefined) {
  const calls: FetchCall[] = [];
  const fn: FetchLike = async (url, init) => {
    const call: FetchCall = {
      url,
      method: init?.method ?? "GET",
      headers: Object.fromEntries(Object.entries((init?.headers as Record<string, string>) ?? {})),
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    calls.push(call);
    const r = responder(call) ?? {};
    const status = r.status ?? 200;
    const body = status === 204 ? null : r.json === undefined ? "{}" : JSON.stringify(r.json);
    return new Response(body, { status, headers: { "content-type": "application/json" } });
  };
  return { fetch: fn, calls };
}

export function testDeps(config: Partial<IntegrationConfig> = {}, fetchFn?: FetchLike, now = () => new Date()): IntegrationDeps {
  return {
    fetch: fetchFn ?? mockFetch().fetch,
    now,
    config: { appUrl: "https://sitio.test", metaGraphVersion: "v23.0", encryption: Boolean(process.env.ENCRYPTION_KEY), ...config },
  };
}

export const EMAIL_CREDS = { resendApiKey: "re_test", emailFrom: "Sitio <hola@sitio.test>" } as const;
export const WA_CREDS = { whatsappToken: "wa_test", whatsappPhoneNumberId: "1234567890" } as const;
