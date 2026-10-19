import { scrubText, type ScrubContext } from "./text";
import type { Confidence, ExtractedListing, ListingField } from "./types";

export const LISTING_FIELDS: ListingField[] = [
  "title", "description", "operation", "propertyType", "price", "priceKind", "priceNote", "landArea", "builtArea",
  "bedrooms", "bathrooms", "parking", "address", "sector", "city", "province", "lat", "lng", "amenities", "highlights",
];

export const WARN = {
  appraisal: "El valor indicado es un avalúo, no un precio de venta. Confírmalo antes de publicar.",
  boundaries: "Se omitieron los linderos del PDF: no se copian a campos publicables.",
  cadastral: "Se omitió el código catastral/predio del PDF: no se copia a campos publicables.",
  contacts: "Se omitieron nombres y datos de contacto de terceros (banco/administradores).",
} as const;

export function emptyListing(): ExtractedListing {
  return {
    title: null,
    description: null,
    operation: null,
    propertyType: null,
    price: null,
    priceKind: "sale",
    priceNote: null,
    currency: "USD",
    landArea: null,
    builtArea: null,
    bedrooms: null,
    bathrooms: null,
    parking: null,
    address: null,
    sector: null,
    city: null,
    province: null,
    lat: null,
    lng: null,
    amenities: [],
    highlights: [],
    confidence: Object.fromEntries(LISTING_FIELDS.map((f) => [f, "missing"])) as Record<ListingField, Confidence>,
    warnings: [],
    sourcePages: [],
    excluded: { cadastralCode: false, boundaries: false, thirdPartyContacts: false },
  };
}

type Settable = Exclude<ListingField, "amenities" | "highlights">;

/** Sets a field and its confidence; a null/undefined value leaves the field "missing". */
export function setField<K extends Settable>(
  l: ExtractedListing,
  field: K,
  value: ExtractedListing[K] | null | undefined,
  confidence: Exclude<Confidence, "missing">,
): void {
  if (value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value))) return;
  (l as Record<K, unknown>)[field] = value;
  l.confidence[field] = confidence;
}

export function warn(l: ExtractedListing, message: string): void {
  if (!l.warnings.includes(message)) l.warnings.push(message);
}

/**
 * Last line of defence before a draft leaves the parser: scrubs third-party data and
 * cadastral codes out of every free-text field, recomputes "missing" confidences and
 * records the exclusion warnings.
 */
export function finalizeListing(l: ExtractedListing, ctx: ScrubContext): ExtractedListing {
  l.title = scrubText(l.title, ctx);
  l.description = scrubText(l.description, ctx);
  l.priceNote = scrubText(l.priceNote, ctx);
  l.address = scrubText(l.address, ctx);
  l.sector = scrubText(l.sector, ctx);
  l.city = scrubText(l.city, ctx);
  l.highlights = dedupe(l.highlights.map((h) => scrubText(h, ctx)).filter((h): h is string => !!h));
  l.amenities = dedupe(l.amenities);

  for (const f of LISTING_FIELDS) {
    if (f === "priceKind") continue;
    const v = l[f];
    if (v === null || (Array.isArray(v) && v.length === 0)) l.confidence[f] = "missing";
    else if (Array.isArray(v) && l.confidence[f] === "missing") l.confidence[f] = "high";
  }
  if (l.price === null && l.confidence.priceKind === "high" && !l.priceNote) l.confidence.priceKind = "low";

  if (l.excluded.boundaries) warn(l, WARN.boundaries);
  if (l.excluded.cadastralCode) warn(l, WARN.cadastral);
  if (l.excluded.thirdPartyContacts) warn(l, WARN.contacts);
  if (l.priceKind === "appraisal") warn(l, WARN.appraisal);
  l.sourcePages = [...new Set(l.sourcePages)].sort((a, b) => a - b);
  return l;
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = i.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
