import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { extractFromPdf, parsePages, RESULT_WARNINGS } from "./extract";
import { WARN } from "./listing";
import type { ExtractedListing, ExtractionResult } from "./types";

const PDF_DIR = process.env.IMPORT_PDF_DIR ?? "/Users/marquinho/inmobiliaria/assets-input/pdfs";
const hasPdfs = existsSync(PDF_DIR);

async function load(name: string): Promise<ExtractionResult> {
  return extractFromPdf(new Uint8Array(readFileSync(path.join(PDF_DIR, name))));
}

function textFields(l: ExtractedListing): string {
  return [l.title, l.description, l.priceNote, l.address, l.sector, l.city, l.province, ...l.highlights, ...l.amenities]
    .filter(Boolean)
    .join("\n");
}

const FICHAS = [
  "Casa Pomasqui.pdf",
  "CASA CONDADO COUNTRY - QUITO.pdf",
  "CASA 4 CONJ. LAS PALMERAS - MACHALA.pdf",
  "CASA No. 18 LAS PALMERAS - MACHALA.pdf",
  "EDIFICIO FERNANDEZ.pdf",
  "LOTE TERRENO RADISSON BLUE.pdf",
  "TERRENO - YAGUACHI NUEVO 2HAS 1.pdf",
  "TERRENO 16 BLUE BEACH - MANGLARALTO 1.pdf",
  "TERRENO CUMANDÁ - CHIMBORAZO.pdf",
];
const CATALOG = "PRESENTACIÓN BIENES MAYO 2026 (1).pdf";
const BROCHURE = "folleto de ventas corregido.pdf";

/** Cadastral codes printed on the cover pages (verified against the extracted text). */
const CADASTRAL_CODES = ["3644265", "1300107007001001007", "10108003009", "10108003023", "10220027004002", "048-015-021", "01-01-05-161-006", "061050510118013000"];

