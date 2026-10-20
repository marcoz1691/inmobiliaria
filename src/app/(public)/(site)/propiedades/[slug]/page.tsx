import type { Metadata } from "next";
import Link from "next/link";
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
import { WhatsAppButton } from "@/components/public/WhatsAppButton";
import { formatLocation } from "@/components/public/format";
import { Badge, statusLabel } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import { CONSENT_TEXT } from "@/modules/crm/service";
import { OPERATION_LABEL, TYPE_LABEL } from "@/modules/properties/domain";
import { getPublicProperty, listRelated, type PublicListing } from "@/modules/properties/service";
import { submitInquiry } from "../../../_lib/actions";
import { HONEYPOT_FIELD, issueFormToken } from "../../../_lib/guard";
import { absoluteImage, getSite, siteOrigin } from "../../../_lib/site";

const container = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12";

const lookup = cache(async (slug: string) => {
  const site = await getSite();
  return getPublicProperty(site.tenantId, slug);
});

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
  const [site, origin] = await Promise.all([getSite(), siteOrigin()]);
  const related = (await listRelated(site.tenantId, l, 3)).map(toCardProperty);
  const card = toCardProperty(l);
  const status = card.status;
  const closed = status !== "available";
  const url = `${origin}/propiedades/${l.slug}`;
  const where = formatLocation(l);

  return (
    <>
      <JsonLd data={listingJsonLd(l, url, origin)} />
      <article className={`${container} pt-6 pb-16 lg:pt-10 lg:pb-24`}>
        <nav aria-label="Ruta de navegación" className="text-sm text-ink-muted">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/propiedades" className="inline-flex min-h-11 items-center underline-offset-4 hover:text-ink hover:underline">
                Propiedades
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="line-clamp-1">
              {l.title}
            </li>
          </ol>
        </nav>

        <header className="mt-2 mb-8 flex flex-col gap-3 lg:mb-10">
          <p className="text-eyebrow font-medium text-clay uppercase">
            {card.propertyType} · {OPERATION_LABEL[card.operation]}
          </p>
          <h1 className="max-w-4xl font-display text-display-lg text-balance text-ink">{l.title}</h1>
          <div className="flex flex-wrap items-center gap-3">
            {where ? <p className="text-lg text-ink-muted">{where}</p> : null}
            {closed ? <Badge status={status} /> : null}
          </div>
        </header>

        <PropertyGallery images={card.images} title={l.title} />

        <div className="mt-10 grid gap-12 lg:mt-14 lg:grid-cols-12 lg:gap-x-12">
          <aside aria-label="Precio y contacto" className="lg:col-span-4 lg:col-start-9 lg:row-start-1">
            <div className="flex flex-col gap-5 border-t-2 border-ink pt-5 lg:sticky lg:top-28">
              <div>
                <p className="text-sm text-ink-muted">{l.operation === "rent" ? "Alquiler mensual" : "Precio"}</p>
                <Price amount={l.price} priceKind={l.priceKind} className="mt-1 block font-display text-display-md text-ink" />
                {l.priceNote ? <p className="mt-1 text-sm text-ink-muted">{l.priceNote}</p> : null}
              </div>
              {closed ? (
                <div className="flex flex-col gap-3 border-t border-line pt-4">
                  <p className="text-base text-ink">
                    Esta propiedad está <strong className="font-medium">{statusLabel(status).toLowerCase()}</strong>.
                    {status === "reserved" ? " Aún puedes consultar por ella o ver opciones parecidas." : " Mira opciones parecidas."}
                  </p>
                  <Button href="#similares" size="lg" className="w-full">
                    Ver propiedades similares
                  </Button>
                </div>
              ) : (
                <Button href={site.bookingHref} size="lg" className="w-full">
                  Agenda una visita
                </Button>
              )}
              <WhatsAppButton
                phone={site.agent?.whatsapp}
                size="lg"
                className="w-full"
                message={`Hola, me interesa ${l.title} (${url})`}
              />
              <Link href="#consulta" className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-ink underline underline-offset-4">
                Hacer una consulta por escrito
              </Link>
            </div>
          </aside>

          <div className="flex flex-col gap-14 lg:col-span-8 lg:row-start-1">
            <PropertyFacts property={card} />

            {l.description ? (
              <section aria-labelledby="descripcion">
                <h2 id="descripcion" className="text-eyebrow font-medium text-clay uppercase">
                  Descripción
                </h2>
                <div className="mt-4 max-w-prose text-lg leading-relaxed whitespace-pre-line text-pretty text-ink">{l.description}</div>
              </section>
            ) : null}

            {l.map ? (
              <section aria-labelledby="ubicacion">
                <h2 id="ubicacion" className="text-eyebrow font-medium text-clay uppercase">
                  Ubicación
                </h2>
                <p className="mt-2 mb-4 text-base text-ink-muted">
                  {l.map.radiusMeters !== null
                    ? `Zona aproximada${where ? ` en ${where}` : ""}. La dirección exacta se comparte al agendar la visita.`
                    : (l.address ?? where)}
                </p>
                <PropertyMap point={l.map} label={`Mapa de la ubicación de ${l.title}`} />
              </section>
            ) : null}

            <section id="consulta" aria-labelledby="consulta-title" className="border-t border-line pt-10">
              <h2 id="consulta-title" className="font-display text-display-md text-ink">
                Pregunta por esta propiedad
              </h2>
              <p className="mt-2 mb-6 max-w-prose text-base text-ink-muted">Te respondo por el medio que prefieras.</p>
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

      {related.length > 0 ? (
        <section id="similares" aria-labelledby="similares-title" className="border-t border-line py-16 lg:py-24">
          <div className={container}>
            <h2 id="similares-title" className="font-display text-display-lg text-ink">
              Propiedades similares
            </h2>
            <ul className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8">
              {related.map((p) => (
                <li key={p.slug}>
                  <PropertyCard property={p} href={`/propiedades/${p.slug}`} />
                </li>
              ))}
            </ul>
            <p className="mt-10">
              <Link href="/propiedades" className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-4">
                Ver todas las propiedades
              </Link>
            </p>
          </div>
        </section>
      ) : closed ? (
        <section id="similares" aria-labelledby="similares-title" className="border-t border-line py-16">
          <div className={container}>
            <h2 id="similares-title" className="font-display text-display-md text-ink">
              Propiedades similares
            </h2>
            <p className="mt-3 text-base text-ink-muted">
              Por ahora no hay otras parecidas publicadas.{" "}
              <Link href="/propiedades" className="font-medium text-ink underline underline-offset-4">
                Ver el catálogo
              </Link>
            </p>
          </div>
        </section>
      ) : null}
    </>
  );
}
