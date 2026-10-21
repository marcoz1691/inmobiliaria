import { emptyListing, setField, warn } from "./listing";
import { cleanItem, linesOf } from "./ficha";
import { hasMoney, parseArea, parseMoney, type ParsedNumber } from "./numbers";
import {
  canonicalProvince,
  collapseSpaces,
  countBathrooms,
  countBedrooms,
  countParking,
  detectAmenities,
  findCanton,
  findProvince,
  findSector,
  sameFamily,
  titleCaseEs,
  TYPE_LABEL_ES,
  typeMentions,
  type ScrubContext,
} from "./text";
import type { ExtractedListing } from "./types";

/**
 * Parser for multi-property catalogues (e.g. a bank's portfolio of repossessed assets):
 * one block per page, introduced by "DIRECCIÓN: <place>", followed by a location
 * description, areas, a "VALOR …" label and the bank's administrators' contacts.
 */

const HEADER_RE = /DI+RECCI[ÓO]N\s*:/i;

export function isCatalog(pages: string[]): boolean {
  return pages.filter((p) => HEADER_RE.test(p)).length >= 2 && pages.some((p) => /VALOR/i.test(p));
}

type PriceKind = ExtractedListing["priceKind"];

type Block = {
  page: number;
  name: string | null;
  /** Identifies continuation pages: the name line, or the text before "DIRECCIÓN:" on the same line. */
  key: string;
  city: string | null;
  cityConfidence: "high" | "low";
  headerSector: string | null;
  fallbackSectors: string[];
  province: string | null;
  provinceRaw: string | null;
  body: string[];
};

export function parseCatalog(pages: string[]): {
  listings: ExtractedListing[];
  scrub: ScrubContext;
  warnings: string[];
} {
  const scrub: ScrubContext = { names: [], codes: [] };
  const warnings: string[] = [];
  const listings: ExtractedListing[] = [];
  let previous: { listing: ExtractedListing; key: string } | null = null;

  pages.forEach((page, i) => {
    const pageNo = i + 1;
    const { kept, names, provinceRaw, hadContacts } = stripThirdParty(linesOf(page));
    scrub.names.push(...names);
    const block = toBlock(kept, pageNo, provinceRaw);
    if (!block) {
      if (hasMoney(page)) {
        warnings.push(`Página ${pageNo}: tiene valores pero no un bloque "DIRECCIÓN:"; no se generó borrador. Revísala manualmente.`);
      }
      return;
    }
    const drafts = blockToListings(block);
    for (const l of drafts) l.excluded.thirdPartyContacts = hadContacts;

    // A continuation page (same name, no price, no areas) belongs to the previous block.
    const only = drafts.length === 1 ? drafts[0] : undefined;
    if (
      only &&
      previous &&
      block.key &&
      previous.key === block.key &&
      only.price === null &&
      only.priceNote === null &&
      only.landArea === null &&
      only.builtArea === null
    ) {
      previous.listing.sourcePages.push(pageNo);
      previous.listing.excluded.thirdPartyContacts ||= hadContacts;
      return;
    }
    listings.push(...drafts);
    const last = drafts[drafts.length - 1];
    if (last) previous = { listing: last, key: block.key };
  });

  return { listings, scrub, warnings };
}

function stripThirdParty(lines: string[]) {
  const names: string[] = [];
  const drop = new Set<number>();
  let provinceRaw: string | null = null;
  let hadContacts = false;
  lines.forEach((line, i) => {
    if (/ADMINISTRADOR(A)?\s+DE\s+BIENES/i.test(line)) {
      hadContacts = true;
      drop.add(i);
      const prev = lines[i - 1];
      if (prev && /^[\p{Lu}\s.]+$/u.test(prev)) {
        names.push(prev);
        drop.add(i - 1);
      }
    } else if (/^(tel[eé]fono|celular|correo)\b/i.test(line)) {
      hadContacts = true;
      drop.add(i);
    }
  });
  const kept: string[] = [];
  lines.forEach((line, i) => {
    if (drop.has(i)) return;
    let x = line.replace(/PROPIEDAD\s+INTELECTUAL\s+DE(L)?\s+.*?S\.\s?A\./i, "").trim();
    const prov = /BIENES\s+DE\s+VENTA\s+PROVINCIA\s+(?:DE(?:L)?\s+)?([\p{L} ]+?)\s*\d*$/iu.exec(x);
    if (prov?.[1]) {
      provinceRaw = prov[1].trim();
      x = "";
    }
    if (!x || /^\d{1,2}$/.test(x)) return;
    kept.push(x);
  });
  return { kept, names, provinceRaw, hadContacts };
}

