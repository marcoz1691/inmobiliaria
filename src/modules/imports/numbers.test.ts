import { describe, expect, it } from "vitest";
import { parseArea, parseCoordinate, parseLocaleNumber, parseMoney } from "./numbers";
import { countBathrooms, countBedrooms, countParking, titleCaseEs } from "./text";

describe("parseMoney", () => {
  it.each([
    ["$52.290,00", 52290],
    ["US$110,000", 110000],
    ["$160,000.00", 160000],
    ["US$600,000.00", 600000],
    ["$ 1.350.700,00", 1350700],
    ["Valor $. 120.000,00.", 120000],
    ["$60,00 M2", 60],
    ["$39,000", 39000],
  ])("%s → %d (unambiguous)", (raw, expected) => {
    expect(parseMoney(raw)).toEqual({ value: expected, ambiguous: false });
  });

  it("returns null without a currency marker", () => {
    expect(parseMoney("Área total: 1085 m2")).toBeNull();
  });
});

describe("parseArea", () => {
  it.each([
    ["Área de terreno: 142 m²", 142, false],
    ["Construcción: 252,92 m²", 252.92, false],
    ["Terreno: 65.43 m²", 65.43, false],
    ["LOTE 23: 2162,40 m2", 2162.4, false],
    ["Área de Terreno: 5.418,91 m2", 5418.91, false],
    ["Área de terreno: 7,078.00 m2", 7078, false],
    ["Área de terreno 279m2", 279, false],
    ["2 hectáreas", 20000, false],
    // A single separator followed by exactly 3 digits could be thousands or decimals.
    ["30,244 m2 de superficie", 30244, true],
    ["AREA TERRENO 5.210 m2", 5210, true],
    // Malformed grouping.
    ["Área de 16,617,00 m2", 16617, true],
  ])("%s → %d (ambiguous=%s)", (raw, value, ambiguous) => {
    expect(parseArea(raw)).toEqual({ value, ambiguous });
  });

  it("ignores numbers without an area unit", () => {
    expect(parseArea("Local # 5 (área 85,93)")).toBeNull();
  });
});

describe("parseLocaleNumber", () => {
  it("treats 3 trailing digits as thousands, flagged unless money", () => {
    expect(parseLocaleNumber("110,000")).toEqual({ value: 110000, ambiguous: true });
    expect(parseLocaleNumber("110,000", { money: true })).toEqual({ value: 110000, ambiguous: false });
  });
  it("reads 1–2 or 4+ trailing digits as decimals", () => {
    expect(parseLocaleNumber("889.20")?.value).toBe(889.2);
    expect(parseLocaleNumber("0,500")?.value).toBe(0.5);
    expect(parseLocaleNumber("2.094875")?.value).toBe(2.094875);
  });
});

describe("parseCoordinate", () => {
  it.each([
    ["-0.070852", -0.070852],
    ["−2.172433°", -2.172433],
    ["--79.960231", -79.960231],
    ["--2.172788°", -2.172788],
    ["2.094875°", 2.094875],
  ])("%s → %d", (raw, expected) => {
    expect(parseCoordinate(raw)).toBe(expected);
  });
});

describe("room counting", () => {
  it("counts explicit and implicit bedrooms", () => {
    expect(countBedrooms("Dep. de 1 dormitorio simple, baño completo")).toEqual({ value: 1, explicit: true });
    expect(countBedrooms("Dormitorio máster con baño, dormitorio 2, dormitorio 3, baño para dormitorios secundarios")).toEqual({
      value: 3,
      explicit: false,
    });
    expect(countBedrooms("Galpon 889.20 Bodega 40.00")).toBeNull();
  });
  it("does not read decimals as counts", () => {
    expect(countBathrooms("Galpon 889.20 Baños + archivo 134.00")).toBeNull();
  });
  it("counts parking", () => {
    expect(countParking("garaje cubierto para 2 vehículos")).toEqual({ value: 2, explicit: true });
    expect(countParking("casa 7, parqueadero 13 y 14")).toEqual({ value: 2, explicit: false });
  });
});

describe("titleCaseEs", () => {
  it("title-cases ALL CAPS Spanish and keeps mixed-case tokens", () => {
    expect(titleCaseEs("CASA No. 7 CONJ. CONDADO COUNTRY - QUITO")).toBe("Casa No. 7 Conj. Condado Country - Quito");
    expect(titleCaseEs("SAN JACINTO DE YAGUACHI")).toBe("San Jacinto de Yaguachi");
    expect(titleCaseEs("TERRENO No. 20 Radisson Blue – Punta Blanca")).toBe("Terreno No. 20 Radisson Blue – Punta Blanca");
  });
});
