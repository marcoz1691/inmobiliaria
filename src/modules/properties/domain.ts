import { z } from "zod";

export const PROPERTY_TYPES = ["house", "apartment", "land", "office", "commercial", "warehouse", "building", "other"] as const;
export const OPERATIONS = ["sale", "rent"] as const;
export const STATUSES = ["draft", "published", "paused", "reserved", "sold", "rented", "archived"] as const;
export type PropertyStatus = (typeof STATUSES)[number];
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type Operation = (typeof OPERATIONS)[number];

export const TYPE_LABEL: Record<PropertyType, string> = {
  house: "Casa",
  apartment: "Departamento",
  land: "Terreno",
  office: "Oficina",
  commercial: "Local comercial",
  warehouse: "Bodega",
  building: "Edificio",
  other: "Otro",
};
export const OPERATION_LABEL: Record<Operation, string> = { sale: "Venta", rent: "Alquiler" };
export const STATUS_LABEL: Record<PropertyStatus, string> = {
  draft: "Borrador",
  published: "Publicada",
  paused: "Pausada",
  reserved: "Reservada",
  sold: "Vendida",
  rented: "Alquilada",
  archived: "Archivada",
};

/** Statuses a visitor can open by URL. Catalog lists only `published` and `reserved`. */
export const PUBLIC_STATUSES = ["published", "reserved", "sold", "rented"] as const satisfies readonly PropertyStatus[];
export const CATALOG_STATUSES = ["published", "reserved"] as const satisfies readonly PropertyStatus[];

const TRANSITIONS: Record<PropertyStatus, PropertyStatus[]> = {
  draft: ["published", "archived"],
  published: ["paused", "reserved", "sold", "rented", "archived", "draft"],
  paused: ["published", "archived", "draft"],
  reserved: ["published", "sold", "rented", "archived"],
  sold: ["archived", "published"],
  rented: ["archived", "published"],
  archived: ["draft"],
};

export function canTransition(from: PropertyStatus, to: PropertyStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const optionalNumber = (opts: { min?: number; max?: number; int?: boolean } = {}) => {
  let n = z.number().finite();
  if (opts.int) n = n.int();
  if (opts.min !== undefined) n = n.min(opts.min);
  if (opts.max !== undefined) n = n.max(opts.max);
  return n.nullable().optional();
};

/** Shape accepted by autosave: every field optional, strings trimmed, empties → null. */
export const propertyDraftSchema = z.object({
  title: z.string().trim().max(140).optional(),
  description: optionalText(6000),
  operation: z.enum(OPERATIONS).nullable().optional(),
  propertyType: z.enum(PROPERTY_TYPES).nullable().optional(),
  price: optionalNumber({ min: 0, max: 1_000_000_000 }),
  priceKind: z.enum(["sale", "rent", "appraisal"]).optional(),
  priceNote: optionalText(200),
  landArea: optionalNumber({ min: 0, max: 100_000_000 }),
  builtArea: optionalNumber({ min: 0, max: 1_000_000 }),
  bedrooms: optionalNumber({ min: 0, max: 100, int: true }),
  bathrooms: optionalNumber({ min: 0, max: 100 }),
  parking: optionalNumber({ min: 0, max: 1000, int: true }),
  amenities: z.array(z.string().trim().min(1).max(60)).max(60).optional(),
  highlights: z.array(z.string().trim().min(1).max(160)).max(30).optional(),
  address: optionalText(300),
  sector: optionalText(120),
  city: optionalText(120),
  province: optionalText(120),
  lat: optionalNumber({ min: -90, max: 90 }),
  lng: optionalNumber({ min: -180, max: 180 }),
  locationPrivacy: z.enum(["exact", "approximate", "hidden"]).optional(),
  featured: z.boolean().optional(),
});
export type PropertyDraftInput = z.infer<typeof propertyDraftSchema>;

export type PublishCheckInput = {
  title: string;
  operation: Operation | null;
  propertyType: PropertyType | null;
  price: number | null;
  priceKind: "sale" | "rent" | "appraisal";
  city: string | null;
  needsReview: boolean;
  photoCount: number;
};

/** Human-readable reasons a property cannot be published yet. Empty array = publishable. */
export function publishProblems(p: PublishCheckInput): string[] {
  const problems: string[] = [];
  if (p.title.trim().length < 8) problems.push("Escribe un título de al menos 8 caracteres.");
  if (!p.operation) problems.push("Indica si es venta o alquiler.");
  if (!p.propertyType) problems.push("Elige el tipo de propiedad.");
  if (p.price === null || p.price <= 0) problems.push("Ingresa el precio.");
  if (p.priceKind === "appraisal") problems.push("El precio importado es un avalúo: confirma el precio de venta o alquiler.");
  if (!p.city) problems.push("Indica la ciudad.");
  if (p.photoCount < 1) problems.push("Sube al menos una foto.");
  if (p.needsReview) problems.push("Revisa los datos importados y marca la revisión como completa.");
  return problems;
}

/** Wraps `q` for SQL ILIKE so `%`, `_` and `\` match as literals, not wildcards. */
export function ilikeContains(q: string): string {
  return `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

export function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "propiedad"
  );
}

/** Rounds coordinates to ~1 km so the public map never reveals the exact address. */
export function approximateLocation(lat: number, lng: number): { lat: number; lng: number; radiusMeters: number } {
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100, radiusMeters: 800 };
}

export const catalogFiltersSchema = z.object({
  operation: z.enum(OPERATIONS).optional().catch(undefined),
  type: z.enum(PROPERTY_TYPES).optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
  minPrice: z.coerce.number().min(0).optional().catch(undefined),
  maxPrice: z.coerce.number().min(0).optional().catch(undefined),
  bedrooms: z.coerce.number().int().min(0).max(20).optional().catch(undefined),
  bathrooms: z.coerce.number().min(0).max(20).optional().catch(undefined),
  minArea: z.coerce.number().min(0).optional().catch(undefined),
  sort: z.enum(["recent", "price_asc", "price_desc"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
});
export type CatalogFilters = z.infer<typeof catalogFiltersSchema>;
