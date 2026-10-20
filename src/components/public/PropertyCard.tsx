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
  /** Larger image ratio for a lead item in an editorial layout. */
  feature?: boolean;
  headingLevel?: 2 | 3;
  /** Pass true for cards visible on first paint. */
  preload?: boolean;
  sizes?: string;
  className?: string;
};

/**
 * Property teaser without card chrome: photo, then text on the page background.
 * The title link is stretched over the whole item, so there is one tab stop per property.
 */
export function PropertyCard({
  property: p,
  href,
  feature = false,
  headingLevel = 3,
  preload = false,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  className,
}: PropertyCardProps) {
  const Heading = `h${headingLevel}` as const;
  const figures = [
    p.builtArea !== null ? formatArea(p.builtArea) : p.landArea !== null ? formatArea(p.landArea) : null,
    p.bedrooms !== null ? `${formatNumber(p.bedrooms)} dorm.` : null,
    p.bathrooms !== null ? `${formatNumber(p.bathrooms)} ${p.bathrooms === 1 ? "baño" : "baños"}` : null,
  ].filter((f): f is string => f !== null);

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-sm has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-4 has-[a:focus-visible]:outline-navy",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-sm bg-sand",
          feature ? "aspect-[4/3] lg:aspect-[5/4]" : "aspect-[4/3]",
        )}
      >
        {p.cover ? (
          <Image
            src={p.cover.src}
            unoptimized={isUnsizedSource(p.cover.src)}
            alt={p.cover.alt}
            fill
            sizes={sizes}
            preload={preload}
            placeholder={p.cover.blurDataUrl ? "blur" : "empty"}
            blurDataURL={p.cover.blurDataUrl}
            className="object-cover transition-transform duration-500 ease-out-quart group-hover:scale-[1.03]"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted">Fotos próximamente</span>
        )}
        <Badge status={p.status} className="absolute top-3 left-3" />
      </div>

      <div className="mt-4 flex flex-col">
        <p className="mb-2 text-eyebrow text-ink-muted uppercase">
          {p.propertyType} · {OPERATION_LABEL[p.operation]}
        </p>
        <Heading className={cn("font-display text-ink", feature ? "text-display-md" : "text-xl leading-snug lg:text-2xl")}>
          <Link
            href={href}
            className="decoration-1 focus-visible:outline-none underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-['']"
          >
            {p.title}
          </Link>
        </Heading>
        {formatLocation(p) ? <p className="mt-1 text-sm text-ink-muted">{formatLocation(p)}</p> : null}
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-3">
          <Price amount={p.price} priceKind={p.priceKind} className="text-lg font-semibold text-ink" />
          {figures.length > 0 ? (
            <p className="text-sm text-ink-muted">{figures.join(" · ")}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
