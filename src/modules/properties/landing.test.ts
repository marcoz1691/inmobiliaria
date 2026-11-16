import { describe, expect, it } from "vitest";
import {
  facetCities,
  facetCount,
  facetTypes,
  landingLinks,
  landingPath,
  landingPhrase,
  landingTitle,
  matchesPlace,
  placeSlug,
  parseLanding,
  topCategories,
  type Facet,
} from "./landing";

const facets: Facet[] = [
  { operation: "sale", type: "house", city: "Quito", province: null, count: 3 },
  { operation: "sale", type: "house", city: "quito", province: null, count: 1 },
  { operation: "sale", type: "land", city: "Cuenca", province: null, count: 2 },
  { operation: "rent", type: "office", city: "Quito", province: null, count: 1 },
];

describe("landing paths", () => {
  it("builds clean paths and titles", () => {
    expect(landingPath({ operation: "sale" })).toBe("/venta");
    expect(landingPath({ operation: "rent", type: "apartment" })).toBe("/alquiler/departamentos");
    expect(landingPath({ operation: "sale", type: "commercial", city: "Santo Domingo" })).toBe("/venta/locales-comerciales/santo-domingo");
    expect(landingPath({ operation: "sale", city: "Cumbayá" })).toBe("/venta/propiedades/cumbaya");
    expect(landingTitle({ operation: "sale", type: "house", city: "quito" }, "Quito")).toBe("Casas en venta en Quito");
    expect(landingTitle({ operation: "rent" })).toBe("Propiedades en alquiler");
    expect(landingPhrase({ operation: "rent", type: "office", city: "quito" }, "Quito")).toBe("oficinas en alquiler en Quito");
  });

  it("round-trips every path it builds", () => {
    for (const l of [
      { operation: "sale" as const },
      { operation: "rent" as const, type: "warehouse" as const },
      { operation: "sale" as const, type: "house" as const, city: "quito" },
      { operation: "sale" as const, city: "santo-domingo" },
    ]) {
      const [, ...segments] = landingPath(l).slice(1).split("/");
      expect(parseLanding(l.operation, segments)).toEqual(l);
    }
  });

  it("rejects addresses that are not canonical", () => {
    expect(parseLanding("sale", ["mansiones"])).toBeNull();
    expect(parseLanding("sale", ["propiedades"])).toBeNull(); // duplicate of /venta
    expect(parseLanding("sale", ["casas", "Quito"])).toBeNull(); // not a slug
    expect(parseLanding("sale", ["casas", "quito", "norte"])).toBeNull();
    expect(parseLanding("sale", ["casas", "%' or 1=1"])).toBeNull();
  });
});

describe("facets", () => {
  it("merges spellings of a city and keeps the most used label", () => {
    expect(facetCities(facets)).toEqual([
      { slug: "quito", label: "Quito", count: 5 },
      { slug: "cuenca", label: "Cuenca", count: 2 },
    ]);
    expect(facetCities(facets, { operation: "rent" })).toEqual([{ slug: "quito", label: "Quito", count: 1 }]);
  });

  it("counts by any combination and lists only types in stock", () => {
    expect(facetCount(facets, {})).toBe(7);
    expect(facetCount(facets, { operation: "sale", type: "house", city: "quito" })).toBe(4);
    expect(facetCount(facets, { operation: "rent", type: "house" })).toBe(0);
    expect(facetTypes(facets, { operation: "sale" })).toEqual([
      { type: "house", count: 4 },
      { type: "land", count: 2 },
    ]);
  });

  it("publishes a landing only where there are listings", () => {
    const hrefs = landingLinks(facets).map((l) => l.href);
    expect(hrefs).toContain("/venta/casas/quito");
    expect(hrefs).toContain("/venta/propiedades/cuenca");
    expect(hrefs).toContain("/alquiler/oficinas");
    expect(hrefs).not.toContain("/alquiler/casas");
    expect(hrefs).not.toContain("/alquiler/propiedades/cuenca");
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(landingLinks([])).toEqual([]);
  });

  it("ranks categories by stock", () => {
    expect(topCategories(facets, 2).map((c) => [c.label, c.count])).toEqual([
      ["Casas en venta", 4],
      ["Terrenos en venta", 2],
    ]);
  });
});

describe("places", () => {
  it("resolves free-text cities to cantons, keeping unknown places as typed", () => {
    expect(placeSlug("Sangolquí")).toBe("ruminahui");
    expect(placeSlug("Bolívar", "Carchi")).toBe("bolivar-carchi");
    expect(placeSlug("Cumbayá")).toBe("cumbaya");
  });

  it("matches city and province filters, deriving the province from the canton", () => {
    const quito = { city: "Quito", province: null };
    expect(matchesPlace(quito, { province: "pichincha" })).toBe(true);
    expect(matchesPlace(quito, { city: "quito", province: "pichincha" })).toBe(true);
    expect(matchesPlace(quito, { province: "guayas" })).toBe(false);
    expect(matchesPlace({ city: "Cumbayá", province: "Pichincha" }, { province: "pichincha" })).toBe(true);
    expect(matchesPlace({ city: null, province: null }, { city: "quito" })).toBe(false);
  });
});
