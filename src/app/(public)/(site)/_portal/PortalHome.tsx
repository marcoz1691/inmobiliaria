import Link from "next/link";
import { HeroSearch } from "@/components/public/HeroSearch";
import { toCardProperty } from "@/components/public/listing";
import { PropertyCard } from "@/components/public/PropertyCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MoreLink } from "@/components/ui/MoreLink";
import { Reveal } from "@/components/ui/Reveal";
import { PROVINCES } from "@/modules/geo/ecuador";
import { OPERATIONS } from "@/modules/properties/domain";
import { facetCount, facetTypes, provinceSlug, topCategories, TYPE_PLURAL, type Facet } from "@/modules/properties/landing";
import { listFeatured, PORTAL } from "@/modules/properties/service";

const container = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12";
const SEARCH_VERB = { sale: "Comprar", rent: "Alquilar" } as const;

/** Live listings per province (typed, or derived from the canton), all 24 provinces in order. */
function provinceCounts(facets: Facet[]) {
  const counts = new Map<string, number>();
  for (const f of facets) {
    const p = provinceSlug(f.city, f.province);
    if (p) counts.set(p, (counts.get(p) ?? 0) + f.count);
  }
  return PROVINCES.map((p) => ({ ...p, count: counts.get(p.slug) ?? 0 }));
}

/**
 * Portal home for people looking for a place: search first (every province and city of
 * Ecuador), then entry points by type and province, the newest listings and, last, the
 * invitation for agents to publish.
 */
export async function PortalHome({ facets, name }: { facets: Facet[]; name: string }) {
  const latest = (await listFeatured(PORTAL, 9)).map(toCardProperty);
  const categories = topCategories(facets, 8);
  const provinces = provinceCounts(facets);
  const withStock = provinces.filter((p) => p.count > 0).sort((a, b) => b.count - a.count);
  const total = facetCount(facets, {});
  const types = facetTypes(facets);

  return (
    <>
      <section aria-labelledby="hero-title" className="bg-paper pb-14 lg:pb-20">
        <div className={`${container} pt-12 sm:pt-16 lg:pt-20`}>
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-eyebrow text-clay">{name}</p>
            <h1 id="hero-title" className="mt-3 font-display text-display-xl text-balance text-ink">
              Casas, departamentos, terrenos y oficinas en todo Ecuador.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lead text-pretty text-ink-muted">
              Busca por provincia y ciudad, mira fotos y precios, y escríbele directo al agente que publica.
            </p>
          </div>
          <HeroSearch
            className="mx-auto mt-10 max-w-5xl"
            operations={OPERATIONS.map((o) => ({ value: o, label: SEARCH_VERB[o] }))}
            types={(types.length > 1 ? types.map((t) => t.type) : (["house", "apartment", "land", "office", "commercial"] as const)).map((t) => ({
              value: t,
              label: TYPE_PLURAL[t],
            }))}
          />
          {total > 0 ? (
            <p className="mt-4 text-center text-[0.9375rem] text-ink-muted">
              {total === 1 ? "1 propiedad publicada" : `${total.toLocaleString("es-EC")} propiedades publicadas`} por agentes de todo el país.
            </p>
          ) : null}
        </div>
      </section>

      {categories.length > 1 ? (
        <section aria-labelledby="explora-title" className="bg-paper pb-20 lg:pb-28">
          <div className={container}>
            <h2 id="explora-title" className="font-display text-display-md text-ink">
              Busca por tipo de propiedad.
            </h2>
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {categories.map((c) => (
                <li key={c.href}>
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
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="recientes-title" className="bg-sand py-20 lg:py-28">
        <div className={container}>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
            <h2 id="recientes-title" className="font-display text-display-lg text-ink">
              Recién publicadas.
            </h2>
            {latest.length > 0 ? <MoreLink href="/propiedades">Ver todas las propiedades</MoreLink> : null}
          </div>
          {latest.length > 0 ? (
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-6">
              {latest.map((p, i) => (
                <li key={p.slug}>
                  {i < 3 ? (
                    <PropertyCard property={p} href={`/propiedades/${p.slug}`} preload={i === 0} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
                  ) : (
                    <Reveal delay={(i % 3) * 80} className="h-full">
                      <PropertyCard property={p} href={`/propiedades/${p.slug}`} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
                    </Reveal>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              className="mt-10 max-w-2xl"
              surface="white"
              headingLevel={3}
              title="Todavía no hay propiedades publicadas"
              description="Los agentes están cargando sus primeras fichas. Si eres agente, publica las tuyas."
              action={<Button href="/panel/registro">Publica tus propiedades</Button>}
            />
          )}
        </div>
      </section>

      <section aria-labelledby="provincias-title" className="bg-paper py-20 lg:py-28">
        <div className={container}>
          <h2 id="provincias-title" className="font-display text-display-md text-ink">
            Busca por provincia.
          </h2>
          <ul className="mt-8 flex flex-wrap gap-2">
            {[...withStock, ...provinces.filter((p) => p.count === 0)].map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/propiedades?province=${p.slug}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-medium text-ink transition-colors duration-300 ease-apple hover:border-line-strong"
                >
                  {p.name}
                  {p.count > 0 ? <span className="text-ink/70">{p.count.toLocaleString("es-EC")}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="agentes-title" className="bg-night py-24 text-white lg:py-32">
        <div className={`${container} max-w-4xl text-center`}>
          <p className="text-eyebrow text-clay-bright">Para agentes inmobiliarios</p>
          <h2 id="agentes-title" className="mt-3 font-display text-display-lg text-balance">
            Publica tus propiedades donde la gente las busca.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lead text-pretty text-paper-muted">
            Crea tu cuenta, sube fotos y precios desde el celular y recibe las consultas en tu panel, con tu nombre y tu WhatsApp en cada ficha.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
            <Button href="/panel/registro" size="lg" variant="inverse">
              Crea tu cuenta de agente
            </Button>
            <MoreLink href="/panel/ingresar" size="lg" tone="dark">
              Ya tengo cuenta
            </MoreLink>
          </div>
        </div>
      </section>
    </>
  );
}
