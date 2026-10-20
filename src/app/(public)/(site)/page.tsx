import { AgentHero } from "@/components/public/AgentHero";
import { toCardProperty } from "@/components/public/listing";
import { PropertyCard } from "@/components/public/PropertyCard";
import { PropertySpotlight } from "@/components/public/PropertySpotlight";
import { whatsappHref } from "@/components/public/WhatsAppButton";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { MoreLink } from "@/components/ui/MoreLink";
import { Reveal } from "@/components/ui/Reveal";
import { listFeatured } from "@/modules/properties/service";
import { agentTagline, getSite } from "../_lib/site";

const container = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12";

// Lead tile spans two rows next to a stacked pair, then rows of three. One or two items split evenly.
function featuredSpan(i: number, n: number): string {
  if (n === 1) return "lg:col-span-8";
  if (n === 2) return "lg:col-span-6";
  if (i === 0) return "sm:col-span-2 lg:col-span-7 lg:row-span-2";
  if (i < 3) return "lg:col-span-5";
  return "lg:col-span-4";
}

export default async function HomePage() {
  const site = await getSite();
  const featured = (await listFeatured(site.tenantId, 6)).map(toCardProperty);
  const { agent } = site;
  const spotlight = featured.find((p) => p.cover && p.status === "available") ?? null;
  const ctaLabel = site.funnelHref ? "Agenda una cita" : "Escríbeme";
  const wa = agent?.whatsapp ? whatsappHref(agent.whatsapp, `Hola ${site.name}, vi tu página y quisiera conversar.`) : null;
  const leadFeature = featured.length !== 2;

  return (
    <>
      <AgentHero
        name={site.name}
        role={agent?.headline ?? undefined}
        eyebrow={agentTagline(agent)}
        headline="Encuentra tu próxima propiedad. Sin rodeos."
        intro={<p>Revisa las propiedades disponibles, agenda una cita y resuelve tus dudas antes de decidir.</p>}
        photoSrc={agent?.photoUrl}
        whatsapp={agent?.whatsapp}
        ctaHref={site.bookingHref}
        ctaLabel={ctaLabel}
        secondaryHref="/propiedades"
      />

      <section aria-labelledby="destacadas-title" className="bg-sand py-20 lg:py-28">
        <div className={container}>
          <Reveal className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
            <h2 id="destacadas-title" className="font-display text-display-lg text-ink">
              Propiedades destacadas.
            </h2>
            {featured.length > 0 ? <MoreLink href="/propiedades">Ver todas las propiedades</MoreLink> : null}
          </Reveal>

          {featured.length > 0 ? (
            <ul className="no-scrollbar -mx-5 mt-10 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-6 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:mt-14 lg:grid-cols-12">
              {featured.map((p, i) => (
                <li key={p.slug} className={cn("w-[85%] shrink-0 snap-start sm:w-auto", featuredSpan(i, featured.length))}>
                  <Reveal delay={(i % 3) * 90} className="h-full">
                    <PropertyCard
                      property={p}
                      href={`/propiedades/${p.slug}`}
                      feature={i === 0 && leadFeature}
                      sizes={
                        i === 0 && leadFeature
                          ? "(min-width: 1024px) 58vw, (min-width: 640px) 100vw, 85vw"
                          : "(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 85vw"
                      }
                    />
                  </Reveal>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              className="mt-10 max-w-2xl bg-white"
              headingLevel={3}
              title="Aún no hay propiedades publicadas"
              description="Estamos preparando las primeras fichas. Mientras tanto, cuéntame qué buscas y te aviso cuando haya opciones."
              action={<Button href={site.bookingHref}>{ctaLabel}</Button>}
            />
          )}
        </div>
      </section>

      {spotlight ? (
        <PropertySpotlight
          property={spotlight}
          href={`/propiedades/${spotlight.slug}`}
          bookingHref={site.bookingHref}
          bookingLabel={site.funnelHref ? "Agenda una visita" : "Escríbeme"}
        />
      ) : null}

      {agent?.bio ? (
        <section aria-labelledby="sobre-mi-title" className="bg-paper pt-20 lg:pt-28">
          <Reveal className={cn(container, "max-w-5xl")}>
            <h2 id="sobre-mi-title" className="text-eyebrow text-clay">
              Sobre mí
            </h2>
            <p
              className={cn(
                "mt-4 whitespace-pre-line text-pretty text-ink",
                agent.bio.length <= 320 ? "font-display text-display-md" : "text-lead",
              )}
            >
              {agent.bio}
            </p>
          </Reveal>
        </section>
      ) : null}

      <section
        aria-labelledby="cta-title"
        className={cn("py-24 text-center lg:py-32", spotlight ? "bg-paper text-ink" : "bg-night text-white")}
      >
        <Reveal className={cn(container, "max-w-4xl")}>
          <h2 id="cta-title" className="font-display text-display-lg text-balance">
            ¿Buscas comprar, vender o alquilar?
          </h2>
          <p className={cn("mx-auto mt-5 max-w-xl text-lead text-pretty", spotlight ? "text-ink-muted" : "text-paper-muted")}>
            {site.funnelHref
              ? "Responde unas preguntas rápidas y elige un horario para conversar."
              : "Cuéntame qué necesitas y te respondo lo antes posible."}
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
            <Button href={site.bookingHref} size="lg">
              {ctaLabel}
            </Button>
            {wa ? (
              <MoreLink href={wa} size="lg" tone={spotlight ? "light" : "dark"}>
                Escríbeme por WhatsApp
              </MoreLink>
            ) : null}
          </div>
        </Reveal>
      </section>
    </>
  );
}
