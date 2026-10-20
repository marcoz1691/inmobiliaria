import { describe, expect, it } from "vitest";
import { catalogQuery, hasActiveFilters, parseCatalogParams } from "./catalog-params";
import { buildIcs, icsText } from "./ics";

describe("parseCatalogParams", () => {
  it("drops empty fields instead of coercing them to 0", () => {
    const f = parseCatalogParams({ operation: "sale", maxPrice: "", minPrice: "", q: "  ", bedrooms: "2" });
    expect(f).toEqual({ operation: "sale", bedrooms: 2 });
    expect(hasActiveFilters(f)).toBe(true);
  });

  it("ignores invalid values and takes the first of repeated params", () => {
    const f = parseCatalogParams({ type: "castle", sort: ["price_asc", "recent"], page: "0" });
    expect(f).toEqual({ sort: "price_asc" });
    expect(hasActiveFilters(f)).toBe(false);
  });

  it("builds a clean query string and omits page 1", () => {
    expect(catalogQuery({ q: "Cumbayá", page: 3 }, { page: 1 })).toBe("q=Cumbay%C3%A1");
    expect(catalogQuery({ operation: "rent" }, { page: 2 })).toBe("operation=rent&page=2");
  });
});

describe("buildIcs", () => {
  it("produces a valid single-event calendar with escaped text and CRLF lines", () => {
    const ics = buildIcs({
      uid: "b1@agenda",
      start: new Date("2026-10-21T15:00:00Z"),
      end: new Date("2026-10-21T15:30:00Z"),
      summary: "Cita con Ana, asesora",
      description: "Línea 1\nLínea 2; fin",
      url: "https://example.com/cita/x",
      now: new Date("2026-10-19T10:00:00Z"),
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261021T150000Z\r\n");
    expect(ics).toContain("DTEND:20261021T153000Z\r\n");
    expect(ics).toContain("SUMMARY:Cita con Ana\\, asesora\r\n");
    expect(ics).toContain("DESCRIPTION:Línea 1\\nLínea 2\\; fin\r\n");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("folds long lines", () => {
    const ics = buildIcs({ uid: "u", start: new Date(0), end: new Date(60_000), summary: "x".repeat(200) });
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(icsText("a,b")).toBe("a\\,b");
  });
});
