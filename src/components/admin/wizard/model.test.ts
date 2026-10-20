import { describe, expect, it } from "vitest";
import { fieldToPatch, parseNumberInput, stepForProblem } from "./model";

describe("wizard model", () => {
  it("parses prices as typed in Ecuador", () => {
    expect(parseNumberInput("110000")).toBe(110000);
    expect(parseNumberInput("110.000")).toBe(110000);
    expect(parseNumberInput("US$ 95.000")).toBe(95000);
    expect(parseNumberInput("1.250,50")).toBe(1250.5);
    expect(parseNumberInput("2,5")).toBe(2.5);
    expect(parseNumberInput("")).toBeNull();
    expect(parseNumberInput("abc")).toBeNaN();
    expect(parseNumberInput("-0,1807", { coordinate: true })).toBeCloseTo(-0.1807);
  });

  it("returns friendly errors per field", () => {
    expect(fieldToPatch("bedrooms", "2.5")).toMatchObject({ ok: false });
    expect(fieldToPatch("price", "110.000")).toEqual({ ok: true, value: 110000 });
    expect(fieldToPatch("lat", "200")).toMatchObject({ ok: false });
    expect(fieldToPatch("operation", "")).toEqual({ ok: true, value: null });
  });

  it("maps publish problems to steps", () => {
    expect(stepForProblem("Sube al menos una foto.")).toBe("fotos");
    expect(stepForProblem("Ingresa el precio.")).toBe("basicos");
    expect(stepForProblem("Revisa los datos importados y marca la revisión como completa.")).toBe("revisar");
  });
});
