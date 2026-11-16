import { describe, expect, it } from "vitest";
import { CANTONS, cantonsOf, findCanton, findProvince, getCanton, PROVINCES } from "./ecuador";

describe("Ecuador gazetteer", () => {
  it("has the 24 provinces and 223 cantons, with unique slugs", () => {
    expect(PROVINCES).toHaveLength(24);
    expect(CANTONS).toHaveLength(223);
    expect(new Set(CANTONS.map((c) => c.slug)).size).toBe(223);
    expect(new Set(PROVINCES.map((p) => p.slug)).size).toBe(24);
    expect(cantonsOf("guayas")).toHaveLength(25);
    expect(cantonsOf("esmeraldas").map((c) => c.name)).toContain("Borbón");
  });

  it("disambiguates repeated canton names by province", () => {
    expect(getCanton("bolivar-carchi")?.province.name).toBe("Carchi");
    expect(getCanton("bolivar-manabi")?.province.name).toBe("Manabí");
    expect(getCanton("bolivar")).toBeNull();
    expect(findCanton("Bolívar", "Manabí")?.slug).toBe("bolivar-manabi");
    expect(findCanton("Bolívar")).toBeNull(); // ambiguous without a province
  });

  it("finds a canton by name or by its seat, as people type it", () => {
    expect(findCanton("Quito")?.province.name).toBe("Pichincha");
    expect(findCanton("  quito ")?.slug).toBe("quito");
    expect(findCanton("Sangolquí")?.name).toBe("Rumiñahui");
    expect(findCanton("Puyo")?.name).toBe("Pastaza");
    expect(findCanton("Jujan")?.name).toBe("Alfredo Baquerizo Moreno");
    // A seat that is also another canton's name stays that canton.
    expect(findCanton("Sucre")?.name).toBe("Sucre");
    expect(findCanton("Cumbayá")).toBeNull();
    expect(getCanton("ruminahui")?.label).toBe("Rumiñahui (Sangolquí)");
  });

  it("finds provinces by name", () => {
    expect(findProvince("pichincha")?.name).toBe("Pichincha");
    expect(findProvince("Provincia del Guayas")?.name).toBe("Guayas");
    expect(findProvince("Santo Domingo de los Tsáchilas")?.slug).toBe("santo-domingo-de-los-tsachilas");
    expect(findProvince("Narnia")).toBeNull();
    expect(findProvince(null)).toBeNull();
  });
});
