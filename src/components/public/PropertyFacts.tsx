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
 * Spec sheet: key figures set large and bold over small labels, highlights as short statements,
 * amenities as chips.
 */
export function PropertyFacts({ property, headingLevel = 2, className }: PropertyFactsProps) {
  const Heading = `h${headingLevel}` as const;
  const id = useId();
  const facts = keyFacts(property);
  const { highlights, amenities } = property;

  return (
    <div className={cn("flex flex-col gap-14", className)}>
      {facts.length > 0 ? (
        <section aria-labelledby={`${id}-key`}>
          <Heading id={`${id}-key`} className="sr-only">
            Datos principales
          </Heading>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 xl:grid-cols-5">
            {facts.map((f) => (
              <div key={f.label} className="flex flex-col-reverse gap-1.5 border-t border-line pt-4">
                <dt className="text-[0.9375rem] text-ink-muted">{f.label}</dt>
                <dd className="font-display text-[2.5rem] leading-none font-bold tracking-[-0.03em] text-ink">
                  {f.value}
                  {f.unit ? <span className="ml-1 text-xl font-semibold tracking-normal text-ink-muted">{f.unit}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {highlights.length > 0 ? (
        <section aria-labelledby={`${id}-highlights`}>
          <Heading id={`${id}-highlights`} className="text-eyebrow text-clay">
            Lo que la distingue
          </Heading>
          <ul className="mt-4 flex flex-col gap-3">
            {highlights.map((h) => (
              <li key={h} className="flex gap-3 text-headline text-pretty text-ink">
                <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-1 size-5 shrink-0 text-clay" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m4.5 10.5 3.5 3.5 7.5-8" />
                </svg>
                {h}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {amenities.length > 0 ? (
        <section aria-labelledby={`${id}-amenities`}>
          <Heading id={`${id}-amenities`} className="text-eyebrow text-clay">
            Amenidades
          </Heading>
          <ul className="mt-4 flex flex-wrap gap-2">
            {amenities.map((a) => (
              <li key={a} className="rounded-full bg-sand px-4 py-2.5 text-[0.9375rem] text-ink">
                {a}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
