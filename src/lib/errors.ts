/** Expected domain failures. Anything else is a bug and surfaces as a 500. */
export class AppError extends Error {
  constructor(
    public readonly code: "not_found" | "forbidden" | "invalid" | "conflict" | "rate_limited" | "unavailable",
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what = "Recurso") => new AppError("not_found", `${what} no se encontró`);
export const forbidden = () => new AppError("forbidden", "No tienes permiso para esta acción");

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
