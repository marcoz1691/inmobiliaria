import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { catalogUrl, hasActiveFilters, isLandingShaped, parseCatalogParams } from "../../../_lib/catalog-params";
import { CatalogView } from "../../_catalog/CatalogView";

export async function generateMetadata({ searchParams }: PageProps<"/propiedades">): Promise<Metadata> {
  const f = parseCatalogParams(await searchParams);
  const page = f.page && f.page > 1 ? f.page : undefined;
  return {
    title: page ? `Propiedades · página ${page}` : "Propiedades",
    description: "Casas, departamentos, terrenos, oficinas y locales disponibles en venta y alquiler.",
    alternates: { canonical: isLandingShaped(f) ? catalogUrl(f) : page ? `/propiedades?page=${page}` : "/propiedades" },
    // Narrow filter combinations are useful to visitors but thin duplicates for search engines.
    robots: hasActiveFilters(f) || f.sort ? { index: false, follow: true } : undefined,
  };
}

export default async function CatalogPage({ searchParams }: PageProps<"/propiedades">) {
  const filters = parseCatalogParams(await searchParams);
  // "Casas en venta en Quito" has one address: its landing page (/venta/casas/quito).
  if (isLandingShaped(filters)) permanentRedirect(catalogUrl(filters));
  return <CatalogView filters={filters} />;
}
