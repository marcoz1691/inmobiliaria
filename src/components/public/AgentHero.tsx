import Image from "next/image";
import { isUnsizedSource } from "@/lib/image-loader";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { MoreLink } from "@/components/ui/MoreLink";
import { WhatsAppButton } from "./WhatsAppButton";

type AgentHeroProps = {
  name: string;
  /** Value proposition, rendered as the page h1. */
  headline: ReactNode;
  /** Real portrait of the agent. Without it the hero is text only (no stand-in image). */
  photoSrc?: string | null;
  photoAlt?: string;
  /** Agent's WhatsApp number; the secondary CTA is omitted without it. */
  whatsapp?: string | null;
  whatsappMessage?: string;
  ctaHref: string;
  ctaLabel?: string;
  /** Small line above the headline, e.g. role and city. */
  eyebrow?: string;
  /** One or two sentences that support the headline. */
  intro?: ReactNode;
  /** Areas the agent covers; shown as a quiet list. */
  areas?: string[];
  /** Short role shown with the name under the photo. */
  role?: string;
  /** Optional text link next to the CTAs, e.g. "Ver propiedades". */
  secondaryHref?: string;
  secondaryLabel?: string;
  /** Property search form, placed right under the headline as the page's main action. */
  search?: ReactNode;
};

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/**
 * Statement and property search first, with the agent's real portrait beside it on wide screens
 * (below it on phones). The portrait settles in on load and drifts inside its frame while scrolling.
 * The h1 is never animated, so it paints immediately (it is the LCP on small screens).
 */
export function AgentHero({
  name,
  headline,
  photoSrc,
  photoAlt,
  whatsapp,
  whatsappMessage,
  ctaHref,
  ctaLabel = "Agenda una cita",
  eyebrow,
  intro,
  areas,
  role,
  secondaryHref,
  secondaryLabel = "Ver propiedades",
  search,
}: AgentHeroProps) {
  const split = Boolean(photoSrc);
  return (
    <section aria-labelledby="hero-title" className="overflow-hidden bg-paper pb-16 lg:pb-24">
      <div
        className={cn(
          "mx-auto px-5 pt-12 sm:px-8 sm:pt-16 lg:pt-20",
          split ? "max-w-7xl lg:grid lg:grid-cols-12 lg:items-center lg:gap-x-12 lg:px-12" : "max-w-5xl",
        )}
      >
        <div className={cn("text-center", split && "lg:col-span-7 lg:text-left")}>
          {eyebrow ? <p className="animate-rise text-eyebrow text-clay">{eyebrow}</p> : null}
          <h1 id="hero-title" className={cn("mt-3 font-display text-display-xl text-balance text-ink", split && "lg:text-display-lg xl:text-[4.5rem]")}>
            {headline}
          </h1>
          {intro ? (
            <div
              className={cn("mx-auto mt-5 max-w-2xl animate-rise text-lead text-pretty text-ink-muted", split && "lg:mx-0")}
              style={delay(120)}
            >
              {intro}
            </div>
          ) : null}
          {search ? (
            <div className="mt-8 animate-rise" style={delay(180)}>
              {search}
            </div>
          ) : null}
          <div
            className={cn(
              "flex animate-rise flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4",
              search ? "mt-6" : "mt-8",
              split && "lg:justify-start",
            )}
            style={delay(220)}
          >
            {/* With a search form above, searching is the primary action; booking steps down to an outline. */}
            <Button href={ctaHref} size="lg" variant={search ? "secondary" : "primary"}>
              {ctaLabel}
            </Button>
            <WhatsAppButton
              phone={whatsapp}
              size="lg"
              message={whatsappMessage ?? `Hola ${name}, vi tu página y quisiera conversar sobre una propiedad.`}
            />
            {secondaryHref ? (
              <MoreLink href={secondaryHref} size="lg" className="px-2">
                {secondaryLabel}
              </MoreLink>
            ) : null}
          </div>
        </div>

        {photoSrc ? (
          <figure className="mx-auto mt-12 max-w-6xl lg:col-span-5 lg:mt-0 lg:w-full">
            <div className="scroll-grow relative mx-auto aspect-[4/5] max-w-[22rem] overflow-hidden rounded-lg bg-sand sm:max-w-[26rem] lg:max-w-none">
              <div className="absolute inset-0 animate-settle">
                <Image
                  src={photoSrc}
                  unoptimized={isUnsizedSource(photoSrc)}
                  alt={photoAlt ?? `Retrato de ${name}`}
                  fill
                  preload
                  sizes="(min-width: 1024px) 36vw, (min-width: 640px) 416px, 352px"
                  className="scroll-parallax object-cover object-top"
                />
              </div>
            </div>
            <figcaption className="mt-5 text-center text-[0.9375rem] text-ink-muted">
              <span className="font-semibold text-ink">{name}</span>
              {role ? <> · {role}</> : null}
            </figcaption>
          </figure>
        ) : null}
      </div>

      {areas && areas.length > 0 ? (
        <div className="mx-auto mt-10 max-w-3xl px-5 text-center">
          <p className="text-sm text-ink-muted">Zonas donde trabajo</p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {areas.map((a) => (
              <li key={a} className="rounded-full bg-sand px-4 py-2 text-[0.9375rem] text-ink">
                {a}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
