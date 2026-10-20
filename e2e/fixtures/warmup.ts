import type { APIRequestContext } from "@playwright/test";

/** `next dev` compiles routes on first hit; warming them keeps the 5 s expectations meaningful. */
export async function warmUp(request: APIRequestContext, paths: string[]) {
  for (const p of paths) await request.get(p, { timeout: 120_000, maxRedirects: 0 }).catch(() => undefined);
}
