import Image from "next/image";
import { isUnsizedSource } from "@/lib/image-loader";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MoreLink } from "@/components/ui/MoreLink";
import { Price } from "@/components/ui/Price";
import { Reveal } from "@/components/ui/Reveal";
import { OPERATION_LABEL, formatLocation, keyFacts } from "./format";
import type { PublicProperty } from "./types";

type PropertySpotlightProps = {
  property: PublicProperty;
  href: string;
  bookingHref: string;
  bookingLabel?: string;
};

/**
 * Product-page style presentation of one property on a dark full-bleed band: on wide screens
 * the photo stays pinned while the facts scroll past it, slowly zooming out as you read.
 * Everything shown comes from the listing; missing fields are simply left out.
 */
export function PropertySpotlight({ property: p, href, bookingHref, bookingLabel = "Agenda una visita" }: PropertySpotlightProps) {
  const facts = keyFacts(p);
  const location = formatLocation(p);
  const highlights = p.highlights.slice(0, 4);

  return (
    <section aria-labelledby="spotlight-title" className="spotlight bg-night text-white">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:grid lg:grid-cols-12 lg:gap-16 lg:px-12 lg:py-0">
        <div className="lg:sticky lg:top-13 lg:col-span-7 lg:flex lg:h-[calc(100svh-3.25rem)] lg:items-center lg:self-start">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-ink lg:aspect-[5/4]">
            {p.cover ? (
              <Image
                src={p.cover.src}
                unoptimized={isUnsizedSource(p.cover.src)}
                alt={p.cover.alt}
                fill
                sizes="(min-width: 1280px) 720px, (min-width: 1024px) 55vw, 100vw"
                placeholder={p.cover.blurDataUrl ? "blur" : "empty"}
                blurDataURL={p.cover.blurDataUrl}
                className="spotlight-media object-cover"
              />
            ) : null}
            <Badge status={p.status} overlay className="absolute top-5 left-5" />
          </div>
        </div>

        <div className="lg:col-span-5">
          <Step>
            <p className="text-eyebrow text-clay-bright">
              Propiedad destacada · {p.propertyType} en {OPERATION_LABEL[p.operation].toLowerCase()}
            </p>
            <h2 id="spotlight-title" className="mt-3 font-display text-display-lg text-balance">
              {p.title}
            </h2>
            {location ? <p className="mt-4 text-lead text-paper-muted">{location}</p> : null}
          </Step>

          {facts.length > 0 ? (
            <Step>
              <h3 className="sr-only">Datos principales</h3>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-10">
                {facts.map((f) => (
                  <div key={f.label} className="flex flex-col-reverse gap-1">
                    <dt className="text-[0.9375rem] text-paper-muted">{f.label}</dt>
                    <dd className="font-display text-display-lg leading-none">
                      {f.value}
                      {f.unit ? <span className="ml-1 text-headline text-paper-muted">{f.unit}</span> : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </Step>
          ) : null}

          {highlights.length > 0 ? (
            <Step>
              <h3 className="text-eyebrow text-clay-bright">Lo que la distingue</h3>
              <ul className="mt-5 flex flex-col gap-4">
                {highlights.map((h) => (
                  <li key={h} className="font-display text-display-md text-balance">
                    {h}
                  </li>
                ))}
              </ul>
            </Step>
          ) : null}

          <Step last>
            <p className="text-[0.9375rem] text-paper-muted">{p.operation === "rent" ? "Alquiler mensual" : "Precio"}</p>
            <Price amount={p.price} priceKind={p.priceKind} tone="dark" className="mt-1 block font-display text-display-md" />
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
              <Button href={href} variant="inverse" size="lg">
                Ver la propiedad
              </Button>
              <MoreLink href={bookingHref} tone="dark" size="lg">
                {bookingLabel}
              </MoreLink>
            </div>
          </Step>
        </div>
      </div>
    </section>
  );
}

function Step({ children, last = false }: { children: ReactNode; last?: boolean }) {
  return (
    <div className={last ? "pt-12 lg:flex lg:min-h-[70svh] lg:items-center lg:pt-0" : "pt-12 lg:flex lg:min-h-[85svh] lg:items-center lg:pt-0"}>
      <Reveal className="w-full">{children}</Reveal>
    </div>
  );
}
