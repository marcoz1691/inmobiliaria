import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { InquiryForm } from "@/components/public/InquiryForm";
import { compact, JsonLd } from "@/components/public/JsonLd";
import { publicStatus, toCardProperty } from "@/components/public/listing";
import { PropertyCard } from "@/components/public/PropertyCard";
import { PropertyFacts } from "@/components/public/PropertyFacts";
import { PropertyGallery } from "@/components/public/PropertyGallery";
import { PropertyMap } from "@/components/public/PropertyMap";
import { ShareButtons } from "@/components/public/ShareButtons";
import { StickyActionBar } from "@/components/public/StickyActionBar";
import { WhatsAppButton } from "@/components/public/WhatsAppButton";
import { formatLocation } from "@/components/public/format";
import { Badge, statusLabel } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MoreLink } from "@/components/ui/MoreLink";
import { Price } from "@/components/ui/Price";
import { Reveal } from "@/components/ui/Reveal";
import { CONSENT_TEXT } from "@/modules/crm/service";
import { OPERATION_LABEL, TYPE_LABEL } from "@/modules/properties/domain";
import { citySlug } from "@/modules/properties/landing";
import { getPublicProperty, listRelated, type PublicListing } from "@/modules/properties/service";
import { Breadcrumbs, landingCrumbs } from "../../_catalog/CatalogView";
import { submitInquiry } from "../../../_lib/actions";
import { HONEYPOT_FIELD, issueFormToken } from "../../../_lib/guard";
import { absoluteImage, getScope, getSite, isPortal, siteOrigin } from "../../../_lib/site";
import { AgentAvatar } from "../../_portal/AgentCard";
import { getListingAgent } from "@/modules/agents/portal";
import Link from "next/link";

const container = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12";

const lookup = cache(async (slug: string) => getPublicProperty(await getScope(), slug));

function summary(l: PublicListing): string {
  const kind = [l.propertyType ? TYPE_LABEL[l.propertyType] : "Propiedad", l.operation ? `en ${OPERATION_LABEL[l.operation].toLowerCase()}` : null]
    .filter(Boolean)
    .join(" ");
  const where = formatLocation(l);
  const lead = `${kind}${where ? ` en ${where}` : ""}.`;
  const text = l.description ? `${lead} ${l.description.replace(/\s+/g, " ")}` : lead;
  return text.length > 158 ? `${text.slice(0, 157).trimEnd()}…` : text;
}

export async function generateMetadata({ params }: PageProps<"/propiedades/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const result = await lookup(slug);
  if (result.kind !== "ok") return { title: "Propiedad no disponible", robots: { index: false, follow: true } };
  const l = result.listing;
  const origin = await siteOrigin();
  const image = absoluteImage(l.cover?.src, origin);
  const images = image ? [{ url: image, width: 1600, alt: l.cover?.alt ?? l.title }] : undefined;
  return {
    title: l.title,
    description: summary(l),
    alternates: { canonical: `/propiedades/${l.slug}` },
    openGraph: { type: "article", title: l.title, description: summary(l), url: `/propiedades/${l.slug}`, images },
    twitter: { card: image ? "summary_large_image" : "summary", title: l.title, description: summary(l), images: image ? [image] : undefined },
  };
}

const AVAILABILITY = {
  available: "https://schema.org/InStock",
  reserved: "https://schema.org/LimitedAvailability",
  sold: "https://schema.org/SoldOut",
  rented: "https://schema.org/SoldOut",
} as const;

function listingJsonLd(l: PublicListing, url: string, origin: string) {
  const status = publicStatus(l.status);
  const showPrice = l.price !== null && l.priceKind !== "appraisal";
  const area = l.builtArea ?? l.landArea;
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    ...compact({
      name: l.title,
      description: l.description ?? undefined,
      url,
      image: l.images.map((i) => absoluteImage(i.src, origin)).filter(Boolean),
      datePosted: l.publishedAt?.toISOString(),
      offers: showPrice
        ? {
            "@type": "Offer",
            price: l.price,
            priceCurrency: "USD",
            availability: AVAILABILITY[status],
            businessFunction: l.operation === "rent" ? "http://purl.org/goodrelations/v1#LeaseOut" : "http://purl.org/goodrelations/v1#Sell",
          }
        : undefined,
      about: {
        "@type": "Accommodation",
        ...compact({
          floorSize: area !== null ? { "@type": "QuantitativeValue", value: area, unitCode: "MTK" } : undefined,
          numberOfBedrooms: l.bedrooms ?? undefined,
          numberOfBathroomsTotal: l.bathrooms ?? undefined,
          // Street address only when the agent chose to show the exact location.
          address: {
            "@type": "PostalAddress",
            ...compact({
              streetAddress: l.address ?? undefined,
              addressLocality: [l.sector, l.city].filter(Boolean).join(", ") || undefined,
              addressRegion: l.province ?? undefined,
              addressCountry: "EC",
            }),
          },
        }),
      },
    }),
  };
}

