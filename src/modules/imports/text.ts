import type { ExtractedListing } from "./types";

type PropertyType = NonNullable<ExtractedListing["propertyType"]>;

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
}

const LOWER_WORDS = new Set(["de", "del", "y", "e", "en", "a", "al", "con", "por", "para", "o", "u"]);

/**
 * Spanish title case for ALL-CAPS source text. Tokens that already contain lowercase
 * letters (e.g. "Radisson Blue") are left untouched; initialisms like "C.C." are kept.
 */
export function titleCaseEs(input: string): string {
  const tokens = collapseSpaces(input).split(" ");
  return tokens
    .map((tok, i) => {
      if (/\p{Ll}/u.test(tok)) return tok;
      if (/^(\p{Lu}\.){2,}$/u.test(tok)) return tok;
      const lower = tok.toLocaleLowerCase("es");
      if (i > 0 && LOWER_WORDS.has(lower)) return lower;
      return lower.replace(/(^|[-/("“”'«])(\p{L})/gu, (_m, pre: string, ch: string) => pre + ch.toLocaleUpperCase("es"));
    })
    .join(" ");
}

export const PROVINCES = [
  "Azuay", "Bolívar", "Cañar", "Carchi", "Chimborazo", "Cotopaxi", "El Oro", "Esmeraldas", "Galápagos", "Guayas",
  "Imbabura", "Loja", "Los Ríos", "Manabí", "Morona Santiago", "Napo", "Orellana", "Pastaza", "Pichincha",
  "Santa Elena", "Santo Domingo de los Tsáchilas", "Sucumbíos", "Tungurahua", "Zamora Chinchipe",
] as const;

const PROVINCE_BY_KEY = new Map(PROVINCES.map((p) => [normKey(p), p]));

export function normKey(s: string): string {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Returns the canonical province name when `s` is exactly a province (accent/case-insensitive). */
export function canonicalProvince(s: string | null | undefined): string | null {
  if (!s) return null;
  return PROVINCE_BY_KEY.get(normKey(s.replace(/^(del?|la)\s+/i, ""))) ?? PROVINCE_BY_KEY.get(normKey(s)) ?? null;
}

/* ───────────── Property type detection ───────────── */

const TYPE_PATTERNS: { type: PropertyType; re: RegExp }[] = [
  { type: "apartment", re: /(?<!\p{L})(departamentos?|dptos?\.|dep\.|suites?)(?!\p{L})/giu },
  { type: "office", re: /(?<!\p{L})(oficinas?)(?!\p{L})/giu },
  { type: "commercial", re: /(?<!\p{L})(locales?\s+comerciales?|local\s*#|local\s+comercial)(?!\p{L})/giu },
  { type: "house", re: /(?<!\p{L})(casas?|viviendas?|villas?)(?!\p{L})/giu },
  { type: "warehouse", re: /(?<!\p{L})(bodegas?|galp[oó]n(es)?)(?!\p{L})/giu },
  { type: "building", re: /(?<!\p{L})(edificios?|edif\.)(?!\p{L})/giu },
  { type: "land", re: /(?<!\p{L})(terrenos?|lotes?|solar(es)?|lotizaci[oó]n)(?!\p{L})/giu },
];

const FAMILY: Record<PropertyType, string> = {
  house: "residential",
  apartment: "residential",
  land: "land",
  office: "business",
  commercial: "business",
  building: "business",
  warehouse: "warehouse",
  other: "other",
};

export function sameFamily(a: PropertyType, b: PropertyType): boolean {
  return FAMILY[a] === FAMILY[b];
}

/** All explicit type mentions in order of appearance. Phrases like "Área de terreno" are not type mentions. */
export function typeMentions(text: string, opts: { includeBuilding?: boolean } = {}): PropertyType[] {
  const cleaned = text.replace(/[áa]reas?\s*(de\s*)?(terreno|lote)s?/giu, " ");
  const found: { type: PropertyType; index: number }[] = [];
  for (const { type, re } of TYPE_PATTERNS) {
    if (type === "building" && opts.includeBuilding === false) continue;
    for (const m of cleaned.matchAll(re)) found.push({ type, index: m.index ?? 0 });
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.type);
}

export const TYPE_LABEL_ES: Record<PropertyType, string> = {
  house: "Casa",
  apartment: "Departamento",
  land: "Terreno",
  office: "Oficina",
  commercial: "Local comercial",
  warehouse: "Bodega",
  building: "Edificio",
  other: "Inmueble",
};

/* ───────────── Rooms & amenities ───────────── */

export type Count = { value: number; explicit: boolean };

const NUM_WORDS: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 };

function countRooms(text: string, singular: string, plural: string): Count | null {
  const t = text.toLowerCase();
  let explicit = 0;
  let explicitHits = 0;
  const numbered = new RegExp(`(?<![\\p{L}\\d.,])(\\d{1,2}|un|una|uno|dos|tres|cuatro|cinco|seis)\\s+(?:${plural}|${singular})(?!\\p{L})`, "gu");
  const consumed: [number, number][] = [];
  for (const m of t.matchAll(numbered)) {
    const n = Number(m[1]) || NUM_WORDS[m[1] ?? ""] || 0;
    explicit += n;
    explicitHits++;
    consumed.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
  }
  let loose = 0;
  for (const m of t.matchAll(new RegExp(`(?<!\\p{L})${singular}(?!\\p{L})`, "gu"))) {
    const i = m.index ?? 0;
    if (consumed.some(([a, b]) => i >= a && i < b)) continue;
    loose++;
  }
  if (explicitHits === 0 && loose === 0) return null;
  return { value: explicit + loose, explicit: explicitHits === 1 && loose === 0 };
}

export function countBedrooms(text: string): Count | null {
  return countRooms(text, "(?:dormitorio|habitaci[oó]n)", "(?:dormitorios|habitaciones)");
}

export function countBathrooms(text: string): Count | null {
  // "4 dormitorios con baño privado" → 4 bathrooms.
  const t = text.toLowerCase();
  let extra = 0;
  let stripped = t;
  for (const m of t.matchAll(/(\d{1,2})\s+dormitorios\s+con\s+baño/gu)) {
    extra += Number(m[1]);
    stripped = stripped.replace(m[0], " ");
  }
  const base = countRooms(stripped, "baño", "baños");
  if (!base && extra === 0) return null;
  return { value: (base?.value ?? 0) + extra, explicit: extra === 0 && (base?.explicit ?? false) };
}

export function countParking(text: string): Count | null {
  const t = text.toLowerCase();
  const forVehicles = /para\s+(\d{1,2})\s+(veh[ií]culos|autos|carros)/u.exec(t);
  if (forVehicles) return { value: Number(forVehicles[1]), explicit: true };
  const explicit = /(?<![\p{L}\d])(\d{1,2})\s+(parqueaderos|estacionamientos|garajes)(?!\p{L})/u.exec(t);
  if (explicit) return { value: Number(explicit[1]), explicit: true };
  const pair = /(parqueadero|estacionamiento)s?\s+(?:#\s*)?\d+\s+y\s+\d+/u.exec(t);
  if (pair) return { value: 2, explicit: false };
  const loose = t.match(/(?<!\p{L})(parqueadero|estacionamiento|garaje)(?!\p{L})/gu);
  if (loose) return { value: loose.length, explicit: false };
  return null;
}

const AMENITIES: [RegExp, string][] = [
  [/piscina/i, "Piscina"],
  [/terraza/i, "Terraza"],
  [/patio/i, "Patio"],
  [/jard[ií]n/i, "Jardín"],
  [/[áa]reas?\s+(verdes?|comunal(es)?)/i, "Áreas comunales"],
  [/walking\s+closet|walk-in/i, "Walk-in closet"],
  [/lavander[ií]a/i, "Lavandería"],
  [/estudio/i, "Estudio"],
  [/mezzanine/i, "Mezzanine"],
  [/cerramiento/i, "Cerramiento"],
  [/bbq|parrilla/i, "BBQ"],
  [/ascensor/i, "Ascensor"],
  [/guardian[ií]a|seguridad\s+24/i, "Seguridad"],
  [/garaje|parqueadero|estacionamiento/i, "Parqueadero"],
  [/bodega/i, "Bodega"],
  [/riego/i, "Sistema de riego"],
  [/vivienda\s+de\s+cuidador/i, "Vivienda de cuidador"],
];

export function detectAmenities(text: string): string[] {
  return AMENITIES.filter(([re]) => re.test(text)).map(([, label]) => label);
}

/* ───────────── Location ───────────── */

const NAME = "([\\p{Lu}\"“][\\p{L}\\d .'’\"“”-]{1,60}?)";
const END = "(?=\\s*(?:[,.;:()]|\\s+(?:de\\s+la\\s+parroquia|del\\s+cant[oó]n|cant[oó]n|provincia)\\b|$))";

function firstName(text: string, label: string): string | null {
  // With the "i" flag \p{Lu} also matches lowercase, so the proper-noun check is done afterwards.
  for (const m of text.matchAll(new RegExp(`(?<!\\p{L})${label}\\s+(?:de\\s+)?${NAME}${END}`, "giu"))) {
    const v = m[1]?.replace(/["“”]/g, "").replace(/^(urbana|rural)\s+/i, "").trim();
    if (v && /^\p{Lu}/u.test(v)) return v;
  }
  return null;
}

export function findCanton(text: string): string | null {
  return firstName(text, "cant[oó]n");
}

export function findProvince(text: string): string | null {
  const m = /provincia\s+(?:de(?:l)?\s+)?([\p{L} ]{3,40}?)(?=\s*[,.;]|\s*$)/iu.exec(text);
  return canonicalProvince(m?.[1]?.trim());
}

/** Sector, in priority order: Sector > parroquia (≠ city) > balneario > barrio > urbanización/lotización > cdla > recinto. */
export function findSector(text: string, city: string | null): string | null {
  const labels = ["sector", "parroquia", "balneario", "barrio", "urbanizaci[oó]n", "lotizaci[oó]n", "cdla\\.?", "ciudadela", "recinto"];
  for (const label of labels) {
    const v = firstName(text, label);
    if (!v) continue;
    if (city && normKey(v) === normKey(city)) continue;
    if (/^(conjunto|residencial)\b/i.test(v)) continue;
    return titleCaseEs(v);
  }
  return null;
}

/* ───────────── Privacy scrubbing ───────────── */

const PHONE_RE = /(?:\+?593[\s-]?)?(?<!\d)0\d{8,9}(?!\d)|(?<!\d)0\d[\s-]\d{3}[\s-]\d{4}(?!\d)|\bext\.?\s*\d+/giu;
const EMAIL_RE = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const BOUNDARY_RE = /(?<!\p{L})(al\s+)?(norte|sur|este|oeste)\s*:/iu;

export type ScrubContext = { names: string[]; codes: string[] };

/** Removes phones, e-mails, third-party names and cadastral codes. Returns null if nothing meaningful is left. */
export function scrubText(input: string | null, ctx: ScrubContext): string | null {
  if (!input) return null;
  if (BOUNDARY_RE.test(input)) {
    input = input
      .split(/(?<=[.;])\s+/)
      .filter((s) => !BOUNDARY_RE.test(s))
      .join(" ");
  }
  let out = input.replace(PHONE_RE, " ").replace(EMAIL_RE, " ");
  for (const n of ctx.names) if (n.length > 3) out = out.replace(new RegExp(escapeRe(n), "giu"), " ");
  for (const c of ctx.codes) if (c.length >= 6) out = out.split(c).join(" ");
  out = collapseSpaces(out).replace(/^[,;:\-–\s]+|[,;:\-–\s]+$/g, "");
  return /\p{L}{2,}/u.test(out) ? out : null;
}

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function ucFirst(s: string): string {
  return s.charAt(0).toLocaleUpperCase("es") + s.slice(1);
}