describe.skipIf(!hasPdfs)("extractFromPdf — real PDFs", () => {
  const results = new Map<string, ExtractionResult>();
  beforeAll(async () => {
    for (const f of [...FICHAS, CATALOG, BROCHURE]) results.set(f, await load(f));
  }, 120_000);
  const get = (f: string) => results.get(f)!;
  const one = (f: string) => {
    const r = get(f);
    expect(r.listings).toHaveLength(1);
    return r.listings[0]!;
  };

  it("Casa Pomasqui", () => {
    const r = get("Casa Pomasqui.pdf");
    expect(r.pageCount).toBe(7);
    expect(r.fileSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r.needsOcr).toBe(false);
    expect(r.method).toBe("parser");
    const l = one("Casa Pomasqui.pdf");
    expect(l).toMatchObject({
      propertyType: "house",
      operation: "sale",
      price: 110000,
      priceKind: "sale",
      currency: "USD",
      landArea: 142,
      builtArea: 128,
      lat: -0.070852,
      lng: -78.479659,
      city: "Quito",
      province: "Pichincha",
      sector: "Pomasqui",
    });
    expect(l.confidence).toMatchObject({ price: "high", landArea: "high", builtArea: "high", city: "high", lat: "high" });
    expect(l.highlights).toEqual(
      expect.arrayContaining(["Buen estado de conservación", "Acceso vehicular y peatonal independiente", "A 2 KM del C.C. El Condado Shopping"]),
    );
    // Rooms are counted from the "DISTRIBUCIÓN" page, so they are low confidence.
    expect(l.bedrooms).toBe(3);
    expect(l.confidence.bedrooms).toBe("low");
    expect(l.excluded).toEqual({ cadastralCode: true, boundaries: true, thirdPartyContacts: true });
    expect(l.warnings).toEqual(expect.arrayContaining([WARN.boundaries, WARN.cadastral, WARN.contacts]));
    expect(textFields(l)).not.toMatch(/Mariuxi|Blacio|0994209118|bancoguayaquil/i);
  });

  it("Terreno Cumandá", () => {
    const l = one("TERRENO CUMANDÁ - CHIMBORAZO.pdf");
    expect(l.propertyType).toBe("land");
    expect(l.price).toBe(220000);
    expect(l.priceKind).toBe("sale");
    expect(l.priceNote).toContain("30% Entrada");
    expect(l.landArea).toBe(30244);
    // "30,244" is ambiguous on its own and the value sits away from its label.
    expect(l.confidence.landArea).toBe("low");
    expect(l.city).toBe("Cumandá");
    expect(l.province).toBe("Chimborazo");
    expect(l.lat).toBe(-2.139863);
    expect(l.lng).toBe(-79.048112);
  });

  it("Casa Condado Country: mixed separators, no province invented", () => {
    const l = one("CASA CONDADO COUNTRY - QUITO.pdf");
    expect(l).toMatchObject({ price: 160000, landArea: 65.43, builtArea: 252.92, city: "Quito", sector: "Mena del Hierro", lat: -0.108391, lng: -78.5079437 });
    expect(l.priceNote).toBe("30% Entrada 70% Financiado");
    expect(l.province).toBeNull();
    expect(l.confidence.province).toBe("missing");
    expect(l.bedrooms).toBeNull();
    expect(l.confidence.bedrooms).toBe("missing");
  });

  it("Machala houses use LA/LO coordinates and El Oro province", () => {
    const a = one("CASA 4 CONJ. LAS PALMERAS - MACHALA.pdf");
    expect(a).toMatchObject({ propertyType: "house", price: 240000, landArea: 156.6, builtArea: 320, city: "Machala", province: "El Oro", lat: -3.248425, lng: -79.955778 });
    const b = one("CASA No. 18 LAS PALMERAS - MACHALA.pdf");
    expect(b).toMatchObject({ propertyType: "house", price: 215000, landArea: 153, builtArea: 265.8, city: "Machala", province: "El Oro", lat: -3.248418, lng: -79.955287 });
    expect(b.highlights).toEqual(["Parque Centenario", "Av. de las Palmeras", "Camal Municipal de Machala", "Av. Décima Norte"]);
  });

  it("Edificio Fernández: offices, summed floors flagged low, '--' longitude", () => {
    const l = one("EDIFICIO FERNANDEZ.pdf");
    expect(l).toMatchObject({ propertyType: "office", price: 600000, landArea: 223.3, builtArea: 579.08, lat: -3.260135, lng: -79.960231 });
    expect(l.confidence.builtArea).toBe("low");
  });

  it("Yaguachi: hectares converted, unsigned coordinates corrected with low confidence", () => {
    const l = one("TERRENO - YAGUACHI NUEVO 2HAS 1.pdf");
    expect(l).toMatchObject({ propertyType: "land", price: 270000, landArea: 20000, city: "San Jacinto de Yaguachi", province: "Guayas", lat: -2.094875, lng: -79.701757 });
    expect(l.confidence.lat).toBe("low");
    expect(l.confidence.lng).toBe("low");
    expect(l.address).not.toMatch(/predio/i);
  });

  it("Radisson / Blue Beach land lots", () => {
    const r = one("LOTE TERRENO RADISSON BLUE.pdf");
    expect(r).toMatchObject({ propertyType: "land", price: 39000, landArea: 250, city: "Santa Elena", province: "Santa Elena", sector: "Punta Blanca", lat: -2.172433, lng: -80.79425 });
    const b = one("TERRENO 16 BLUE BEACH - MANGLARALTO 1.pdf");
    expect(b).toMatchObject({ propertyType: "land", price: 14000, landArea: 250, lat: -2.172788, lng: -80.797411 });
    // The template still says "Bodega | Galpón": conflicting type → low + warning.
    expect(b.confidence.propertyType).toBe("low");
    // No canton in the text → city stays empty rather than guessed.
    expect(b.city).toBeNull();
  });

  it("no ficha leaks boundaries or cadastral codes into publishable text", () => {
    for (const f of FICHAS) {
      const l = one(f);
      const text = textFields(l);
      expect(text, f).not.toMatch(/al\s+norte\s*:|linderos|(^|\s)(norte|sur|este|oeste)\s*:/i);
      for (const code of CADASTRAL_CODES) expect(text, `${f} ${code}`).not.toContain(code);
      expect(text, f).not.toMatch(/c[óo]digo catastral|predio\s*:/i);
      expect(l.excluded.boundaries, f).toBe(true);
      expect(l.excluded.cadastralCode, f).toBe(true);
      expect(l.sourcePages.length, f).toBeGreaterThan(0);
    }
  });

  it("bank catalogue: several listings, avalúo flagged, no third-party contacts anywhere", () => {
    const r = get(CATALOG);
    expect(r.pageCount).toBe(22);
    expect(r.listings.length).toBeGreaterThanOrEqual(15);
    for (const l of r.listings) {
      const text = textFields(l);
      expect(text).not.toMatch(/JARAMILLO|VINTIMILLA|ADRIANA|GUSTAVO|ADMINISTRADOR|PROPIEDAD INTELECTUAL/i);
      expect(text).not.toMatch(/0983973673|0999875206|413\s?5470|Ext\.?\s*101/);
      expect(l.excluded.thirdPartyContacts).toBe(true);
      expect(l.warnings).toContain(WARN.contacts);
      expect(l.operation).toBe("sale");
    }

    // Every block labelled "VALOR AVALUO" is an appraisal with the mandatory warning.
    const appraisals = r.listings.filter((l) => l.priceKind === "appraisal");
    expect(appraisals.map((l) => l.price).sort((a, b) => a! - b!)).toEqual([6000, 52290, 66200, 74500, 108200, 355000, 500000, 665000, 1350700]);
    for (const l of appraisals) expect(l.warnings).toContain(WARN.appraisal);

    // Blocks labelled "VALOR (DE) VENTA" in the source keep priceKind "sale".
    const manta = r.listings.find((l) => l.sourcePages.includes(8))!;
    expect(manta).toMatchObject({ priceKind: "sale", price: 1100000, propertyType: "commercial", city: "Manta", province: "Manabí" });

    // Multi-lot block is split per lot with its own area and appraisal.
    const loja = r.listings.filter((l) => l.sourcePages.includes(2));
    expect(loja.map((l) => [l.landArea, l.price])).toEqual([
      [3179.33, 108200],
      [1905.45, 66200],
      [2162.4, 74500],
    ]);

    const esmeraldas = r.listings.find((l) => l.sourcePages.includes(1))!;
    expect(esmeraldas).toMatchObject({ price: 52290, landArea: 279, province: "Esmeraldas", sector: "La Perla" });

    // Price per m² is not a total price.
    const santaIsabel = r.listings.find((l) => l.sourcePages.includes(3))!;
    expect(santaIsabel.price).toBeNull();
    expect(santaIsabel.priceNote).toContain("por m²");

    // "PROVINCIA TENA" is not a province: left empty with a warning.
    const archidona = r.listings.find((l) => l.sourcePages.includes(5))!;
    expect(archidona.province).toBeNull();
    expect(archidona.warnings.join(" ")).toMatch(/Tena/);

    // Page 22 repeats page 21 (Torre del Jardín) and is merged, not duplicated.
    const torre = r.listings.filter((l) => l.title?.startsWith("Torre del Jardin"));
    expect(torre).toHaveLength(1);
    expect(torre[0]!.sourcePages).toEqual([21, 22]);

    // The parking/storage table without a "DIRECCIÓN:" block is reported, not guessed.
    expect(r.warnings.join(" ")).toMatch(/Página 11/);
  });

  it("brochure of floor plans yields no listings and a warning", () => {
    const r = get(BROCHURE);
    expect(r.listings).toHaveLength(0);
    expect(r.needsOcr).toBe(false);
    expect(r.warnings).toContain(RESULT_WARNINGS.unknown);
  });
});

