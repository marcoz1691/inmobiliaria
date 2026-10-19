import { emptyListing, setField, warn } from "./listing";
import { ECUADOR_BOUNDS, hasMoney, parseArea, parseCoordinate, parseMoney, round2 } from "./numbers";
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
  normKey,
  sameFamily,
  titleCaseEs,
  typeMentions,
  ucFirst,
  type ScrubContext,
} from "./text";
import type { ExtractedListing } from "./types";

/**
 * Parser for the one-property "ficha" template: cover page (title + cadastral code),
 * "INFORMACIÓN GENERAL" page, LINDEROS page, optional DISTRIBUCIÓN page, photos, contacts.
 */

export function isFicha(pages: string[]): boolean {
  return pages.some((p) => /INFORMACI[ÓO]N\s+GENERAL/i.test(p)) && pages.some((p) => /Direcci[óo]n\s*:/i.test(p));
}

const CODE_LINE = /^(c[óo]digo\s+catastral|clave\s+catastral|predio|piso\s+\d+\s*:)|\d{9,}|^\d{2,4}(-\d{2,4}){2,}$/i;
const NOISE_LINE = /^(marcador con relleno s[óo]lido|georeferenciaci[óo]n|link google maps:?|ubicaci[óo]n satelital)$/i;
const LAND_LABEL = /^(?:[áa]rea\s*(?:de\s*)?terreno|terreno)\s*:?/i;
const BUILT_LABEL = /^(?:[áa]reas?\s*(?:de\s*)?construcci[oó]n|construcci[oó]n|edificaci[oó]n)\s*:?/i;
const FLOOR_LINE = /^(\d+\s*(?:er|do|ro|to|vo|mo|no)?\.?\s*piso|planta|subsuelo|mezzanine)/i;
const STANDALONE_AREA = /^\d[\d.,]*\s*(m2|m²|hect[aá]reas?|has?)(?![\p{L}\d])/iu;
const PRICE_LABEL = /precio\s+de\s+(venta|arriendo|alquiler)|canon\s+de\s+arriendo/i;
const PRICE_NOTE = /\d+\s*%\s*(de\s+)?entrada/i;
const ADDRESS_STOP = /^(US\s?\$|\$|USD)|^[áa]reas?\b|^terreno\s*:|^precio|^hitos|^latitud|^LA\s|^edificaci|^construcci|^link/i;

export function linesOf(page: string | undefined): string[] {
  return (page ?? "")
    .split("\n")
    .map((l) => collapseSpaces(l))
    .filter(Boolean);
}

