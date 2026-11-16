import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { compact, JsonLd } from "@/components/public/JsonLd";
import { toCardProperty } from "@/components/public/listing";
import { PropertyCard } from "@/components/public/PropertyCard";
import { WhatsAppButton } from "@/components/public/WhatsAppButton";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPortalAgent } from "@/modules/agents/portal";
import { listCatalog } from "@/modules/properties/service";
import { absoluteImage, isPortal, siteOrigin } from "../../../_lib/site";
import { AgentAvatar } from "../../_portal/AgentCard";
import { Breadcrumbs } from "../../_catalog/CatalogView";

const container = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12";

const lookup = cache(async (slug: string) => ((await isPortal()) ? getPortalAgent(slug) : null));

export async function generateMetadata({ params }: PageProps<"/agentes/[slug]">): Promise<Metadata> {
  const agent = await lookup((await params).slug);
  if (!agent) return { title: "Agente no encontrado", robots: { index: false, follow: true } };
  const role = [agent.headline, agent.city].filter(Boolean).join(" · ");
  return {
    title: `${agent.displayName}${role ? ` · ${role}` : ""}`,
    description: `${agent.displayName}: ${agent.listings === 1 ? "1 propiedad publicada" : `${agent.listings} propiedades publicadas`}. Escríbele directo desde su ficha.`,
    alternates: { canonical: `/agentes/${agent.tenantSlug}` },
    // A profile without listings is not worth a search result yet.
    robots: agent.listings > 0 ? undefined : { index: false, follow: true },
  };
}

/** An agent's page on the portal: who they are, how to reach them, and everything they publish. */
export default async function AgentPage({ params, searchParams }: PageProps<"/agentes/[slug]">) {
  const agent = await lookup((await params).slug);
  if (!agent) notFound();
  const raw = (await searchParams).page;
  const page = Math.min(500, Math.max(1, Number(Array.isArray(raw) ? raw[0] : raw) || 1));
  // The agent's own catalog (tenant id from the server-side lookup above, never from the URL).
  const [{ items, total, pageSize }, origin] = await Promise.all([listCatalog(agent.tenantId, { page }), siteOrigin()]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const cards = items.map(toCardProperty);
  const role = [agent.headline, agent.city].filter(Boolean).join(" · ");

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "RealEstateAgent",
          ...compact({
            name: agent.displayName,
            url: `${origin}/agentes/${agent.tenantSlug}`,
            image: absoluteImage(agent.photoUrl, origin),
            telephone: agent.phone ?? agent.whatsapp,
            email: agent.email,
            areaServed: agent.city,
            sameAs: Object.values(agent.socials),
          }),
        }}
      />
      <header className="bg-paper">
        <div className={`${container} pt-4 pb-10 lg:pt-8 lg:pb-14`}>
          <Breadcrumbs crumbs={[{ label: "Agentes", href: "/agentes" }]} origin={origin} current={agent.displayName} />
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
            <AgentAvatar agent={agent} size={112} className="size-28 text-3xl" />
            <div className="min-w-0">
              <h1 className="font-display text-display-lg text-balance text-ink">{agent.displayName}</h1>
              {role ? <p className="mt-2 text-lead text-ink-muted">{role}</p> : null}
              <div className="mt-5 flex flex-wrap gap-3">
                <WhatsAppButton phone={agent.whatsapp} message={`Hola ${agent.displayName}, vi tus propiedades en el portal.`} label="Escribir por WhatsApp" />
                {agent.phone ? (
                  <Button href={`tel:${agent.phone.replace(/[^\d+]/g, "")}`} variant="ghost">
                    Llamar
                  </Button>
                ) : null}
                {agent.email ? (
                  <Button href={`mailto:${agent.email}`} variant="ghost">
                    Correo
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          {agent.bio ? <p className="mt-8 max-w-3xl text-lead whitespace-pre-line text-pretty text-ink">{agent.bio}</p> : null}
          {agent.affiliation ? <p className="mt-4 text-sm text-ink-muted">{agent.affiliation}</p> : null}
        </div>
      </header>
      <section aria-labelledby="propiedades-agente" className="flex-1 bg-sand py-12 lg:py-16">
        <div className={container}>
          <h2 id="propiedades-agente" className="font-display text-display-md text-ink">
            {total === 1 ? "1 propiedad publicada" : `${total} propiedades publicadas`}
          </h2>
          {cards.length ? (
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {cards.map((p, i) => (
                <li key={p.slug}>
                  <PropertyCard property={p} href={`/propiedades/${p.slug}`} preload={i === 0} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState className="mt-8 max-w-2xl" surface="white" headingLevel={3} title="Todavía no hay propiedades publicadas" description="Vuelve pronto o escríbele para contarle qué buscas." />
          )}
          {pages > 1 ? (
            <nav aria-label="Paginación" className="mt-10 flex items-center justify-between gap-4 text-sm text-ink-muted">
              {page > 1 ? <Button href={`/agentes/${agent.tenantSlug}${page > 2 ? `?page=${page - 1}` : ""}`} variant="ghost">‹ Anterior</Button> : <span />}
              <p>
                Página {page} de {pages}
              </p>
              {page < pages ? <Button href={`/agentes/${agent.tenantSlug}?page=${page + 1}`} variant="ghost">Siguiente ›</Button> : <span />}
            </nav>
          ) : null}
        </div>
      </section>
    </>
  );
}
