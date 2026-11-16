import Link from "next/link";
import { CatalogFilterFields } from "@/components/public/CatalogFilterFields";
import { FilterForm } from "@/components/public/FilterForm";
import { compact, JsonLd } from "@/components/public/JsonLd";
import { toCardProperty } from "@/components/public/listing";
import { PropertyCard } from "@/components/public/PropertyCard";
import { ChipLinks, SegmentedLinks } from "@/components/public/QuickFilters";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Reveal } from "@/components/ui/Reveal";
import { OPERATION_LABEL, OPERATIONS, type CatalogFilters } from "@/modules/properties/domain";
import { getProvince } from "@/modules/geo/ecuador";
import { slugify } from "@/modules/properties/domain";
import { citySlug, facetCities, facetCount, facetTypes, landingPath, landingPhrase, landingTitle, placeName, TYPE_PLURAL, type Landing } from "@/modules/properties/landing";
import { listCatalog } from "@/modules/properties/service";
import { catalogQuery, catalogUrl, hasActiveFilters } from "../../_lib/catalog-params";
import { absoluteImage, getFacets, getScope, getSite, isPortal, siteOrigin } from "../../_lib/site";

const container = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12";

export type Crumb = { label: string; href: string };

/** Home › Propiedades › Casas en venta › Quito. The last crumb is the current page. */
export function landingCrumbs(l: Landing, cityLabel?: string): Crumb[] {
  const crumbs: Crumb[] = [
    { label: "Propiedades", href: "/propiedades" },
    { label: landingTitle({ operation: l.operation }), href: landingPath({ operation: l.operation }) },
  ];
  if (l.type) crumbs.push({ label: landingTitle({ operation: l.operation, type: l.type }), href: landingPath({ operation: l.operation, type: l.type }) });
  if (l.city) crumbs.push({ label: cityLabel ?? l.city, href: landingPath(l) });
  return crumbs;
}

