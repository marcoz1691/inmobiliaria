import { propertyDraftSchema, type Operation, type PropertyType } from "@/modules/properties/domain";

/** Wizard form state. Numbers stay as typed strings until they are saved. */
export type FormState = {
  title: string;
  propertyType: PropertyType | "";
  operation: Operation | "";
  price: string;
  priceNote: string;
  city: string;
  sector: string;
  province: string;
  description: string;
  builtArea: string;
  landArea: string;
  bedrooms: string;
  bathrooms: string;
  parking: string;
  amenities: string[];
  highlights: string[];
  address: string;
  lat: string;
  lng: string;
  locationPrivacy: "approximate" | "exact" | "hidden";
};

export type FieldName = keyof FormState;

export const NUMERIC_FIELDS = ["price", "builtArea", "landArea", "bedrooms", "bathrooms", "parking", "lat", "lng"] as const satisfies readonly FieldName[];
type NumericField = (typeof NUMERIC_FIELDS)[number];
const isNumeric = (f: FieldName): f is NumericField => (NUMERIC_FIELDS as readonly string[]).includes(f);

export type PropertyLike = {
  title: string;
  propertyType: PropertyType | null;
  operation: Operation | null;
  price: number | null;
  priceNote: string | null;
  city: string | null;
  sector: string | null;
  province: string | null;
  description: string | null;
  builtArea: number | null;
  landArea: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  amenities: string[];
  highlights: string[];
  address: string | null;
  lat: number | null;
  lng: number | null;
  locationPrivacy: "approximate" | "exact" | "hidden";
};

const num = (n: number | null) => (n === null ? "" : String(n));

export function toFormState(p: PropertyLike): FormState {
  return {
    title: p.title,
    propertyType: p.propertyType ?? "",
    operation: p.operation ?? "",
    price: num(p.price),
    priceNote: p.priceNote ?? "",
    city: p.city ?? "",
    sector: p.sector ?? "",
    province: p.province ?? "",
    description: p.description ?? "",
    builtArea: num(p.builtArea),
    landArea: num(p.landArea),
    bedrooms: num(p.bedrooms),
    bathrooms: num(p.bathrooms),
    parking: num(p.parking),
    amenities: p.amenities,
    highlights: p.highlights,
    address: p.address ?? "",
    lat: num(p.lat),
    lng: num(p.lng),
    locationPrivacy: p.locationPrivacy,
  };
}

/**
 * Parses numbers as typed on a phone in Ecuador: "110000", "110.000", "110,000", "1.250,50", "US$ 95.000".
 * Returns NaN when the text is not a number, null when empty.
 */
export function parseNumberInput(raw: string, opts: { coordinate?: boolean } = {}): number | null {
  const s = raw.replace(/us\$|\$|usd|m²|m2|\s/gi, "");
  if (s === "") return null;
  if (opts.coordinate) return /^-?\d{1,3}([.,]\d+)?$/.test(s) ? Number(s.replace(",", ".")) : NaN;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ""));
  if (/^\d+([.,]\d+)?$/.test(s)) return Number(s.replace(",", "."));
  return NaN;
}

const MESSAGES: Partial<Record<FieldName, string>> = {
  price: "Escribe solo el número, por ejemplo 110000.",
  bedrooms: "Usa un número entero, por ejemplo 3.",
  parking: "Usa un número entero, por ejemplo 2.",
  bathrooms: "Usa un número, por ejemplo 2 o 2,5.",
  builtArea: "Escribe los metros cuadrados, por ejemplo 180.",
  landArea: "Escribe los metros cuadrados, por ejemplo 250.",
  lat: "Latitud entre -90 y 90, por ejemplo -0.1807.",
  lng: "Longitud entre -180 y 180, por ejemplo -78.4678.",
};

/** Converts one form field to the autosave payload value, or returns a friendly error. */
export function fieldToPatch(field: FieldName, value: FormState[FieldName]): { ok: true; value: unknown } | { ok: false; error: string } {
  let out: unknown = value;
  if (isNumeric(field)) {
    const n = parseNumberInput(String(value), { coordinate: field === "lat" || field === "lng" });
    if (Number.isNaN(n)) return { ok: false, error: MESSAGES[field] ?? "Número no válido." };
    out = n;
  } else if (field === "propertyType" || field === "operation") {
    out = value === "" ? null : value;
  }
  const shape = propertyDraftSchema.shape as Record<string, { safeParse: (v: unknown) => { success: boolean } }>;
  const check = shape[field]?.safeParse(out);
  if (check && !check.success) return { ok: false, error: MESSAGES[field] ?? "Revisa este dato." };
  return { ok: true, value: out };
}

export const STEPS = [
  { key: "basicos", label: "Básicos" },
  { key: "fotos", label: "Fotos" },
  { key: "detalles", label: "Detalles" },
  { key: "revisar", label: "Revisar y publicar" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];

export function parseStep(v: string | null | undefined): StepKey {
  return (STEPS.find((s) => s.key === v)?.key ?? "basicos") as StepKey;
}

/** Which wizard step fixes each `publishProblems` message. */
export function stepForProblem(problem: string): StepKey {
  if (/foto/i.test(problem)) return "fotos";
  if (/revisi[oó]n/i.test(problem)) return "revisar";
  return "basicos";
}

export const AMENITY_SUGGESTIONS = [
  "Piscina",
  "Jardín",
  "Terraza",
  "Balcón",
  "Gimnasio",
  "Seguridad 24/7",
  "Ascensor",
  "Área BBQ",
  "Cuarto de servicio",
  "Bodega",
  "Áreas verdes",
  "Juegos infantiles",
  "Conjunto cerrado",
  "Amoblado",
  "Estudio",
  "Chimenea",
  "Línea blanca",
  "Generador eléctrico",
  "Cisterna",
  "Vista panorámica",
];
