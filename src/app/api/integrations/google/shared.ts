export const GOOGLE_NONCE_COOKIE = "g_oauth_nonce";

/** Per-host redirect URI: each tenant domain must be registered in the Google Cloud console. */
export function googleRedirectUri(req: Request): string {
  return `${new URL(req.url).origin}/api/integrations/google/callback`;
}

export function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=") || null;
  }
  return null;
}
