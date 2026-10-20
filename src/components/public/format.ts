import type { PropertyOperation, PublicProperty } from "./types";

const decimal = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 1 });

export function formatNumber(n: number): string {
  return decimal.format(n);
}

export function formatArea(m2: number): string {
  return `${decimal.format(m2)} m²`;
}

export const OPERATION_LABEL: Record<PropertyOperation, string> = {
  sale: "Venta",
  rent: "Alquiler",
};

/** "Cumbayá, Quito" or just the city. Public location is approximate by design. */
export function formatLocation(p: Pick<PublicProperty, "city" | "sector">): string {
  return [p.sector, p.city].filter(Boolean).join(", ");
}

export type Fact = { label: string; value: string; unit?: string };

/** Key figures in a fixed order; missing values are skipped, never guessed. */
export function keyFacts(
  p: Pick<PublicProperty, "landArea" | "builtArea" | "bedrooms" | "bathrooms" | "parking">,
): Fact[] {
  const n = (v: number) => decimal.format(v);
  const facts: Fact[] = [];
  if (p.builtArea !== null) facts.push({ label: "Construcción", value: n(p.builtArea), unit: "m²" });
  if (p.landArea !== null) facts.push({ label: "Terreno", value: n(p.landArea), unit: "m²" });
  if (p.bedrooms !== null) facts.push({ label: p.bedrooms === 1 ? "Dormitorio" : "Dormitorios", value: n(p.bedrooms) });
  if (p.bathrooms !== null) facts.push({ label: p.bathrooms === 1 ? "Baño" : "Baños", value: n(p.bathrooms) });
  if (p.parking !== null) facts.push({ label: p.parking === 1 ? "Parqueadero" : "Parqueaderos", value: n(p.parking) });
  return facts;
}
