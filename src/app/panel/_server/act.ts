import "server-only";
import { AppError, type ActionResult } from "@/lib/errors";
import { errorInfo, log } from "@/lib/logger";
import { getMember, type MemberContext } from "@/server/session";

/**
 * Runs a panel mutation for the signed-in member and converts expected failures into an
 * `ActionResult` with a friendly message. Unexpected errors are logged and never leak details.
 */
export async function act<T>(name: string, fn: (m: MemberContext) => Promise<T>): Promise<ActionResult<T>> {
  const m = await getMember();
  if (!m) return { ok: false, error: "Tu sesión expiró. Vuelve a ingresar." };
  try {
    return { ok: true, data: await fn(m) };
  } catch (err) {
    if (err instanceof AppError) {
      const issues = err.details?.issues as Record<string, string[]> | undefined;
      const problems = err.details?.problems as string[] | undefined;
      return { ok: false, error: problems?.length ? `${err.message}: ${problems.join(" ")}` : err.message, fieldErrors: issues };
    }
    log.error("panel action failed", { action: name, ...errorInfo(err) });
    return { ok: false, error: "Algo salió mal. Inténtalo de nuevo en unos segundos." };
  }
}

export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

/** Same-origin check for panel route handlers that accept uploads (defense in depth over SameSite cookies). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export function jsonError(status: number, error: string) {
  return Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}
