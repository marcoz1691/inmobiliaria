import type { Metadata } from "next";
import Link from "next/link";
import { CatalogFilterFields } from "@/components/public/CatalogFilterFields";
import { FilterForm } from "@/components/public/FilterForm";
import { toCardProperty } from "@/components/public/listing";
import { PropertyCard } from "@/components/public/PropertyCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
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

  return (
    <div className={`${container} py-10 lg:py-16`}>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="font-display text-display-lg text-ink">Propiedades</h1>
          <p className="mt-2 text-base text-ink-muted" aria-live="polite">
            {total === 1 ? "1 propiedad" : `${total.toLocaleString("es-EC")} propiedades`}
            {active ? " con estos filtros" : " disponibles"}
          </p>
        </div>
        {active ? (
          <Link href="/propiedades" className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline underline-offset-4">
            Quitar filtros
          </Link>
        ) : null}
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-12">
        {/* Mobile: filters in a native disclosure (works without JavaScript). */}
        <details className="group border-b border-line pb-4 lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-sm text-base font-medium text-ink [&::-webkit-details-marker]:hidden">
            <span>
              Filtros{activeCount ? ` (${activeCount} activos)` : ""}
            </span>
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="m5 7.5 5 5 5-5" />
            </svg>
          </summary>
          <FilterForm key={`m-${formKey}`} action="/propiedades" label="Filtrar propiedades" className="pt-4">
            <CatalogFilterFields filters={filters} idPrefix="fm" />
          </FilterForm>
        </details>

        <aside className="hidden lg:col-span-3 lg:block">
          <h2 className="text-eyebrow font-medium text-clay uppercase">Filtrar</h2>
          <FilterForm key={`d-${formKey}`} action="/propiedades" label="Filtrar propiedades" className="mt-4">
            <CatalogFilterFields filters={filters} idPrefix="fd" />
          </FilterForm>
        </aside>

        <section aria-label="Resultados" className="lg:col-span-9">
          {cards.length > 0 ? (
            <>
              <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map((p, i) => (
                  <li key={p.slug}>
                    <PropertyCard
                      property={p}
                      href={`/propiedades/${p.slug}`}
                      headingLevel={2}
                      preload={i === 0}
                      sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                    />
                  </li>
                ))}
              </ul>
              {pages > 1 ? <Pagination filters={filters} page={page} pages={pages} /> : null}
            </>
          ) : (
            <EmptyState
              headingLevel={2}
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
  );
}

function Pagination({ filters, page, pages }: { filters: Parameters<typeof catalogQuery>[0]; page: number; pages: number }) {
  const href = (p: number) => {
    const qs = catalogQuery(filters, { page: p });
    return qs ? `/propiedades?${qs}` : "/propiedades";
  };
  const link = "inline-flex min-h-11 items-center rounded-full border border-ink/80 px-5 text-sm font-medium text-ink hover:bg-ink hover:text-paper";
  return (
    <nav aria-label="Paginación" className="mt-14 flex items-center justify-between gap-4 border-t border-line pt-6">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={link}>
          Anterior
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-ink-muted">
        Página {page} de {pages}
      </p>
      {page < pages ? (
        <Link href={href(page + 1)} rel="next" className={link}>
          Siguiente
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
