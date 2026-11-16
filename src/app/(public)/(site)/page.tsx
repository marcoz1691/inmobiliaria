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
import type { Metadata } from "next";
import Link from "next/link";
import { HeroSearch } from "@/components/public/HeroSearch";
import { OPERATIONS } from "@/modules/properties/domain";
import { facetCities, facetCount, facetTypes, topCategories, TYPE_PLURAL } from "@/modules/properties/landing";
import { listFeatured } from "@/modules/properties/service";
import { env } from "@/env";
import { agentTagline, getFacets, getSite, isPortal } from "../_lib/site";
import { PortalHome } from "./_portal/PortalHome";

const SEARCH_VERB = { sale: "Comprar", rent: "Alquilar" } as const;

/** "Casas, departamentos y terrenos": only the types that are really in the catalog. */
function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`;
}

export async function generateMetadata(): Promise<Metadata> {
  if (await isPortal()) {
    return {
      title: { absolute: `Casas, departamentos y terrenos en venta y alquiler en Ecuador · ${env.PORTAL_NAME}` },
      description:
        "Busca casas, departamentos, terrenos, oficinas y locales en venta y alquiler en las 24 provincias de Ecuador. Fotos, precios y contacto directo con el agente.",
      alternates: { canonical: "/" },
    };
  }
  const [site, facets] = await Promise.all([getSite(), getFacets()]);
  const ops = OPERATIONS.filter((o) => facetCount(facets, { operation: o }) > 0);
  const how = ops.length === 1 ? (ops[0] === "sale" ? "en venta" : "en alquiler") : "en venta y alquiler";
  // Name a city only when it is true of the whole catalog; otherwise fall back to the agent's own city.
  const cityOptions = facetCities(facets);
  const where = cityOptions.length === 1 ? cityOptions[0]!.label : site.agent?.city;
  const types = facetTypes(facets).slice(0, 4).map((t) => TYPE_PLURAL[t.type].toLowerCase());
  const title = `Propiedades ${how}${where ? ` en ${where}` : ""} · ${site.name}`;
  const description = types.length
    ? `${listPhrase(types).replace(/^./, (c) => c.toUpperCase())} ${how}${where ? ` en ${where}` : ""}. Mira fotos y precios, y agenda una visita con ${site.name}.`
    : undefined;
  return { title: { absolute: title }, ...(description ? { description } : {}), alternates: { canonical: "/" } };
}

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
  if (await isPortal()) return <PortalHome facets={await getFacets()} />;
  const [site, facets] = await Promise.all([getSite(), getFacets()]);
  const categories = topCategories(facets, 8);
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
        search={
          facets.length > 0 ? (
            <HeroSearch
              operations={OPERATIONS.filter((o) => facetCount(facets, { operation: o }) > 0).map((o) => ({ value: o, label: SEARCH_VERB[o] }))}
              types={facetTypes(facets).map((t) => ({ value: t.type, label: TYPE_PLURAL[t.type] }))}
            />
          ) : undefined
        }
      />

      {categories.length > 1 ? (
        <section aria-labelledby="explora-title" className="bg-paper pb-20 lg:pb-28">
          <div className={container}>
            <Reveal>
              <h2 id="explora-title" className="font-display text-display-md text-ink">
                Busca por tipo de propiedad.
              </h2>
            </Reveal>
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {categories.map((c, i) => (
                <li key={c.href}>
                  <Reveal delay={(i % 4) * 70} className="h-full">
                    <Link
                      href={c.href}
                      className="group flex h-full min-h-28 flex-col justify-between rounded-md bg-sand p-5 transition-colors duration-300 ease-apple hover:bg-mist sm:p-6"
                    >
                      <span className="text-headline text-balance text-ink">{c.label}</span>
                      <span className="mt-4 flex items-center justify-between text-[0.9375rem] text-ink-muted">
                        {c.count === 1 ? "1 propiedad" : `${c.count.toLocaleString("es-EC")} propiedades`}
                        <span aria-hidden="true" className="text-link transition-transform duration-300 ease-apple group-hover:translate-x-1">
                          ›
                        </span>
                      </span>
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

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
              className="mt-10 max-w-2xl"
              surface="white"
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
