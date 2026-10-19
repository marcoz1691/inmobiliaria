export type Confidence = "high" | "low" | "missing";
export type ListingField = "title" | "description" | "operation" | "propertyType" | "price" | "priceKind" | "priceNote" | "landArea" | "builtArea" | "bedrooms" | "bathrooms" | "parking" | "address" | "sector" | "city" | "province" | "lat" | "lng" | "amenities" | "highlights";
export type ExtractedListing = {
  title: string | null; description: string | null;
  operation: "sale" | "rent" | null;
  propertyType: "house" | "apartment" | "land" | "office" | "commercial" | "warehouse" | "building" | "other" | null;
  price: number | null; priceKind: "sale" | "rent" | "appraisal"; priceNote: string | null; currency: "USD";
  landArea: number | null; builtArea: number | null; bedrooms: number | null; bathrooms: number | null; parking: number | null;
  address: string | null; sector: string | null; city: string | null; province: string | null;
  lat: number | null; lng: number | null;
  amenities: string[]; highlights: string[];
  confidence: Record<ListingField, Confidence>;
  warnings: string[];
  sourcePages: number[];
  excluded: { cadastralCode: boolean; boundaries: boolean; thirdPartyContacts: boolean };
};
export type ExtractionResult = { fileSha256: string; pageCount: number; text: string; listings: ExtractedListing[]; method: "parser"; needsOcr: boolean; warnings: string[] };
export type ExistingProperty = { id: string; title: string; address: string | null; city: string | null; landArea: number | null; builtArea: number | null; price: number | null };
export type DuplicateMatch = { id: string; score: number; reasons: string[] };
