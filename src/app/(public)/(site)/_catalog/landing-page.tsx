import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CatalogFilters, Operation } from "@/modules/properties/domain";
import { facetCount, landingPath, landingPhrase, landingTitle, parseLanding, placeName, type Landing } from "@/modules/properties/landing";
import { getFacets, siteName } from "../../_lib/site";
import { CatalogView } from "./CatalogView";

type RawSearch = Record<string, string | string[] | undefined>;

function pageParam(search: RawSearch): number {
  const raw = Array.isArray(search.page) ? search.page[0] : search.page;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 500 ? n : 1;
}

/**
 * Resolves "/venta/casas/quito". Unknown types and malformed paths are 404s; so are places that
 * are neither a canton of Ecuador nor a city some listing uses: pages exist only for real places.
 */
async function resolve(operation: Operation, segments: string[] | undefined) {
  const landing = parseLanding(operation, segments);
  if (!landing) return null;
  const facets = await getFacets();
  const cityLabel = landing.city ? placeName(landing.city, facets) : undefined;
  if (landing.city && !cityLabel) return null;
  return { landing, cityLabel, total: facetCount(facets, landing) };
}

export async function landingMetadata(operation: Operation, segments: string[] | undefined, search: RawSearch): Promise<Metadata> {
  const found = await resolve(operation, segments);
  if (!found) return { title: "Página no encontrada", robots: { index: false, follow: true } };
  const { landing, cityLabel, total } = found;
  const name = await siteName();
  const page = pageParam(search);
  const title = landingTitle(landing, cityLabel);
  const path = landingPath(landing);
  const canonical = page > 1 ? `${path}?page=${page}` : path;
  const description =
    total > 0
      ? `${title}: ${total === 1 ? "1 propiedad disponible" : `${total.toLocaleString("es-EC")} propiedades disponibles`} con fotos, precio y ubicación. Contacta al agente desde ${name}.`
      : `Por ahora no hay ${landingPhrase(landing, cityLabel)}. Revisa el resto del catálogo de ${name}.`;
  return {
    title: page > 1 ? `${title} · página ${page}` : title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
    // An empty result is not worth a search result: keep it out of the index until there is stock.
    robots: total > 0 ? undefined : { index: false, follow: true },
  };
}

export async function LandingPage({ operation, segments, search }: { operation: Operation; segments: string[] | undefined; search: RawSearch }) {
  const found = await resolve(operation, segments);
  if (!found) notFound();
  const landing: Landing = found.landing;
  const page = pageParam(search);
  const filters: CatalogFilters = { operation: landing.operation, type: landing.type, city: landing.city, ...(page > 1 ? { page } : {}) };
  return <CatalogView filters={filters} landing={landing} />;
}
