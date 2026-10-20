/**
 * Minimal public shape of a property, as rendered on the agent's site.
 * Mapped from the database by `toCardProperty` (./listing.ts); keep it free of private fields
 * (owner contacts, cadastral codes, exact boundaries).
 */
export type PropertyStatus = "available" | "reserved" | "sold" | "rented";
export type PropertyOperation = "sale" | "rent";
/** "appraisal" is an internal valuation and must never be shown publicly. */
export type PriceKind = "sale" | "rent" | "appraisal";

export type PublicImage = {
  src: string;
  alt: string;
  /** Tiny base64 image for `placeholder="blur"`. */
  blurDataUrl?: string;
  width?: number;
  height?: number;
};

export type PublicProperty = {
  slug: string;
  title: string;
  status: PropertyStatus;
  operation: PropertyOperation;
  /** Human label, e.g. "Casa", "Departamento", "Terreno". */
  propertyType: string;
  price: number | null;
  priceKind: PriceKind;
  currency: "USD";
  city: string | null;
  sector: string | null;
  /** m² */
  landArea: number | null;
  /** m² */
  builtArea: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  amenities: string[];
  highlights: string[];
  /** Null until the agent uploads a photo. */
  cover: PublicImage | null;
  images: PublicImage[];
};