function toBlock(kept: string[], page: number, provinceRaw: string | null): Block | null {
  const hIdx = kept.findIndex((x) => HEADER_RE.test(x));
  if (hIdx < 0) return null;
  const headerLine = kept[hIdx] ?? "";
  const m = HEADER_RE.exec(headerLine);
  const before = headerLine.slice(0, m?.index ?? 0).replace(/[/\s]+$/, "").trim();
  let value = headerLine.slice((m?.index ?? 0) + (m?.[0].length ?? 0)).trim();
  let next = hIdx + 1;
  if (!value) value = kept[next++] ?? "";

  const extras: string[] = [];
  while (next < kept.length) {
    const x = kept[next] ?? "";
    if (/\p{Ll}/u.test(x) || /\d/.test(x) || x.includes(":")) break;
    extras.push(x);
    next++;
  }

  const [cityPartRaw = "", headerSectorRaw] = value.split(/\s+SECTOR\s+/i);
  const [cityRaw = "", dashSector] = cityPartRaw.split(/\s+[–-]\s+/);
  const city = cityRaw ? titleCaseEs(cityRaw.replace(/^STA\.\s*/i, "SANTA ")) : null;
  let headerSector = headerSectorRaw ? titleCaseEs(headerSectorRaw) : null;
  const fallbackSectors: string[] = [];
  for (const e of extras) {
    const sectorLine = /^SECTOR\s+(.+)$/i.exec(e);
    if (sectorLine?.[1] && !headerSector) headerSector = titleCaseEs(sectorLine[1]);
    else fallbackSectors.push(titleCaseEs(e.replace(/[()]/g, "")));
  }
  if (before) fallbackSectors.unshift(titleCaseEs(before));
  if (dashSector) fallbackSectors.push(titleCaseEs(dashSector));

  const nameLines = kept.slice(0, hIdx);
  return {
    page,
    name: nameLines.length ? nameLines.join(" ") : null,
    key: (nameLines.join(" ") || before).toUpperCase(),
    city,
    cityConfidence: city && canonicalProvince(city) ? "low" : "high",
    headerSector,
    fallbackSectors,
    province: canonicalProvince(provinceRaw),
    provinceRaw,
    body: kept.slice(next),
  };
}

