import type { PublicListing } from "@/modules/properties/service";
import { TYPE_LABEL, type PropertyStatus as DbStatus } from "@/modules/properties/domain";
import type { PropertyStatus, PublicImage, PublicProperty } from "./types";

/** DB status → public badge. Only statuses a visitor can open reach this function. */
export function publicStatus(status: DbStatus): PropertyStatus {
  if (status === "reserved" || status === "sold" || status === "rented") return status;
  return "available";
}

const image = (i: PublicListing["images"][number]): PublicImage => ({
  src: i.src,
  alt: i.alt,
  width: i.width,
  height: i.height,
  ...(i.blurDataUrl ? { blurDataUrl: i.blurDataUrl } : {}),
});

/** Maps the service's public listing to the shape the presentational components render. */
export function toCardProperty(l: PublicListing): PublicProperty {
  return {
    slug: l.slug,
    title: l.title,
    status: publicStatus(l.status),
    operation: l.operation ?? "sale",
    propertyType: l.propertyType ? TYPE_LABEL[l.propertyType] : "Propiedad",
    price: l.price,
    priceKind: l.priceKind,
    currency: "USD",
    city: l.city,
    sector: l.sector,
    landArea: l.landArea,
    builtArea: l.builtArea,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    parking: l.parking,
    amenities: l.amenities,
    highlights: l.highlights,
    cover: l.cover ? image(l.cover) : null,
    images: l.images.map(image),
  };
}