describe("parsePages", () => {
  it("flags scanned (text-less) PDFs as needsOcr with no listings", () => {
    const r = parsePages(["", " ", "12"]);
    expect(r.needsOcr).toBe(true);
    expect(r.listings).toEqual([]);
    expect(r.warnings).toEqual([RESULT_WARNINGS.needsOcr]);
  });

  it("leaves absent fields null with confidence 'missing'", () => {
    const r = parsePages([
      "CASA LOS CEIBOS - GUAYAQUIL\nCÓDIGO CATASTRAL 0912345678",
      "INFORMACIÓN GENERAL\nDirección:\nCasa\nUso residencial\nAv. del Bombero km 6, cantón Guayaquil, provincia del Guayas.\n$95.000,00\nPrecio de Venta\nHitos del sector",
    ]);
    const [l] = r.listings;
    expect(l).toBeDefined();
    expect(l!).toMatchObject({ title: "Casa Los Ceibos - Guayaquil", propertyType: "house", price: 95000, city: "Guayaquil", province: "Guayas" });
    for (const f of ["landArea", "builtArea", "bedrooms", "bathrooms", "parking", "lat", "lng", "priceNote"] as const) {
      expect(l![f], f).toBeNull();
      expect(l!.confidence[f], f).toBe("missing");
    }
    expect(l!.excluded.cadastralCode).toBe(true);
    expect(JSON.stringify(l)).not.toContain("0912345678");
  });
});
