import Image from "next/image";
import { isUnsizedSource } from "@/lib/image-loader";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { WhatsAppButton } from "./WhatsAppButton";

type AgentHeroProps = {
  name: string;
  /** Value proposition, rendered as the page h1. */
  headline: ReactNode;
  photoSrc: string;
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
}: AgentHeroProps) {
  return (
    <section aria-labelledby="hero-title" className="mx-auto max-w-7xl px-5 pt-10 pb-16 sm:px-8 lg:px-12 lg:pt-16 lg:pb-24">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-12 lg:gap-y-12">
        <div className="lg:col-span-7 lg:self-end">
          {eyebrow ? <p className="text-eyebrow font-medium text-clay uppercase">{eyebrow}</p> : null}
          <h1 id="hero-title" className="mt-5 font-display text-display-xl text-balance text-ink">
            {headline}
          </h1>
          {intro ? (
            <div className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-ink-muted">{intro}</div>
          ) : null}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button href={ctaHref} size="lg">
              {ctaLabel}
            </Button>
            <WhatsAppButton
              phone={whatsapp}
              size="lg"
              message={whatsappMessage ?? `Hola ${name}, vi tu página y quisiera conversar sobre una propiedad.`}
            />
          </div>
        </div>

        <figure className="-mx-5 sm:mx-0 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
          <div className="relative aspect-[4/5] overflow-hidden bg-sand sm:rounded-sm">
            <Image
              src={photoSrc}
              unoptimized={isUnsizedSource(photoSrc)}
              alt={photoAlt ?? `Retrato de ${name}`}
              fill
              preload
              sizes="(min-width: 1280px) 500px, (min-width: 1024px) 40vw, 100vw"
              className="object-cover object-top"
            />
          </div>
          <figcaption className="mt-3 flex items-baseline justify-between gap-4 px-5 text-sm sm:px-0">
            <span className="font-medium text-ink">{name}</span>
            {role ? <span className="text-ink-muted">{role}</span> : null}
          </figcaption>
        </figure>

        {areas && areas.length > 0 ? (
          <div className="border-t border-line pt-5 lg:col-span-7 lg:row-start-2 lg:self-start">
            <p className="text-sm text-ink-muted">Zonas donde trabajo</p>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-base text-ink">
              {areas.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
