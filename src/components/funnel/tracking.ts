/** Ad attribution captured on the landing page and sent with the funnel submission. */
export type Tracking = {
  utm: Record<string, string>;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
};

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id"] as const;

function cookieValue(cookieHeader: string, name: string): string | undefined {
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) {
      const v = rest.join("=");
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    }
  }
  return undefined;
}

/**
 * Reads utm_* and fbclid from the URL and the Meta cookies. `fbc` follows Meta's format
 * `fb.1.<ms timestamp>.<fbclid>`; an existing `_fbc` cookie wins (it keeps the original click time).
 */
export function readTracking(search: URLSearchParams, cookieHeader: string, now = Date.now()): Tracking {
  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const v = search.get(key)?.trim();
    if (v) utm[key] = v.slice(0, 200);
  }
  const fbclid = search.get("fbclid")?.trim().slice(0, 500) || undefined;
  const fbcCookie = cookieValue(cookieHeader, "_fbc");
  const fbp = cookieValue(cookieHeader, "_fbp")?.slice(0, 200);
  const fbc = (fbcCookie && fbcCookie.startsWith("fb.") ? fbcCookie : fbclid ? `fb.1.${now}.${fbclid}` : undefined)?.slice(0, 500);
  return { utm, ...(fbclid ? { fbclid } : {}), ...(fbc ? { fbc } : {}), ...(fbp ? { fbp } : {}) };
}
