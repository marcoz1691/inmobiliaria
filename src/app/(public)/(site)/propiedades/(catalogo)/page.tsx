import type { Metadata } from "next";
import Link from "next/link";
import { CatalogFilterFields } from "@/components/public/CatalogFilterFields";
import { FilterForm } from "@/components/public/FilterForm";
import { toCardProperty } from "@/components/public/listing";
import { PropertyCard } from "@/components/public/PropertyCard";
import { ChipLinks, SegmentedLinks } from "@/components/public/QuickFilters";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Reveal } from "@/components/ui/Reveal";
import { OPERATION_LABEL, OPERATIONS, PROPERTY_TYPES, TYPE_LABEL, type CatalogFilters } from "@/modules/properties/domain";
import { listCatalog } from "@/modules/properties/service";
import { catalogQuery, hasActiveFilters, parseCatalogParams } from "../../../_lib/catalog-params";
import { getSite } from "../../../_lib/site";

const container = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12";

export async function generateMetadata({ searchParams }: PageProps<"/propiedades">): Promise<Metadata> {
  const f = parseCatalogParams(await searchParams);
  const page = f.page && f.page > 1 ? f.page : undefined;
  return {
    title: page ? `Propiedades · página ${page}` : "Propiedades",
    description: "Casas, departamentos, terrenos y locales disponibles en venta y alquiler.",
    alternates: { canonical: page ? `/propiedades?page=${page}` : "/propiedades" },
    // Filtered combinations are useful to visitors but thin duplicates for search engines.
    robots: hasActiveFilters(f) || f.sort ? { index: false, follow: true } : undefined,
  };
}

function catalogHref(filters: CatalogFilters, overrides: Partial<CatalogFilters>): string {
  const qs = catalogQuery(filters, { ...overrides, page: 1 });
  return qs ? `/propiedades?${qs}` : "/propiedades";
}

export default async function CatalogPage({ searchParams }: PageProps<"/propiedades">) {
  const filters = parseCatalogParams(await searchParams);
  const site = await getSite();
  const { items, total, page, pageSize } = await listCatalog(site.tenantId, filters);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const active = hasActiveFilters(filters);
  const formKey = catalogQuery(filters, { page: 1 });
  const activeCount = (["operation", "type", "q", "minPrice", "maxPrice", "bedrooms", "bathrooms", "minArea"] as const).filter(
    (k) => filters[k] !== undefined,
  ).length;
  const cards = items.map(toCardProperty);

  const operations = [
    { label: "Todas", href: catalogHref(filters, { operation: undefined }), active: !filters.operation },
    ...OPERATIONS.map((o) => ({ label: OPERATION_LABEL[o], href: catalogHref(filters, { operation: o }), active: filters.operation === o })),
  ];
  const types = [
    { label: "Todos los tipos", href: catalogHref(filters, { type: undefined }), active: !filters.type },
    ...PROPERTY_TYPES.map((t) => ({ label: TYPE_LABEL[t], href: catalogHref(filters, { type: t }), active: filters.type === t })),
  ];

  return (
    <>
      <header className="bg-paper">
        <div className={`${container} pt-12 pb-8 lg:pt-20 lg:pb-10`}>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div>
              <h1 className="font-display text-display-lg text-ink">
                Propiedades. <span className="text-ink-muted">Encuentra la tuya.</span>
              </h1>
              <p className="mt-3 text-lead text-ink-muted" aria-live="polite">
                {total === 1 ? "1 propiedad" : `${total.toLocaleString("es-EC")} propiedades`}
                {active ? " con estos filtros" : " disponibles"}
              </p>
            </div>
            {active ? (
              <Link
                href="/propiedades"
                className="inline-flex min-h-11 items-center gap-1 text-[1.0625rem] text-link underline-offset-4 hover:underline"
              >
                Quitar filtros
              </Link>
            ) : null}
          </div>

          <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
            <SegmentedLinks label="Tipo de operación" options={operations} className="self-start" />
            <ChipLinks label="Tipo de propiedad" options={types} className="-mx-5 px-5 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0" />
          </div>
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
                className="bg-white"
                title={active ? "No encontramos propiedades con esos filtros" : "Aún no hay propiedades publicadas"}
                description={
                  active
                    ? "Prueba con un rango de precio más amplio, otra zona o menos filtros."
                    : "Vuelve pronto o cuéntame qué buscas y te aviso cuando haya opciones."
                }
                action={
                  active ? (
                    <Button href="/propiedades">Quitar filtros</Button>
                  ) : (
                    <Button href={site.bookingHref}>{site.funnelHref ? "Agenda una cita" : "Escríbeme"}</Button>
                  )
                }
              />
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Pagination({ filters, page, pages }: { filters: CatalogFilters; page: number; pages: number }) {
  const href = (p: number) => {
    const qs = catalogQuery(filters, { page: p });
    return qs ? `/propiedades?${qs}` : "/propiedades";
  };
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
