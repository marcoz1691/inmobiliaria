import Image from "next/image";
import { isUnsizedSource } from "@/lib/image-loader";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
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
    <section aria-labelledby="hero-title" className="overflow-hidden">
      <div className="mx-auto max-w-4xl px-5 pt-14 text-center sm:px-8 lg:pt-24">
        {eyebrow ? <p className="text-eyebrow text-clay">{eyebrow}</p> : null}
        <h1 id="hero-title" className="mt-3 font-display text-display-xl text-balance text-ink">
          {headline}
        </h1>
        {intro ? (
          <div className="mx-auto mt-5 max-w-2xl text-xl leading-relaxed text-pretty text-ink-muted sm:text-[1.375rem]">{intro}</div>
        ) : null}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Button href={ctaHref} size="lg">
            {ctaLabel}
          </Button>
          <WhatsAppButton
            phone={whatsapp}
            size="lg"
            message={whatsappMessage ?? `Hola ${name}, vi tu página y quisiera conversar sobre una propiedad.`}
          />
          {secondaryHref ? (
            <a href={secondaryHref} className="inline-flex min-h-12 items-center gap-1 px-2 text-[1.0625rem] text-navy hover:underline">
              {secondaryLabel}
              <span aria-hidden="true">›</span>
            </a>
          ) : null}
        </div>
      </div>

      {photoSrc ? (
        <figure className="mx-auto mt-12 max-w-5xl px-5 sm:px-8 lg:mt-16">
          <div className="relative mx-auto aspect-[4/5] max-w-md overflow-hidden rounded-md bg-sand sm:max-w-lg">
            <Image
              src={photoSrc}
              unoptimized={isUnsizedSource(photoSrc)}
              alt={photoAlt ?? `Retrato de ${name}`}
              fill
              preload
              sizes="(min-width: 640px) 512px, 100vw"
              className="object-cover object-top"
            />
          </div>
          <figcaption className="mt-4 text-center text-sm text-ink-muted">
            <span className="font-semibold text-ink">{name}</span>
            {role ? <> · {role}</> : null}
          </figcaption>
        </figure>
      ) : null}

      {areas && areas.length > 0 ? (
        <div className="mx-auto mt-10 max-w-3xl px-5 text-center">
          <p className="text-sm text-ink-muted">Zonas donde trabajo</p>
          <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-base text-ink">
            {areas.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
