import Image from "next/image";
import { isUnsizedSource } from "@/lib/image-loader";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
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
};

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/**
 * Centered statement, then the agent's portrait as the "product shot": it settles in on load,
 * grows into place as it enters the viewport and drifts inside its frame while scrolling.
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
}: AgentHeroProps) {
  return (
    <section aria-labelledby="hero-title" className="overflow-hidden bg-paper pb-16 lg:pb-24">
      <div className="mx-auto max-w-5xl px-5 pt-12 text-center sm:px-8 sm:pt-16 lg:pt-24">
        {eyebrow ? <p className="animate-rise text-eyebrow text-clay">{eyebrow}</p> : null}
        <h1 id="hero-title" className="mt-3 font-display text-display-xl text-balance text-ink">
          {headline}
        </h1>
        {intro ? (
          <div className="mx-auto mt-5 max-w-2xl animate-rise text-lead text-pretty text-ink-muted" style={delay(120)}>
            {intro}
          </div>
        ) : null}
        <div className="mt-8 flex animate-rise flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4" style={delay(220)}>
          <Button href={ctaHref} size="lg">
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
        <figure className="mx-auto mt-12 max-w-6xl px-5 sm:px-8 lg:mt-20">
          <div className="scroll-grow relative mx-auto aspect-[4/5] max-w-[24rem] overflow-hidden rounded-lg bg-sand sm:max-w-[30rem] lg:max-w-[34rem]">
            <div className="absolute inset-0 animate-settle">
              <Image
                src={photoSrc}
                unoptimized={isUnsizedSource(photoSrc)}
                alt={photoAlt ?? `Retrato de ${name}`}
                fill
                preload
                sizes="(min-width: 1024px) 544px, (min-width: 640px) 480px, 384px"
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