export default async function PropertyPage({ params }: PageProps<"/propiedades/[slug]">) {
  const { slug } = await params;
  const result = await lookup(slug);
  if (result.kind === "missing") notFound();
  // Archived listings answer 410 Gone from a dedicated handler (pages cannot set that status).
  if (result.kind === "gone") redirect(`/propiedades/${encodeURIComponent(slug)}/no-disponible`);

  const l = result.listing;
  const [scope, portal, origin] = await Promise.all([getScope(), isPortal(), siteOrigin()]);
  const related = (await listRelated(scope, l, 3)).map(toCardProperty);
  // On the portal the listing's own agent answers; on an agent's site, the site's agent and funnel.
  const agent = portal ? await getListingAgent(l.tenantId, l.agentId) : null;
  const site = portal ? null : await getSite();
  const whatsapp = portal ? agent?.whatsapp : site?.agent?.whatsapp;
  const booking = site ? { href: site.bookingHref, label: "Agenda una visita" } : { href: "#consulta", label: "Contactar al agente" };
  const card = toCardProperty(l);
  const status = card.status;
  const closed = status !== "available";
  const url = `${origin}/propiedades/${l.slug}`;
  const where = formatLocation(l);

  // The trail leads back to the searches this listing belongs to ("Casas en venta" › "Quito").
  const crumbs =
    l.operation && l.propertyType
      ? landingCrumbs({ operation: l.operation, type: l.propertyType, city: l.city ? citySlug(l.city) : undefined }, l.city ?? undefined)
      : [{ label: "Propiedades", href: "/propiedades" }];


  return (
    <>
      <JsonLd data={listingJsonLd(l, url, origin)} />
      <article className="pb-20 lg:pb-28">
        <div className={`${container} pt-4 lg:pt-8`}>
          <Breadcrumbs crumbs={crumbs} origin={origin} current={l.title} />

          <header className="mt-2 mb-8 flex flex-col gap-3 lg:mb-10">
            <p className="text-eyebrow text-clay">
              {card.propertyType} · {OPERATION_LABEL[card.operation]}
            </p>
            <h1 className="max-w-5xl font-display text-display-lg text-balance text-ink">{l.title}</h1>
            <div className="flex flex-wrap items-center gap-3">
              {where ? <p className="text-lead text-ink-muted">{where}</p> : null}
              {closed ? <Badge status={status} /> : null}
            </div>
          </header>

          <PropertyGallery images={card.images} title={l.title} />
        </div>

        <div className={`${container} mt-10 grid gap-14 lg:mt-16 lg:grid-cols-12 lg:gap-x-16`}>
          <aside id="precio" aria-label="Precio y contacto" className="lg:col-span-4 lg:col-start-9 lg:row-start-1">
            <div className="flex flex-col gap-4 rounded-lg bg-sand p-6 sm:p-8 lg:sticky lg:top-20">
              <div>
                <p className="text-[0.9375rem] text-ink-muted">{l.operation === "rent" ? "Alquiler mensual" : "Precio"}</p>
                <Price amount={l.price} priceKind={l.priceKind} className="mt-1 block font-display text-display-md" />
                {l.priceNote ? <p className="mt-2 text-sm text-ink-muted">{l.priceNote}</p> : null}
              </div>
              {closed ? (
                <div className="flex flex-col gap-3 border-t border-line pt-4">
                  <p className="text-base text-ink">
                    Esta propiedad está <strong className="font-semibold">{statusLabel(status).toLowerCase()}</strong>.
                    {status === "reserved" ? " Aún puedes consultar por ella o ver opciones parecidas." : " Mira opciones parecidas."}
                  </p>
                  <Button href="#similares" size="lg" className="w-full">
                    Ver propiedades similares
                  </Button>
                </div>
              ) : (
                <Button href={booking.href} size="lg" className="mt-2 w-full">
                  {booking.label}
                </Button>
              )}
              <WhatsAppButton
                phone={whatsapp}
                size="lg"
                className="w-full"
                message={`Hola, me interesa ${l.title} (${url})`}
              />
              {agent ? (
                agent.phone ? (
                <a
                  href={`tel:${agent.phone.replace(/[^\d+]/g, "")}`}
                  className="inline-flex min-h-11 items-center justify-center text-[1.0625rem] text-link underline-offset-4 hover:underline"
                >
                  Llamar al {agent.phone}
                </a>
                ) : null
              ) : (
                <MoreLink href="#consulta" className="self-center">
                  Hacer una consulta por escrito
                </MoreLink>
              )}
              {agent ? (
                <div className="flex items-center gap-4 border-t border-line pt-5">
                  <AgentAvatar agent={agent} size={56} className="size-14" />
                  <div className="min-w-0">
                    <p className="text-sm text-ink-muted">Publicado por</p>
                    <p className="truncate text-[1.0625rem] font-semibold text-ink">{agent.displayName}</p>
                    <Link href={`/agentes/${agent.tenantSlug}`} className="inline-flex min-h-11 items-center text-[0.9375rem] text-link underline-offset-4 hover:underline">
                      Ver sus propiedades
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>

          <div className="flex flex-col gap-16 lg:col-span-7 lg:row-start-1">
            <Reveal>
              <PropertyFacts property={card} />
            </Reveal>

            {l.description ? (
              <Reveal>
                <section aria-labelledby="descripcion">
                  <h2 id="descripcion" className="font-display text-display-md text-ink">
                    Descripción
                  </h2>
                  <div className="mt-5 max-w-prose text-lead whitespace-pre-line text-pretty text-ink">{l.description}</div>
                </section>
              </Reveal>
            ) : null}

            {l.map ? (
              <Reveal>
                <section aria-labelledby="ubicacion">
                  <h2 id="ubicacion" className="font-display text-display-md text-ink">
                    Ubicación
                  </h2>
                  <p className="mt-3 mb-6 max-w-prose text-[1.0625rem] text-ink-muted">
                    {l.map.radiusMeters !== null
                      ? `Zona aproximada${where ? ` en ${where}` : ""}. Te comparto la dirección exacta cuando coordinemos la visita.`
                      : (l.address ?? where)}
                  </p>
                  <PropertyMap point={l.map} label={`Mapa de la ubicación de ${l.title}`} />
                </section>
              </Reveal>
            ) : null}

            <section id="consulta" aria-labelledby="consulta-title" className="rounded-lg bg-sand p-6 sm:p-10">
              <h2 id="consulta-title" className="font-display text-display-md text-ink">
                Pregunta por esta propiedad
              </h2>
              <p className="mt-2 mb-8 max-w-prose text-[1.0625rem] text-ink-muted">
                {agent ? `Tu mensaje le llega directo a ${agent.displayName}, que te responde por el medio que prefieras.` : "Te respondo por el medio que prefieras."}
              </p>
              <div className="max-w-xl">
                <InquiryForm
                  action={submitInquiry}
                  formToken={issueFormToken()}
                  honeypotName={HONEYPOT_FIELD}
                  consentText={CONSENT_TEXT}
                  propertyId={l.id}
                  defaultMessage={`Hola, me interesa ${l.title}. ¿Podemos coordinar más información?`}
                  submitLabel="Enviar consulta"
                />
              </div>
            </section>

            <ShareButtons url={url} title={l.title} />
          </div>
        </div>
      </article>

      <StickyActionBar watchId="precio">
        <div className="mx-auto flex h-19 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="min-w-0">
            <p className="text-xs text-ink-muted">{l.operation === "rent" ? "Alquiler mensual" : "Precio"}</p>
            <Price amount={l.price} priceKind={l.priceKind} className="block truncate text-[1.0625rem] font-semibold" />
          </div>
          {closed ? (
            <Button href="#similares" className="shrink-0">
              Ver similares
            </Button>
          ) : (
            <Button href={booking.href} className="shrink-0">
              {booking.label}
            </Button>
          )}
        </div>
      </StickyActionBar>

      {related.length > 0 ? (
        <section id="similares" aria-labelledby="similares-title" className="bg-sand py-20 lg:py-28">
          <div className={container}>
            <Reveal className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
              <h2 id="similares-title" className="font-display text-display-lg text-ink">
                Propiedades similares.
              </h2>
              <MoreLink href="/propiedades">Ver todas las propiedades</MoreLink>
            </Reveal>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-6">
              {related.map((p, i) => (
                <li key={p.slug}>
                  <Reveal delay={i * 90} className="h-full">
                    <PropertyCard property={p} href={`/propiedades/${p.slug}`} />
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : closed ? (
        <section id="similares" aria-labelledby="similares-title" className="bg-sand py-16 lg:py-20">
          <div className={container}>
            <h2 id="similares-title" className="font-display text-display-md text-ink">
              Propiedades similares
            </h2>
            <p className="mt-3 text-[1.0625rem] text-ink-muted">Por ahora no hay otras parecidas publicadas.</p>
            <MoreLink href="/propiedades" className="mt-2">
              Ver el catálogo
            </MoreLink>
          </div>
        </section>
      ) : null}
    </>
  );
}