const PRICE_LABEL = /^(VALOR\b|Valor\b)/i;
const ADDRESS_STOP =
  /^(•|[áa]reas?\b|area\b|construcci|lote\s+\d|\d+\s+(lotes|terrenos)|valor\b|local\b|cuenta con|el lote|dep\.|casa de|vivienda|bodega|parqueadero|\()/i;
const LOT_LINE = /^LOTE\s+(\d+)\s*:\s*(.*)$/i;

type Lot = { n: string; text: string; price?: ParsedNumber };

function blockToListings(b: Block): ExtractedListing[] {
  /* ── Split body into price lines and descriptive lines ── */
  const priceLines: string[] = [];
  const desc: string[] = [];
  let kindLabel = "";
  let inPrice = false;
  for (const x of b.body) {
    if (PRICE_LABEL.test(x)) {
      inPrice = true;
      kindLabel = x;
      if (hasMoney(x)) priceLines.push(x);
      continue;
    }
    if (inPrice && hasMoney(x)) {
      priceLines.push(x);
      continue;
    }
    inPrice = false;
    desc.push(x);
  }

  let kind: PriceKind = "sale";
  let kindConfidence: "high" | "low" = "high";
  let perSquareMetre = false;
  if (/aval[úu]o/i.test(kindLabel)) kind = "appraisal";
  else if (/pre-?\s*venta/i.test(kindLabel)) perSquareMetre = priceLines.some((p) => /\$[\s\d.,]+m2\b/i.test(p));
  else if (/venta/i.test(kindLabel)) kind = "sale";
  else if (kindLabel) kindConfidence = "low";

  /* ── Lots ("LOTE 21: 3179.33 m2" / "LOTE 21: $108.200,00") ── */
  const lots = new Map<string, Lot>();
  const shared: string[] = [];
  for (let i = 0; i < desc.length; i++) {
    const lm = LOT_LINE.exec(desc[i] ?? "");
    if (!lm?.[1]) {
      shared.push(desc[i] ?? "");
      continue;
    }
    let text = desc[i] ?? "";
    while (/\sy$/i.test(text) && i + 1 < desc.length && !LOT_LINE.test(desc[i + 1] ?? "")) text += ` ${desc[++i]}`;
    lots.set(lm[1], { n: lm[1], text });
  }
  const unlabeledPrices: ParsedNumber[] = [];
  for (const p of priceLines) {
    const lm = LOT_LINE.exec(p);
    const money = parseMoney(p);
    if (!money) continue;
    const lot = lm?.[1] ? lots.get(lm[1]) : undefined;
    if (lot) lot.price = money;
    else unlabeledPrices.push(money);
  }

  const base = (text: string[]) => buildListing(b, text, kind, kindConfidence, perSquareMetre, priceLines);

  if (lots.size < 2) {
    const l = base(desc);
    const money = unlabeledPrices[0] ?? [...lots.values()][0]?.price;
    if (money && !perSquareMetre) {
      const several = unlabeledPrices.length > 1;
      setField(l, "price", money.value, money.ambiguous || several || kindConfidence === "low" ? "low" : "high");
      if (several) warn(l, "El bloque tiene varios valores; se tomó el primero. Verifica el precio.");
    }
    return [l];
  }

  const lotList = [...lots.values()];
  const byOrder = lotList.every((lot) => !lot.price) && unlabeledPrices.length === lotList.length;
  return lotList.map((lot, idx) => {
    const l = base([...shared, lot.text]);
    const land = parseArea(lot.text.replace(/^LOTE\s+\d+\s*:/i, ""));
    if (land) setField(l, "landArea", land.value, land.ambiguous ? "low" : "high");
    const built = /(casa|vivienda|construcci[oó]n)\s+de\s+(\d[\d.,]*\s*m(?:2|²))/i.exec(lot.text);
    const builtArea = built?.[2] ? parseArea(built[2]) : null;
    if (builtArea) setField(l, "builtArea", builtArea.value, "low");
    const price = lot.price ?? (byOrder ? unlabeledPrices[idx] : undefined);
    if (price) setField(l, "price", price.value, lot.price && !price.ambiguous ? "high" : "low");
    if (!lot.price && byOrder) warn(l, "El precio se asignó al lote por orden de aparición; verifícalo.");
    l.title = `${l.title} – Lote ${lot.n}`;
    return l;
  });
}

function buildListing(
  b: Block,
  desc: string[],
  kind: PriceKind,
  kindConfidence: "high" | "low",
  perSquareMetre: boolean,
  priceLines: string[],
): ExtractedListing {
  const l = emptyListing();
  l.sourcePages.push(b.page);
  const text = collapseSpaces(desc.join(" "));

  setField(l, "operation", "sale", "high");
  setField(l, "priceKind", kind, kindConfidence);
  if (kindConfidence === "low") warn(l, "El PDF no indica si el valor es de venta o un avalúo; confírmalo.");
  if (perSquareMetre) {
    const unit = parseMoney(priceLines[0] ?? "");
    if (unit) setField(l, "priceNote", `Valor de pre-venta: $${unit.value.toFixed(2)} por m²`, "high");
    warn(l, "El valor es por m², no un precio total; no se fijó precio.");
  }

  /* ── Address & description ── */
  // The address is private (approximate location by default), so its lines never reach
  // the public description; what is left is a raw fragment of the PDF, hence "low".
  const addressLines: string[] = [];
  for (const x of desc) {
    if (ADDRESS_STOP.test(x)) break;
    addressLines.push(x);
  }
  setField(l, "address", collapseSpaces(addressLines.join(" ")) || null, "low");
  setField(l, "description", collapseSpaces(desc.slice(addressLines.length).join(" ")) || null, "low");

  /* ── Highlights: bullets and standalone parentheticals ── */
  const highlights: string[] = [];
  let current: string | null = null;
  for (const x of desc) {
    if (x.startsWith("•")) {
      if (current) highlights.push(current);
      current = x;
    } else if (current && !/^(VALOR|[áa]rea)/i.test(x)) current += ` ${x}`;
    else {
      if (current) highlights.push(current);
      current = null;
      if (/^\(.*\p{Ll}.*\)$/u.test(x)) highlights.push(x);
    }
  }
  if (current) highlights.push(current);
  l.highlights = highlights.map(cleanItem).filter(Boolean);

  /* ── Areas ── */
  const land = /[áa]rea\s*(?:de\s*)?(?:terreno|lote)\s*:?\s*(\d[\d.,]*\s*(?:m2|m²|hect[aá]reas?))/i.exec(text);
  const landArea = land?.[1] ? parseArea(land[1]) : null;
  if (landArea) setField(l, "landArea", landArea.value, landArea.ambiguous ? "low" : "high");
  const strictBuilt = /construcci[oó]n\s*:?\s*(\d[\d.,]*\s*(?:m2|m²))/i.exec(text);
  const looseBuilt = /construcci[oó]n[^$]{0,60}?(?<![\d.,])(\d[\d.,]*\s*(?:m2|m²))/i.exec(text);
  const builtArea = parseArea(strictBuilt?.[1] ?? looseBuilt?.[1] ?? "");
  if (builtArea) setField(l, "builtArea", builtArea.value, builtArea.ambiguous || !strictBuilt ? "low" : "high");

  /* ── Type ── */
  const mentions = typeMentions(`${b.name ?? ""} ${text}`, { includeBuilding: false });
  const first = mentions[0];
  if (first) {
    const relevant = first === "house" || first === "apartment" ? mentions.filter((t) => t !== "warehouse") : mentions;
    setField(l, "propertyType", first, relevant.every((t) => sameFamily(t, first)) ? "high" : "low");
  } else if (l.landArea !== null && l.builtArea === null) {
    setField(l, "propertyType", "land", "low");
  }
  if (l.builtArea === null && l.propertyType && ["apartment", "office", "commercial"].includes(l.propertyType)) {
    const m = /(?:[áa]rea\s+total|dep\.|departamento|local)[^$]{0,80}?(?<![\d.,])(\d[\d.,]*\s*m(?:2|²))/i.exec(text);
    const a = m?.[1] ? parseArea(m[1]) : null;
    if (a) {
      setField(l, "builtArea", a.value, "low");
      warn(l, "El área de construcción se tomó de un área sin etiqueta explícita; verifícala.");
    }
  }

  /* ── Location ── */
  const canton = findCanton(text);
  if (canton) setField(l, "city", titleCaseEs(canton), "high");
  else if (b.city) setField(l, "city", b.city, b.cityConfidence);
  const province = b.province ?? findProvince(text);
  setField(l, "province", province, "high");
  if (!province && b.provinceRaw) {
    warn(l, `El PDF indica "provincia ${titleCaseEs(b.provinceRaw)}", que no es una provincia del Ecuador; se dejó vacía.`);
  }
  const sector = b.headerSector ?? findSector(text, l.city) ?? b.fallbackSectors[0] ?? null;
  setField(l, "sector", sector, "high");

  /* ── Rooms & amenities ── */
  const bedrooms = countBedrooms(text);
  const bathrooms = countBathrooms(text);
  const parking = countParking(text);
  if (bedrooms) setField(l, "bedrooms", bedrooms.value, bedrooms.explicit ? "high" : "low");
  if (bathrooms) setField(l, "bathrooms", bathrooms.value, bathrooms.explicit ? "high" : "low");
  if (parking) setField(l, "parking", parking.value, parking.explicit ? "high" : "low");
  l.amenities = detectAmenities(text);

  /* ── Title (composed from extracted facts, so "low") ── */
  const place = [sector, l.city].filter(Boolean).join(", ");
  const label = b.name ? titleCaseEs(b.name) : TYPE_LABEL_ES[l.propertyType ?? "other"];
  setField(l, "title", b.name ? `${label}${l.city ? ` – ${l.city}` : ""}` : `${label}${place ? ` en ${place}` : ""}`, "low");

  return l;
}
