import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("@/server/session", () => ({ getMember: async () => ({ tenantId: "t", userId: "u" }) }));
const { act } = await import("./act");

describe("act", () => {
  it("flags plan-limit failures so the panel can offer the plans", async () => {
    const r = await act("publish", async () => {
      throw new AppError("forbidden", "Tu plan Gratis permite 1 propiedad publicada.", { upgrade: true });
    });
    expect(r).toEqual({ ok: false, error: "Tu plan Gratis permite 1 propiedad publicada.", fieldErrors: undefined, upgrade: true });
  });

  it("keeps other expected failures as plain errors", async () => {
    const r = await act("publish", async () => {
      throw new AppError("invalid", "Aún falta información para publicar", { problems: ["Ingresa el precio."] });
    });
    expect(r).toMatchObject({ ok: false, error: "Aún falta información para publicar: Ingresa el precio." });
    expect(r).not.toHaveProperty("upgrade");
  });
});
