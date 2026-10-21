import Image from "next/image";
import { isUnsizedSource } from "@/lib/image-loader";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { Price } from "@/components/ui/Price";
import { OPERATION_LABEL, formatArea, formatLocation, formatNumber } from "./format";
import type { PublicProperty } from "./types";

type PropertyCardProps = {
  property: PublicProperty;
  href: string;
  /** Larger photo and title for the lead item of a layout. */
  feature?: boolean;
  headingLevel?: 2 | 3;
  /** Pass true for the card most likely to be the Largest Contentful Paint. */
  preload?: boolean;
  sizes?: string;
  /** Tile color: white on sand sections (default), sand on white pages. */
  surface?: "white" | "sand";
  className?: string;
};

/**
 * Property tile: rounded card, photo on top, text below. Lifts and slowly zooms the photo on hover.
 * The title link is stretched over the whole tile, so there is one tab stop per property.
 */
export function PropertyCard({
  property: p,
  href,
  feature = false,
  headingLevel = 3,
  preload = false,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  surface = "white",
  className,
}: PropertyCardProps) {
  const Heading = `h${headingLevel}` as const;
  const location = formatLocation(p);
  const figures = [
    p.builtArea !== null ? formatArea(p.builtArea) : p.landArea !== null ? formatArea(p.landArea) : null,
    p.bedrooms !== null ? `${formatNumber(p.bedrooms)} dorm.` : null,
    p.bathrooms !== null ? `${formatNumber(p.bathrooms)} ${p.bathrooms === 1 ? "baño" : "baños"}` : null,
  ].filter((f): f is string => f !== null);

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-md",
        "transition-[transform,box-shadow] duration-500 ease-apple hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgb(0_0_0/0.28)]",
        "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-4 has-[a:focus-visible]:outline-navy",
        surface === "white" ? "bg-white" : "bg-sand",
        className,
      )}
    >
      <div className={cn("relative overflow-hidden bg-mist", feature ? "aspect-[4/3] lg:aspect-[16/11]" : "aspect-[4/3]")}>
        {p.cover ? (
          <Image
            src={p.cover.src}
            unoptimized={isUnsizedSource(p.cover.src)}
            alt={p.cover.alt}
            fill
            sizes={sizes}
            loading={preload ? "eager" : "lazy"}
            fetchPriority={preload ? "high" : undefined}
            placeholder={p.cover.blurDataUrl ? "blur" : "empty"}
            blurDataURL={p.cover.blurDataUrl}
            className="object-cover transition-transform duration-[1200ms] ease-apple group-hover:scale-[1.05]"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted">Fotos próximamente</span>
        )}
        <Badge status={p.status} overlay className="absolute top-4 left-4" />
      </div>

      <div className={cn("flex flex-1 flex-col", feature ? "p-6 sm:p-8" : "p-5 sm:p-6")}>
        <p className="text-[0.8125rem] font-semibold text-clay">
          {p.propertyType} · {OPERATION_LABEL[p.operation]}
        </p>
        <Heading className={cn("mt-1.5 text-balance text-ink", feature ? "font-display text-display-md" : "text-headline")}>
          <Link href={href} className="focus-visible:outline-none after:absolute after:inset-0 after:content-['']">
            {p.title}
          </Link>
        </Heading>
        {location ? <p className="mt-1 text-[0.9375rem] text-ink-muted">{location}</p> : null}

        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
          <div className="min-w-0">
            <Price amount={p.price} priceKind={p.priceKind} className={cn("block font-semibold", feature ? "text-xl" : "text-lg")} />
            {figures.length > 0 ? <p className="mt-0.5 text-sm text-ink-muted">{figures.join(" · ")}</p> : null}
          </div>
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ink transition-colors duration-300 ease-apple group-hover:bg-navy group-hover:text-white",
              surface === "white" ? "bg-sand" : "bg-white",
            )}
          >
            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 5l5 5-5 5" />
            </svg>
          </span>
        </div>
      </div>
    </article>
  );
}