export function parseFicha(pages: string[]): { listing: ExtractedListing; scrub: ScrubContext } {
  const l = emptyListing();
  const scrub: ScrubContext = { names: [], codes: [] };

  /* ── Exclusions (detected, never copied) ── */
  pages.forEach((p) => {
    if (/^LINDEROS\b/m.test(p) || /(^|\n)\s*(al\s+)?norte\s*:/i.test(p)) l.excluded.boundaries = true;
    const lines = linesOf(p);
    lines.forEach((line, i) => {
      if (/^(celular|tel[eé]fono|correo)\b/i.test(line)) {
        l.excluded.thirdPartyContacts = true;
        const prev = lines[i - 1];
        if (prev && !/^(celular|tel[eé]fono|correo)\b/i.test(prev) && !/@/.test(prev)) scrub.names.push(prev);
      }
    });
  });

  /* ── Title & cadastral code (cover page) ── */
  const cover = linesOf(pages[0]);
  const titleLines: string[] = [];
  for (const line of cover) {
    if (CODE_LINE.test(line)) {
      l.excluded.cadastralCode = true;
      for (const c of line.match(/\d[\d-]{5,}\d/g) ?? []) scrub.codes.push(c);
    } else titleLines.push(line);
  }
  const rawTitle = collapseSpaces(titleLines.join(" ")).replace(/\s*[-–]\s*$/, "");
  setField(l, "title", rawTitle ? titleCaseEs(rawTitle) : null, "high");
  l.sourcePages.push(1);

  /* ── INFORMACIÓN GENERAL page ── */
  const infoIdx = pages.findIndex((p) => /INFORMACI[ÓO]N\s+GENERAL/i.test(p));
  const lines = cleanInfoLines(linesOf(pages[infoIdx]));
  l.sourcePages.push(infoIdx + 1);

  const dirIdx = lines.findIndex((x) => /^direcci[óo]n\s*:?$/i.test(x));
  const usoIdx = lines.findIndex((x, i) => i > dirIdx && /^(uso|zona|suelo)\b/i.test(x));
  const dirName = dirIdx >= 0 && usoIdx > dirIdx ? lines.slice(dirIdx + 1, usoIdx).join(" ") : "";
  const usoLine = usoIdx >= 0 ? lines[usoIdx] : undefined;

  const addressIdx = new Set<number>();
  if (usoIdx >= 0) {
    for (let i = usoIdx + 1; i < lines.length && !ADDRESS_STOP.test(lines[i] ?? ""); i++) addressIdx.add(i);
  }
  let address = collapseSpaces([...addressIdx].map((i) => lines[i]).join(" "));
  // Cadastral keys embedded in the address ("zona # 1, sector # 6, Mz. # 001, predio # 007").
  const cadastralInAddress = /,?\s*(zona|sector|mz\.?|manzana|predio)\s*#\s*[\w-]+/gi;
  if (/predio\s*#/i.test(address)) l.excluded.cadastralCode = true;
  address = collapseSpaces(address.replace(cadastralInAddress, ""));
  setField(l, "address", address || null, "high");

  /* ── Price ── */
  const labelIdx = lines.findIndex((x) => PRICE_LABEL.test(x));
  const moneyIdx = lines
    .map((x, i) => (hasMoney(x) ? i : -1))
    .filter((i) => i >= 0)
    .sort((a, b) => Math.abs(a - labelIdx) - Math.abs(b - labelIdx))[0];
  if (labelIdx >= 0) {
    const isRent = /arriendo|alquiler/i.test(lines[labelIdx] ?? "");
    setField(l, "operation", isRent ? "rent" : "sale", "high");
    setField(l, "priceKind", isRent ? "rent" : "sale", "high");
  }
  if (moneyIdx !== undefined) {
    const money = parseMoney(lines[moneyIdx] ?? "");
    if (money) setField(l, "price", money.value, money.ambiguous || labelIdx < 0 ? "low" : "high");
    if (labelIdx < 0) {
      setField(l, "priceKind", "sale", "low");
      warn(l, "El PDF muestra un valor sin indicar si es precio de venta, arriendo o avalúo.");
    }
  }
  const noteLine = lines.find((x) => PRICE_NOTE.test(x));
  setField(l, "priceNote", noteLine ? collapseSpaces(noteLine) : null, "high");

  /* ── Highlights ("Hitos del sector/inmueble") ── */
  const hitosIdx = lines.findIndex((x) => /^hitos\s+del/i.test(x));
  const highlights: string[] = [];
  if (hitosIdx >= 0 && labelIdx >= 0 && labelIdx < hitosIdx) {
    const block = lines
      .slice(labelIdx + 1, hitosIdx)
      .filter((x) => !hasMoney(x) && !PRICE_NOTE.test(x) && !LAND_LABEL.test(x) && !BUILT_LABEL.test(x));
    highlights.push(...splitHighlights(block));
  }
  for (const x of lines) {
    if (/(buen|excelente|[óo]ptimo)\s+estado/i.test(x)) highlights.push(cleanItem(x));
  }
  l.highlights = highlights.filter(Boolean);

  /* ── Areas ── */
  let landPending = false;
  let builtPending = false;
  let floorSum = 0;
  let floorCount = 0;
  lines.forEach((x, i) => {
    if (addressIdx.has(i)) return;
    if (LAND_LABEL.test(x) && l.landArea === null) {
      const a = parseArea(x);
      if (a) setField(l, "landArea", a.value, a.ambiguous ? "low" : "high");
      else landPending = true;
    } else if (BUILT_LABEL.test(x) && l.builtArea === null) {
      const a = parseArea(x);
      if (a) setField(l, "builtArea", a.value, a.ambiguous ? "low" : "high");
      else builtPending = true;
    } else if (builtPending && FLOOR_LINE.test(x)) {
      const a = parseArea(x);
      if (a) {
        floorSum += a.value;
        floorCount++;
      }
    }
  });
  if (landPending && l.landArea === null) {
    // Layout puts the value away from its label ("Área Terreno:" … "30,244 m2 de superficie").
    const standalone = lines.find((x) => STANDALONE_AREA.test(x));
    const a = standalone ? parseArea(standalone) : null;
    if (a) {
      setField(l, "landArea", a.value, "low");
      warn(l, "El área de terreno se asoció por posición en la ficha; verifícala.");
    }
  }
  if (builtPending && floorCount > 0) {
    setField(l, "builtArea", round2(floorSum), "low");
    warn(l, `Área de construcción calculada como suma de ${floorCount} pisos; verifícala.`);
  }

  /* ── Coordinates ── */
  const joined = lines.join(" ");
  const latRaw = /(?:[Ll]atitud|\bLA)\s*:?\s*([-−–‐]*\s*\d{1,3}[.,]\d+)/.exec(joined)?.[1];
  const lngRaw = /(?:[Ll]ongitud|\bLO)\s*:?\s*([-−–‐]*\s*\d{1,3}[.,]\d+)/.exec(joined)?.[1];
  applyCoordinate(l, "lat", latRaw, ECUADOR_BOUNDS.minLat, ECUADOR_BOUNDS.maxLat);
  applyCoordinate(l, "lng", lngRaw, ECUADOR_BOUNDS.minLng, ECUADOR_BOUNDS.maxLng);

  /* ── Property type ── */
  const fromTitle = typeMentions(rawTitle)[0];
  const fromDir = typeMentions(dirName)[0];
  if (fromTitle) {
    const conflict = fromDir && !sameFamily(fromTitle, fromDir);
    setField(l, "propertyType", fromTitle, conflict ? "low" : "high");
    if (conflict) warn(l, `Tipo de inmueble inconsistente en el PDF (título vs. "${dirName}"); verifícalo.`);
  } else if (fromDir) {
    setField(l, "propertyType", fromDir, "high");
  }

  /* ── Location ── */
  const titleSegments = rawTitle.split(/\s+[-–]\s+/).map((s) => s.trim()).filter(Boolean);
  const lastSegment = titleSegments.length > 1 ? titleSegments[titleSegments.length - 1] : undefined;
  const titleProvince = canonicalProvince(lastSegment);
  const canton = findCanton(address);
  if (canton) setField(l, "city", titleCaseEs(canton), "high");
  else if (lastSegment && !titleProvince) {
    const inAddress = normKey(address).includes(normKey(lastSegment));
    setField(l, "city", titleCaseEs(lastSegment), inAddress ? "high" : "low");
  }
  const lastAddrSegment = address.split(",").pop()?.replace(/\.$/, "");
  const province = findProvince(address) ?? titleProvince ?? canonicalProvince(lastAddrSegment);
  setField(l, "province", province, "high");
  setField(l, "sector", findSector(address, l.city), "high");

  /* ── Description, rooms, amenities ── */
  const distIdx = pages.findIndex((p) => /^\s*DISTRIBUCI[ÓO]N\b/im.test(p));
  const distribution = distIdx >= 0 ? collapseSpaces(linesOf(pages[distIdx]).slice(1).join(" ")) : "";
  if (distIdx >= 0) l.sourcePages.push(distIdx + 1);
  const descParts = [usoLine ? `${ucFirst(usoLine.replace(/\.$/, ""))}.` : "", distribution].filter(Boolean);
  setField(l, "description", descParts.join(" ") || null, distribution ? "high" : "low");

  const bedrooms = countBedrooms(distribution);
  const bathrooms = countBathrooms(distribution);
  const parking = countParking(`${distribution} ${address}`);
  if (bedrooms) setField(l, "bedrooms", bedrooms.value, bedrooms.explicit ? "high" : "low");
  if (bathrooms) setField(l, "bathrooms", bathrooms.value, bathrooms.explicit ? "high" : "low");
  if (parking) setField(l, "parking", parking.value, parking.explicit ? "high" : "low");

  const captions = pages.flatMap((p) => linesOf(p).filter((x) => /^fotos\b/i.test(x)));
  l.amenities = detectAmenities([distribution, ...l.highlights, ...captions].join(" "));

  if (l.bedrooms !== null && l.confidence.bedrooms === "low") {
    warn(l, "Dormitorios/baños contados a partir de la distribución; verifícalos.");
  }
  return { listing: l, scrub };
}

function cleanInfoLines(lines: string[]): string[] {
  const out: string[] = [];
  let afterUrl = false;
  for (const line of lines) {
    if (NOISE_LINE.test(line)) continue;
    if (/^https?:\/\//i.test(line)) {
      afterUrl = true;
      continue;
    }
    // A URL wrapped onto the next line ("hn1X1Nzg6V7GoxL6", "79.955287").
    if (afterUrl && !/\s/.test(line) && !line.includes(":")) {
      afterUrl = false;
      continue;
    }
    afterUrl = false;
    out.push(line);
  }
  return out;
}

const ABBREV_END = /(?<!\p{L})(av|sr|sra|no|mz|cdla|c\.c|dr|ing)\.$/iu;
const CONNECTOR_END = /(?<!\p{L})(de|del|la|las|el|los|a|al|y|en|con|para|por)$/iu;

/** Splits a "Hitos" block into items, re-joining lines the PDF wrapped. */
export function splitHighlights(lines: string[]): string[] {
  const items: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const prev = items[items.length - 1];
    const join =
      prev !== undefined &&
      (/[-–,]$/.test(prev) ||
        ABBREV_END.test(prev) ||
        CONNECTOR_END.test(prev) ||
        (prev.split("(").length > prev.split(")").length) ||
        (/^\p{Ll}/u.test(line) && !/[.;:]$/.test(prev)));
    if (join) items[items.length - 1] = `${prev} ${line}`;
    else items.push(line);
  }
  return items.flatMap((item) => {
    const cleaned = cleanItem(item);
    const parts = cleaned.split(/\s*,\s*/);
    const isNameList = parts.length > 1 && parts.every((p) => /^(\p{Lu}|Av\.)/u.test(p));
    return (isNameList ? parts : [cleaned]).map(cleanItem).filter(Boolean);
  });
}

export function cleanItem(s: string): string {
  let t = collapseSpaces(s).replace(/^[•\-–(\s]+/, "").replace(/[.,;:\s]+$/, "");
  if (t.split(")").length > t.split("(").length) t = t.replace(/\)$/, "");
  return ucFirst(t);
}

function applyCoordinate(l: ExtractedListing, field: "lat" | "lng", raw: string | undefined, min: number, max: number) {
  if (!raw) return;
  const v = parseCoordinate(raw);
  if (v === null) return;
  const name = field === "lat" ? "latitud" : "longitud";
  if (v >= min && v <= max) setField(l, field, v, "high");
  else if (-v >= min && -v <= max) {
    setField(l, field, -v, "low");
    warn(l, `La ${name} del PDF (${raw.trim()}) cae fuera de Ecuador; se invirtió el signo. Verifícala en el mapa.`);
  } else warn(l, `La ${name} del PDF (${raw.trim()}) no es válida para Ecuador; se dejó vacía.`);
}
