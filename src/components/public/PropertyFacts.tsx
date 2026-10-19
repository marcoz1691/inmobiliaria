import { useId } from "react";
import { cn } from "@/components/ui/cn";
import { keyFacts } from "./format";
import type { PublicProperty } from "./types";

type PropertyFactsProps = {
  property: Pick<
    PublicProperty,
    "landArea" | "builtArea" | "bedrooms" | "bathrooms" | "parking" | "amenities" | "highlights"
  >;
  headingLevel?: 2 | 3;
  className?: string;
};

/**
 * Spec-sheet layout: key figures set large on a hairline grid, highlights as short prose
 * lines, amenities as a ruled two-column list. No boxes, no icon tiles.
 */
export function PropertyFacts({ property, headingLevel = 2, className }: PropertyFactsProps) {
  const Heading = `h${headingLevel}` as const;
  const id = useId();
  const facts = keyFacts(property);
  const { highlights, amenities } = property;

  return (
    <div className={cn("flex flex-col gap-12", className)}>
      {facts.length > 0 ? (
        <section aria-labelledby={`${id}-key`}>
          <Heading id={`${id}-key`} className="sr-only">
            Datos principales
          </Heading>
          <dl className="grid grid-cols-3 border-t border-ink lg:grid-cols-5">
            {facts.map((f) => (
              <div key={f.label} className="flex flex-col-reverse gap-1 border-b border-line py-4 pr-4">
                <dt className="text-sm text-ink-muted">{f.label}</dt>
                <dd className="font-display text-2xl leading-none text-ink sm:text-3xl">
                  {f.value}
                  {f.unit ? <span className="ml-1 font-sans text-base text-ink-muted">{f.unit}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {highlights.length > 0 ? (
        <section aria-labelledby={`${id}-highlights`}>
          <Heading id={`${id}-highlights`} className="text-eyebrow font-medium text-clay uppercase">
            Lo que la distingue
          </Heading>
          <ul className="mt-4 flex flex-col gap-3">
            {highlights.map((h) => (
              <li key={h} className="flex gap-4 font-display text-xl leading-snug text-ink text-pretty">
                <span aria-hidden="true" className="mt-[0.7em] h-px w-5 shrink-0 bg-clay" />
                {h}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {amenities.length > 0 ? (
        <section aria-labelledby={`${id}-amenities`}>
          <Heading id={`${id}-amenities`} className="text-eyebrow font-medium text-clay uppercase">
            Amenidades
          </Heading>
          <ul className="mt-4 grid border-t border-line sm:grid-cols-2 sm:gap-x-10">
            {amenities.map((a) => (
              <li key={a} className="border-b border-line py-3 text-base text-ink">
                {a}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