export function Breadcrumbs({ crumbs, origin, current }: { crumbs: Crumb[]; origin: string; current?: string }) {
  const trail = current ? [...crumbs, { label: current, href: "" }] : crumbs;
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: trail.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.label,
            ...(c.href ? { item: `${origin}${c.href}` } : {}),
          })),
        }}
      />
      <nav aria-label="Ruta de navegación" className="text-sm text-ink-muted">
        <ol className="no-scrollbar -mx-5 flex items-center gap-x-2 overflow-x-auto px-5 whitespace-nowrap sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:whitespace-normal">
          {trail.map((c, i) => {
            const last = i === trail.length - 1;
            return (
              <li key={`${c.href}-${c.label}`} className="flex shrink-0 items-center gap-x-2 sm:min-w-0 sm:shrink">
                {i > 0 ? <span aria-hidden="true">›</span> : null}
                {last ? (
                  <span aria-current="page" className="line-clamp-1 py-3">
                    {c.label}
                  </span>
                ) : (
                  <Link href={c.href} className="inline-flex min-h-11 items-center text-link underline-offset-4 hover:underline">
                    {c.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

type CatalogViewProps = {
  filters: CatalogFilters;
  /** Set on search landing pages (/venta/casas/quito): specific heading, breadcrumbs and structured data. */
  landing?: Landing;
};

/** Catalog screen shared by /propiedades and the search landing pages. */
export async function CatalogView({ filters, landing }: CatalogViewProps) {
  const [scope, portal, facets, origin] = await Promise.all([getScope(), isPortal(), getFacets(), siteOrigin()]);
  const { items, total, page, pageSize } = await listCatalog(scope, filters);
  // With nothing to show, the next step is talking to the agent (their site) or publishing (portal).
  const fallback = portal
    ? { href: "/panel/registro", label: "Publica tu propiedad" }
    : await getSite().then((site) => ({ href: site.bookingHref, label: site.funnelHref ? "Agenda una cita" : "Escríbeme" }));
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const cards = items.map(toCardProperty);
  const formKey = catalogQuery(filters, { page: 1 });

  const activeCity = filters.city ? citySlug(filters.city) : undefined;
  const cityLabel = activeCity ? (placeName(activeCity, facets) ?? filters.city) : undefined;
  const provinceName = filters.province ? getProvince(slugify(filters.province))?.name : undefined;
  // On a landing page the address itself is the filter; "active" means the visitor narrowed further.
  const narrowed = landing ? false : hasActiveFilters(filters);
  const activeCount = (["operation", "type", "q", "province", "city", "minPrice", "maxPrice", "bedrooms", "bathrooms", "minArea"] as const).filter(
    (k) => filters[k] !== undefined,
  ).length;

  // Quick filters only offer what is in stock (plus the current choice), so no tap leads to an empty page.
  const liveOperations = OPERATIONS.filter((o) => filters.operation === o || facetCount(facets, { operation: o, type: filters.type, city: activeCity }) > 0);
  const operations =
    liveOperations.length > 1 || filters.operation
      ? [
          { label: "Todas", href: catalogUrl(filters, { operation: undefined, page: 1 }), active: !filters.operation },
          ...liveOperations.map((o) => ({ label: OPERATION_LABEL[o], href: catalogUrl(filters, { operation: o, page: 1 }), active: filters.operation === o })),
        ]
      : [];
  const liveTypes = facetTypes(facets, { operation: filters.operation, city: activeCity });
  if (filters.type && !liveTypes.some((t) => t.type === filters.type)) liveTypes.push({ type: filters.type, count: 0 });
  const types =
    liveTypes.length > 1 || filters.type
      ? [
          { label: "Todos los tipos", href: catalogUrl(filters, { type: undefined, page: 1 }), active: !filters.type },
          ...liveTypes.map((t) => ({ label: TYPE_PLURAL[t.type], href: catalogUrl(filters, { type: t.type, page: 1 }), active: filters.type === t.type })),
        ]
      : [];

  // Landing pages link to their neighbours: the same search in other cities.
  const otherCities = landing
    ? facetCities(facets, { operation: landing.operation, type: landing.type })
        .filter((c) => c.slug !== activeCity)
        .slice(0, 8)
        .map((c) => ({ label: landingTitle(landing, c.label), href: landingPath({ ...landing, city: c.slug }) }))
    : [];

  return (
    <>
      {landing && cards.length > 0 ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: landingTitle(landing, cityLabel),
            numberOfItems: total,
            itemListElement: items.map((l, i) => ({
              "@type": "ListItem",
              position: (page - 1) * pageSize + i + 1,
              url: `${origin}/propiedades/${l.slug}`,
              ...compact({ name: l.title, image: absoluteImage(l.cover?.src, origin) }),
            })),
          }}
        />
      ) : null}

      <header className="bg-paper">
        <div className={`${container} ${landing ? "pt-4 lg:pt-8" : "pt-12 lg:pt-20"} pb-8 lg:pb-10`}>
          {landing ? <Breadcrumbs crumbs={landingCrumbs(landing, cityLabel)} origin={origin} /> : null}
          <div className={`flex flex-wrap items-end justify-between gap-x-8 gap-y-3 ${landing ? "mt-4 lg:mt-8" : ""}`}>
            <div>
              <h1 className="font-display text-display-lg text-balance text-ink">
                {landing ? (
                  <>
                    {landingTitle(landing)}
                    {cityLabel ? <span className="text-ink-muted"> en {cityLabel}</span> : null}.
                  </>
                ) : (
                  <>
                    Propiedades
                    {cityLabel ? <span className="text-ink-muted"> en {cityLabel}</span> : provinceName ? <span className="text-ink-muted"> en {provinceName}</span> : null}.{" "}
                    {!cityLabel && !provinceName ? <span className="text-ink-muted">Encuentra la tuya.</span> : null}
                  </>
                )}
              </h1>
              <p className="mt-3 text-lead text-ink-muted" aria-live="polite">
                {total === 1 ? "1 propiedad" : `${total.toLocaleString("es-EC")} propiedades`}
                {narrowed ? " con estos filtros" : total === 1 ? " disponible" : " disponibles"}
              </p>
            </div>
            {narrowed || landing ? (
              <Link
                href="/propiedades"
                className="inline-flex min-h-11 items-center gap-1 text-[1.0625rem] text-link underline-offset-4 hover:underline"
              >
                {landing ? "Ver todas las propiedades" : "Quitar filtros"}
              </Link>
            ) : null}
          </div>

          {operations.length || types.length ? (
            <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
              {operations.length ? <SegmentedLinks label="Tipo de operación" options={operations} className="self-start" /> : null}
              {types.length ? (
                <ChipLinks label="Tipo de propiedad" options={types} className="-mx-5 px-5 sm:-mx-8 sm:px-8 lg:mx-0 lg:min-w-0 lg:flex-1 lg:px-0" />
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex-1 bg-sand">
        <div className={`${container} grid gap-6 py-8 lg:grid-cols-12 lg:gap-8 lg:py-12`}>
          {/* Mobile: filters in a native disclosure (works without JavaScript). */}
          <details className="group rounded-md bg-white lg:hidden">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-5 text-[1.0625rem] font-medium text-ink [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-3">
                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 6h14M6 10h8M8.5 14h3" />
                </svg>
                <span>
                  Filtros{activeCount ? ` (${activeCount} activos)` : ""}
                </span>
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="size-5 text-ink-muted transition-transform duration-300 ease-apple group-open:rotate-180"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="m5 7.5 5 5 5-5" />
              </svg>
            </summary>
            <FilterForm key={`m-${formKey}`} action="/propiedades" label="Filtrar propiedades" className="px-5 pt-2 pb-6">
              <CatalogFilterFields filters={filters} idPrefix="fm" />
            </FilterForm>
          </details>

          <aside className="hidden lg:col-span-3 lg:block">
            <div className="sticky top-20 rounded-md bg-white p-6">
              <h2 className="text-headline text-ink">Filtrar</h2>
              <FilterForm key={`d-${formKey}`} action="/propiedades" label="Filtrar propiedades" className="mt-5">
                <CatalogFilterFields filters={filters} idPrefix="fd" />
              </FilterForm>
            </div>
          </aside>

          <section aria-label="Resultados" className="lg:col-span-9">
            {cards.length > 0 ? (
              <>
                <ul className="grid gap-5 sm:grid-cols-2 lg:gap-6 xl:grid-cols-3">
                  {cards.map((p, i) => (
                    <li key={p.slug}>
                      {/* First row renders immediately: it holds the LCP image. */}
                      {i < 3 ? (
                        <PropertyCard
                          property={p}
                          href={`/propiedades/${p.slug}`}
                          headingLevel={2}
                          preload={i === 0}
                          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                        />
                      ) : (
                        <Reveal delay={(i % 3) * 80} className="h-full">
                          <PropertyCard
                            property={p}
                            href={`/propiedades/${p.slug}`}
                            headingLevel={2}
                            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                          />
                        </Reveal>
                      )}
                    </li>
                  ))}
                </ul>
                {pages > 1 ? <Pagination filters={filters} page={page} pages={pages} /> : null}
              </>
            ) : (
              <EmptyState
                headingLevel={2}
                surface="white"
                title={
                  landing
                    ? `Por ahora no hay ${landingPhrase(landing, cityLabel)}`
                    : narrowed
                      ? "No encontramos propiedades con esos filtros"
                      : "Aún no hay propiedades publicadas"
                }
                description={
                  landing || narrowed
                    ? "Prueba con un rango de precio más amplio, otra zona o menos filtros."
                    : portal
                      ? "Los agentes están cargando sus primeras fichas. Vuelve pronto."
                      : "Vuelve pronto o cuéntame qué buscas y te aviso cuando haya opciones."
                }
                action={
                  landing || narrowed ? (
                    <Button href="/propiedades">{landing ? "Ver todas las propiedades" : "Quitar filtros"}</Button>
                  ) : (
                    <Button href={fallback.href}>{fallback.label}</Button>
                  )
                }
              />
            )}

            {otherCities.length > 0 ? (
              <nav aria-labelledby="otras-ciudades" className="mt-12 border-t border-line pt-8">
                <h2 id="otras-ciudades" className="text-headline text-ink">
                  Busca también en otras ciudades
                </h2>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {otherCities.map((c) => (
                    <li key={c.href}>
                      <Link
                        href={c.href}
                        className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-sm font-medium text-ink transition-colors duration-300 ease-apple hover:border-line-strong"
                      >
                        {c.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}

function Pagination({ filters, page, pages }: { filters: CatalogFilters; page: number; pages: number }) {
  const href = (p: number) => catalogUrl(filters, { page: p });
  const link =
    "inline-flex min-h-11 items-center gap-1 rounded-full bg-white px-5 text-[0.9375rem] font-medium text-ink transition-colors duration-300 ease-apple hover:bg-ink hover:text-white";
  return (
    <nav aria-label="Paginación" className="mt-12 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={link}>
          <span aria-hidden="true">‹</span> Anterior
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-ink-muted">
        Página {page} de {pages}
      </p>
      {page < pages ? (
        <Link href={href(page + 1)} rel="next" className={link}>
          Siguiente <span aria-hidden="true">›</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
