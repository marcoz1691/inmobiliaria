import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import { isCatalog, parseCatalog } from "./catalog";
import { isFicha, parseFicha } from "./ficha";
import { finalizeListing } from "./listing";
import type { ExtractedListing, ExtractionResult } from "./types";

/**
 * Below this average of non-whitespace characters per page the PDF is treated as scanned.
 * Such files get `needsOcr: true` and no listings; the caller is expected to route them
 * to the (future) AI/OCR extractor — that is the extension point, `method` will then be "ai".
 */
export const OCR_MIN_CHARS_PER_PAGE = 25;

export const RESULT_WARNINGS = {
  needsOcr: "El PDF casi no tiene texto (posiblemente escaneado). No se generaron borradores; requiere OCR.",
  unknown:
    "No se reconoció una ficha ni un catálogo de propiedades (posible plano o folleto). No se generaron borradores; revisa el PDF manualmente.",
  empty: "El PDF no contiene datos de propiedades reconocibles. No se generaron borradores.",
} as const;

/** Deterministic PDF → draft listings. Never invents values: unknown fields stay null / "missing". */
export async function extractFromPdf(data: Uint8Array): Promise<ExtractionResult> {
  const fileSha256 = createHash("sha256").update(data).digest("hex");
  // pdf.js may transfer (detach) the buffer it receives, so hand it a copy.
  const pdf = await getDocumentProxy(new Uint8Array(data), { verbosity: 0 });
  try {
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    return { fileSha256, pageCount: totalPages, ...parsePages(text) };
  } finally {
    await pdf.loadingTask.destroy();
  }
}

/** Pure text → listings step (exported for tests and for re-parsing stored `extracted_text`). */
export function parsePages(pages: string[]): Omit<ExtractionResult, "fileSha256" | "pageCount"> {
  const text = pages.map((p, i) => `--- Página ${i + 1} ---\n${p}`).join("\n\n");
  const chars = pages.join("").replace(/\s/g, "").length;
  const base = { text, method: "parser" as const };

  if (pages.length === 0 || chars / pages.length < OCR_MIN_CHARS_PER_PAGE) {
    return { ...base, listings: [], needsOcr: true, warnings: [RESULT_WARNINGS.needsOcr] };
  }

  let listings: ExtractedListing[] = [];
  const warnings: string[] = [];
  if (isFicha(pages)) {
    const { listing, scrub } = parseFicha(pages);
    listings = [finalizeListing(listing, scrub)];
  } else if (isCatalog(pages)) {
    const { listings: drafts, scrub, warnings: w } = parseCatalog(pages);
    listings = drafts.map((l) => finalizeListing(l, scrub));
    warnings.push(`Catálogo con varias propiedades: se generaron ${listings.length} borradores.`, ...w);
  } else {
    warnings.push(RESULT_WARNINGS.unknown);
  }

  // A draft with no price, no area and no location is noise, not a listing.
  const useful = listings.filter((l) => l.price !== null || l.landArea !== null || l.builtArea !== null || l.city !== null || l.priceNote !== null);
  if (listings.length > 0 && useful.length === 0) warnings.push(RESULT_WARNINGS.empty);

  return { ...base, listings: useful, needsOcr: false, warnings };
}
