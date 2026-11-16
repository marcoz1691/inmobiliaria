import { catalogFiltersSchema, type CatalogFilters } from "@/modules/properties/domain";
import { landingPath } from "@/modules/properties/landing";

type RawParams = Record<string, string | string[] | undefined>;

const KEYS = ["operation", "type", "q", "province", "city", "minPrice", "maxPrice", "bedrooms", "bathrooms", "minArea", "sort", "page"] as const;

/**
 * URL → validated filters. Empty fields are dropped first: `z.coerce.number()` would turn
 * `maxPrice=` into 0 and hide every listing. Invalid values are ignored (schema `.catch`).
 */
export function parseCatalogParams(raw: RawParams): CatalogFilters {
  const clean: Record<string, string> = {};
  for (const key of KEYS) {
    const v = raw[key];
    const value = (Array.isArray(v) ? v[0] : v)?.trim();
    if (value) clean[key] = value;
  }
  const parsed = catalogFiltersSchema.parse(clean);
  return Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined)) as CatalogFilters;
}

/** Filters → query string (without "?"), skipping defaults; `page` 1 is omitted. */
export function catalogQuery(f: CatalogFilters, overrides: Partial<CatalogFilters> = {}): string {
  const merged = { ...f, ...overrides };
  const params = new URLSearchParams();
  for (const key of KEYS) {
    const v = merged[key];
    if (v === undefined || v === null || v === "") continue;
    if (key === "page" && v === 1) continue;
    params.set(key, String(v));
  }
  return params.toString();
}

/** True when any filter (other than sort and page) narrows the results. */
export function hasActiveFilters(f: CatalogFilters): boolean {
  return KEYS.some((k) => k !== "sort" && k !== "page" && f[k] !== undefined);
}

const LANDING_KEYS = new Set<string>(["operation", "type", "city", "page"]);

/** True when the filters are exactly what a landing page expresses: an operation, optionally a type and a city. */
export function isLandingShaped(f: CatalogFilters): boolean {
  return f.operation !== undefined && KEYS.every((k) => f[k] === undefined || LANDING_KEYS.has(k));
}

/**
 * Address of a filtered catalog. Combinations people search for ("casas en venta en Quito") get
 * their clean, indexable path; anything narrower stays a query string on /propiedades.
 */
export function catalogUrl(f: CatalogFilters, overrides: Partial<CatalogFilters> = {}): string {
  const merged = { ...f, ...overrides };
  if (isLandingShaped(merged)) {
    const path = landingPath({ operation: merged.operation!, type: merged.type, city: merged.city });
    return merged.page && merged.page > 1 ? `${path}?page=${merged.page}` : path;
  }
  const qs = catalogQuery(merged);
  return qs ? `/propiedades?${qs}` : "/propiedades";
}
