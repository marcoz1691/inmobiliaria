import { normKey } from "./text";
import type { DuplicateMatch, ExistingProperty, ExtractedListing } from "./types";

/** Minimum score for a property to be reported as a possible duplicate. */
export const DUPLICATE_THRESHOLD = 0.5;

const STOPWORDS = new Set([
  "de", "del", "la", "las", "el", "los", "y", "e", "en", "a", "al", "con", "entre", "calle", "av", "avenida",
  "canton", "provincia", "parroquia", "sector", "no", "n", "s", "sn", "ubicado", "ubicada",
]);

export function addressTokens(s: string | null): Set<string> {
  if (!s) return new Set();
  return new Set(
    normKey(s)
      .split(" ")
      .filter((t) => t.length > 0 && !STOPWORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function within(a: number | null, b: number | null, tolerance: number): boolean {
  if (a === null || b === null || a <= 0 || b <= 0) return false;
  return Math.abs(a - b) / Math.max(a, b) <= tolerance;
}

/**
 * Scores existing properties against an extracted draft.
 * Signals: normalised address (token Jaccard), city, land/built area within ±2 %, price within ±1 %.
 * A different city (both known) rules the candidate out.
 */
export function findDuplicates(listing: ExtractedListing, existing: ExistingProperty[]): DuplicateMatch[] {
  const addr = addressTokens(listing.address);
  const title = addressTokens(listing.title);
  const city = listing.city ? normKey(listing.city) : null;

  const matches: DuplicateMatch[] = [];
  for (const p of existing) {
    const pCity = p.city ? normKey(p.city) : null;
    if (city && pCity && city !== pCity) continue;

    let score = 0;
    const reasons: string[] = [];

    const addrSim = jaccard(addr, addressTokens(p.address));
    if (addrSim >= 0.99) {
      score += 0.45;
      reasons.push("Misma dirección");
    } else if (addrSim >= 0.6) {
      score += 0.35;
      reasons.push(`Dirección similar (${Math.round(addrSim * 100)} %)`);
    }
    if (city && pCity) {
      score += 0.1;
      reasons.push("Misma ciudad");
    }
    if (within(listing.landArea, p.landArea, 0.02)) {
      score += 0.2;
      reasons.push("Área de terreno igual (±2 %)");
    }
    if (within(listing.builtArea, p.builtArea, 0.02)) {
      score += 0.2;
      reasons.push("Área de construcción igual (±2 %)");
    }
    if (within(listing.price, p.price, 0.01)) {
      score += 0.15;
      reasons.push("Mismo precio");
    }
    const titleSim = jaccard(title, addressTokens(p.title));
    if (titleSim >= 0.6) {
      score += 0.1;
      reasons.push("Título similar");
    }

    score = Math.min(1, Math.round(score * 100) / 100);
    if (score >= DUPLICATE_THRESHOLD) matches.push({ id: p.id, score, reasons });
  }
  return matches.sort((a, b) => b.score - a.score);
}
