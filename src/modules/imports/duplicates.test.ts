import { describe, expect, it } from "vitest";
import { DUPLICATE_THRESHOLD, findDuplicates } from "./duplicates";
import { emptyListing } from "./listing";
import type { ExistingProperty, ExtractedListing } from "./types";

function listing(overrides: Partial<ExtractedListing>): ExtractedListing {
  return { ...emptyListing(), ...overrides };
}

const pomasqui = listing({
  title: "Casa – Pomasqui - Quito",
  address: "Calle Francisco Huertas OE6 y Calle E, parroquia Pomasqui, cantón Quito, provincia de Pichincha.",
  city: "Quito",
  landArea: 142,
  builtArea: 128,
  price: 110000,
});

const base: ExistingProperty = { id: "x", title: "", address: null, city: null, landArea: null, builtArea: null, price: null };

describe("findDuplicates", () => {
  it("flags the same property with normalised address, areas within 2 % and same price", () => {
    const existing: ExistingProperty[] = [
      {
        ...base,
        id: "same",
        title: "Casa en Pomasqui",
        address: "calle francisco huertas oe6 y calle e, parroquia pomasqui, canton quito, provincia de pichincha",
        city: "QUITO",
        landArea: 143.5, // +1.06 %
        builtArea: 128,
        price: 110000,
      },
    ];
    const [m] = findDuplicates(pomasqui, existing);
    expect(m?.id).toBe("same");
    expect(m?.score).toBe(1);
    expect(m?.reasons).toEqual(
      expect.arrayContaining(["Misma dirección", "Misma ciudad", "Área de terreno igual (±2 %)", "Área de construcción igual (±2 %)", "Mismo precio"]),
    );
  });

  it("ignores candidates in another city and areas outside ±2 %", () => {
    const existing: ExistingProperty[] = [
      { ...base, id: "other-city", address: pomasqui.address, city: "Guayaquil", landArea: 142, builtArea: 128, price: 110000 },
      { ...base, id: "different", address: "Av. 9 de Mayo y Bolívar", city: "Quito", landArea: 146, builtArea: 140, price: 95000 },
    ];
    expect(findDuplicates(pomasqui, existing)).toEqual([]);
  });

  it("sorts by score and applies the threshold", () => {
    const existing: ExistingProperty[] = [
      { ...base, id: "areas-only", city: "Quito", landArea: 142, builtArea: 128 },
      { ...base, id: "full", address: pomasqui.address, city: "Quito", landArea: 142, builtArea: 128, price: 110000 },
      { ...base, id: "price-only", city: "Quito", price: 110000 },
    ];
    const result = findDuplicates(pomasqui, existing);
    expect(result.map((r) => r.id)).toEqual(["full", "areas-only"]);
    expect(result.every((r) => r.score >= DUPLICATE_THRESHOLD)).toBe(true);
    expect(result[0]!.score).toBeGreaterThan(result[1]!.score);
  });
});
