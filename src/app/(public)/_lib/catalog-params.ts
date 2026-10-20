import { catalogFiltersSchema, type CatalogFilters } from "@/modules/properties/domain";

type RawParams = Record<string, string | string[] | undefined>;

const KEYS = ["operation", "type", "q", "minPrice", "maxPrice", "bedrooms", "bathrooms", "minArea", "sort", "page"] as const;

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
