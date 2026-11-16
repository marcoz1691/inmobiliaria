import { findCanton, findProvince, getCanton } from "@/modules/geo/ecuador";
import { OPERATIONS, PROPERTY_TYPES, slugify, type Operation, type PropertyType } from "./domain";

/**
 * Search landing pages: "/venta/casas/quito" is the indexable address of "casas en venta en Quito".
 * Pure helpers shared by routes, sitemap, links and tests. Nothing here invents inventory: pages
 * and links are only built from facets that exist in the catalog.
 */

export const OPERATION_SLUG: Record<Operation, string> = { sale: "venta", rent: "alquiler" };

export const TYPE_SLUG: Record<PropertyType, string> = {
  house: "casas",
  apartment: "departamentos",
  land: "terrenos",
  office: "oficinas",
  commercial: "locales-comerciales",
  warehouse: "bodegas",
  building: "edificios",
  other: "otros",
};

export const TYPE_PLURAL: Record<PropertyType, string> = {
  house: "Casas",
  apartment: "Departamentos",
  land: "Terrenos",
  office: "Oficinas",
  commercial: "Locales comerciales",
  warehouse: "Bodegas",
  building: "Edificios",
  other: "Otras propiedades",
};

/** Path segment that stands for "any type" when a city follows: /venta/propiedades/quito. */
export const ALL_TYPES_SLUG = "propiedades";

export type Landing = { operation: Operation; type?: PropertyType; city?: string };

/** One row of `listCatalogFacets`: how many live listings share operation, type, city and province (as typed). */
export type Facet = { operation: Operation; type: PropertyType; city: string; province: string | null; count: number };

export type CityOption = { slug: string; label: string; count: number };

export const citySlug = (city: string) => slugify(city);

/**
 * Canonical place of a listing's free-text city: the canton's slug when the text names one
 * ("Quito", "Sangolquí" → "ruminahui"), otherwise the slug of the text itself ("Cumbayá").
 */
export function placeSlug(city: string, province?: string | null): string {
  return findCanton(city, province)?.slug ?? citySlug(city);
}

/** Province slug of a listing: the one typed, or the province of its canton. */
export function provinceSlug(city: string | null, province?: string | null): string | null {
  return findProvince(province)?.slug ?? (city ? (findCanton(city, province)?.province.slug ?? null) : null);
}

/** Whether a listing's place matches a city and/or province filter (both slugs). */
export function matchesPlace(row: { city: string | null; province: string | null }, f: { city?: string; province?: string }): boolean {
  if (f.city && (!row.city || placeSlug(row.city, row.province) !== f.city)) return false;
  if (f.province && provinceSlug(row.city, row.province) !== f.province) return false;
  return true;
}

/** Display name of a city slug: the canton's name, or the agents' most used spelling. */
export function placeName(slug: string, facets: Facet[] = []): string | undefined {
  return getCanton(slug)?.name ?? facetCities(facets).find((c) => c.slug === slug)?.label;
}

export function landingPath(l: Landing): string {
  const parts = [OPERATION_SLUG[l.operation]];
  if (l.type || l.city) parts.push(l.type ? TYPE_SLUG[l.type] : ALL_TYPES_SLUG);
  if (l.city) parts.push(citySlug(l.city));
  return `/${parts.join("/")}`;
}

/** "Casas en venta en Quito". `cityLabel` is the spelling the agent used, not the slug. */
export function landingTitle(l: Landing, cityLabel?: string): string {
  const what = l.type ? TYPE_PLURAL[l.type] : "Propiedades";
  const how = l.operation === "sale" ? "en venta" : "en alquiler";
  return `${what} ${how}${cityLabel ? ` en ${cityLabel}` : ""}`;
}

/** Same as `landingTitle` for use mid-sentence: "casas en venta en Quito" (the city keeps its capital). */
export function landingPhrase(l: Landing, cityLabel?: string): string {
  const title = landingTitle(l, cityLabel);
  return title.charAt(0).toLowerCase() + title.slice(1);
}

