import { describe, expect, it } from "vitest";
import { FUNNEL_TEMPLATES, scoreSubmission } from "./scoring";

const buyer = FUNNEL_TEMPLATES.find((t) => t.key === "real_estate_buyer")!;

describe("funnel scoring", () => {
  it("qualifies a ready buyer", () => {
    const r = scoreSubmission(buyer.questions, { objetivo: "vivir", presupuesto: "150-300", pago: "credito_aprobado", plazo: "3m" }, buyer.threshold);
    expect(r).toMatchObject({ qualified: true, score: 10, disqualifiedReason: null, missing: [] });
  });

  it("disqualifies explorers regardless of score", () => {
    const r = scoreSubmission(buyer.questions, { objetivo: "invertir", presupuesto: "gt300", pago: "contado", plazo: "explorando" }, buyer.threshold);
    expect(r.qualified).toBe(false);
    expect(r.disqualifiedReason).toContain("explorando");
  });

  it("does not qualify below threshold or with missing answers", () => {
    expect(scoreSubmission(buyer.questions, { objetivo: "alquilar", presupuesto: "lt60", pago: "no_se", plazo: "6m" }, buyer.threshold).qualified).toBe(false);
    expect(scoreSubmission(buyer.questions, { objetivo: "vivir" }, buyer.threshold).missing).toEqual(["presupuesto", "pago", "plazo"]);
  });

  it("rejects options that do not exist", () => {
    expect(scoreSubmission(buyer.questions, { objetivo: "hack", presupuesto: "gt300", pago: "contado", plazo: "1m" }, 0).qualified).toBe(false);
  });
});
