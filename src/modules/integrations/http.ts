import type { FetchLike } from "./config";

/** Non-2xx answer from a provider. The message carries status and a short provider error, never tokens. */
export class ExternalError extends Error {
  constructor(
    public readonly provider: string,
    public readonly status: number,
    detail: string,
  ) {
    super(`${provider} respondió ${status}: ${detail}`.slice(0, 500));
    this.name = "ExternalError";
  }
}

const TIMEOUT_MS = 10_000;

function providerDetail(body: unknown): string {
  if (body && typeof body === "object") {
    const err = (body as { error?: unknown; message?: unknown }).error ?? (body as { message?: unknown }).message;
    if (typeof err === "string") return err;
    if (err && typeof err === "object") {
      const m = (err as { message?: unknown }).message;
      if (typeof m === "string") return m;
    }
  }
  return "sin detalle";
}

/** JSON request with timeout. Throws ExternalError on non-2xx so the job runner retries with backoff. */
export async function requestJson<T = unknown>(
  fetchFn: FetchLike,
  provider: string,
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: unknown; form?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json", ...init.headers };
  let body: string | undefined;
  if (init.form) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(init.form).toString();
  } else if (init.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  const res = await fetchFn(url, { method: init.method ?? (body ? "POST" : "GET"), headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await res.text();
  let parsed: unknown = undefined;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined;
  }
  if (!res.ok) throw new ExternalError(provider, res.status, providerDetail(parsed));
  return parsed as T;
}
