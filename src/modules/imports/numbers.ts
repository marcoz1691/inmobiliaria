/**
 * Number parsing for Ecuadorian / mixed-locale real-estate documents.
 *
 * The same PDF can mix "$52.290,00" (es-EC) and "US$110,000" / "$160,000.00" (en-US).
 * Every parser returns `ambiguous: true` when the reading depends on a guess, so callers
 * can downgrade the field confidence to "low" instead of silently trusting it.
 */

export type ParsedNumber = { value: number; ambiguous: boolean };

/** Parses a bare number written with either "." or "," as thousands/decimal separator. */
export function parseLocaleNumber(raw: string, opts: { money?: boolean } = {}): ParsedNumber | null {
  const s = raw.replace(/[^\d.,]/g, "").replace(/^[.,]+|[.,]+$/g, "");
  if (!/\d/.test(s)) return null;

  const dots = (s.match(/\./g) ?? []).length;
  const commas = (s.match(/,/g) ?? []).length;

  if (dots === 0 && commas === 0) return { value: Number(s), ambiguous: false };

  if (dots > 0 && commas > 0) {
    // Mixed: the right-most separator is the decimal one.
    const decSep = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    const thouSep = decSep === "." ? "," : ".";
    const [intRaw = "", decRaw = ""] = splitLast(s, decSep);
    const groups = intRaw.split(thouSep);
    const wellFormed =
      !intRaw.includes(decSep) && groups.slice(1).every((g) => g.length === 3) && (groups[0]?.length ?? 0) <= 3;
    return { value: Number(`${groups.join("")}.${decRaw}`), ambiguous: !wellFormed };
  }

  const sep = dots > 0 ? "." : ",";
  const parts = s.split(sep);
  if (parts.length > 2) {
    const tail = parts.slice(1);
    if (tail.every((p) => p.length === 3)) return { value: Number(parts.join("")), ambiguous: false };
    // e.g. "16,617,00": treat the last group as decimals but flag it.
    const last = parts.pop() ?? "";
    return { value: Number(`${parts.join("")}.${last}`), ambiguous: true };
  }

  const [intPart = "", tail = ""] = parts;
  if (tail.length === 3 && intPart !== "0") {
    // "110,000" / "5.210": thousands separator. For money it is unambiguous (cents have 2 digits).
    return { value: Number(intPart + tail), ambiguous: !opts.money };
  }
  return { value: Number(`${intPart}.${tail}`), ambiguous: false };
}

function splitLast(s: string, sep: string): [string, string] {
  const i = s.lastIndexOf(sep);
  return [s.slice(0, i), s.slice(i + 1)];
}

const MONEY_RE = /(?:US\s?\$|USD\s?\$?|\$)\s*\.?\s*(\d[\d.,]*\d|\d)/i;

/** Finds the first money amount in a string ("US$110,000", "$ 1.350.700,00", "Valor $. 120.000,00"). */
export function parseMoney(raw: string): ParsedNumber | null {
  const m = MONEY_RE.exec(raw);
  if (!m?.[1]) return null;
  return parseLocaleNumber(m[1], { money: true });
}

export function hasMoney(raw: string): boolean {
  return MONEY_RE.test(raw);
}

const AREA_RE = /(?<![\d.,])(\d[\d.,]*\d|\d)\s*(m2|m²|mts2?|metros\s+cuadrados|hect[aá]reas?|has?)(?![\p{L}\d])/iu;

/** Parses the first "number + unit" area in square metres; hectares are converted. */
export function parseArea(raw: string): ParsedNumber | null {
  const m = AREA_RE.exec(raw);
  if (!m?.[1] || !m[2]) return null;
  const n = parseLocaleNumber(m[1]);
  if (!n) return null;
  const isHectare = /^h/i.test(m[2]);
  return { value: round2(isHectare ? n.value * 10_000 : n.value), ambiguous: n.ambiguous };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Parses a decimal-degree coordinate. Any leading minus-like character (-, −, –, "--")
 * means negative. Returns null when no number is present.
 */
export function parseCoordinate(raw: string): number | null {
  const m = /([-−–‐]*)\s*(\d{1,3}(?:[.,]\d+)?)/.exec(raw);
  if (!m?.[2]) return null;
  const value = Number(m[2].replace(",", "."));
  if (!Number.isFinite(value)) return null;
  return (m[1] ?? "").length > 0 ? -value : value;
}

/** Mainland Ecuador + Galápagos bounding box. */
export const ECUADOR_BOUNDS = { minLat: -5.1, maxLat: 1.7, minLng: -92.1, maxLng: -75.1 } as const;