/**
 * Path segments after the operation → landing, or null when the address is not canonical
 * (unknown type, more than two segments, "/venta/propiedades" without a city).
 * The city is returned as a slug; whether it exists is decided against the catalog.
 */
export function parseLanding(operation: Operation, segments: string[] = []): Landing | null {
  if (segments.length > 2) return null;
  const [typeSeg, citySeg] = segments;
  if (typeSeg === undefined) return { operation };
  const type = PROPERTY_TYPES.find((t) => TYPE_SLUG[t] === typeSeg);
  if (!type && typeSeg !== ALL_TYPES_SLUG) return null;
  if (!type && citySeg === undefined) return null;
  if (citySeg !== undefined && (citySeg === "" || citySlug(citySeg) !== citySeg)) return null;
  return { operation, ...(type ? { type } : {}), ...(citySeg ? { city: citySeg } : {}) };
}

/** Cities with live listings, merged by slug ("Quito" and "quito" are one place), busiest first. */
export function facetCities(facets: Facet[], filter: Partial<Pick<Facet, "operation" | "type">> = {}): CityOption[] {
  const bySlug = new Map<string, { labels: Map<string, number>; count: number }>();
  for (const f of facets) {
    if (filter.operation && f.operation !== filter.operation) continue;
    if (filter.type && f.type !== filter.type) continue;
    const slug = placeSlug(f.city, f.province);
    const entry = bySlug.get(slug) ?? { labels: new Map(), count: 0 };
    entry.count += f.count;
    entry.labels.set(f.city, (entry.labels.get(f.city) ?? 0) + f.count);
    bySlug.set(slug, entry);
  }
  return [...bySlug.entries()]
    .map(([slug, e]) => ({ slug, count: e.count, label: getCanton(slug)?.name ?? [...e.labels.entries()].sort((a, b) => b[1] - a[1])[0]![0] }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

/** Live listings per type, optionally within one operation and/or city slug. Types without stock are omitted. */
export function facetTypes(facets: Facet[], filter: { operation?: Operation; city?: string } = {}): { type: PropertyType; count: number }[] {
  const counts = new Map<PropertyType, number>();
  for (const f of facets) {
    if (filter.operation && f.operation !== filter.operation) continue;
    if (filter.city && placeSlug(f.city, f.province) !== filter.city) continue;
    counts.set(f.type, (counts.get(f.type) ?? 0) + f.count);
  }
  return PROPERTY_TYPES.filter((t) => counts.has(t)).map((type) => ({ type, count: counts.get(type)! }));
}

export function facetCount(facets: Facet[], l: Partial<Landing>): number {
  return facets.reduce(
    (n, f) =>
      (!l.operation || f.operation === l.operation) && (!l.type || f.type === l.type) && (!l.city || placeSlug(f.city, f.province) === l.city)
        ? n + f.count
        : n,
    0,
  );
}

export type LandingLink = Landing & { href: string; label: string; count: number };

/**
 * Every landing page that has at least one live listing: operation, operation + type,
 * and both of those per city. This is the list the sitemap publishes.
 */
export function landingLinks(facets: Facet[]): LandingLink[] {
  const cities = facetCities(facets);
  const out: LandingLink[] = [];
  const push = (l: Landing, cityLabel?: string) => {
    const count = facetCount(facets, l);
    if (count > 0) out.push({ ...l, href: landingPath(l), label: landingTitle(l, cityLabel), count });
  };
  for (const operation of OPERATIONS) {
    push({ operation });
    for (const { type } of facetTypes(facets, { operation })) push({ operation, type });
    for (const c of cities) {
      push({ operation, city: c.slug }, c.label);
      for (const { type } of facetTypes(facets, { operation, city: c.slug })) push({ operation, type, city: c.slug }, c.label);
    }
  }
  return out;
}

/** "Casas en venta", "Departamentos en alquiler"… ordered by stock: the entry points worth showing in navigation. */
export function topCategories(facets: Facet[], limit = 8): LandingLink[] {
  return landingLinks(facets)
    .filter((l) => l.type && !l.city)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
