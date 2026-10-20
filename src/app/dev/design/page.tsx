import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/env";
import { AgentHero } from "@/components/public/AgentHero";
import { PropertyCard } from "@/components/public/PropertyCard";
import { PropertyFacts } from "@/components/public/PropertyFacts";
import { PropertyGallery } from "@/components/public/PropertyGallery";
import { PropertySpotlight } from "@/components/public/PropertySpotlight";
import { ChipLinks, SegmentedLinks } from "@/components/public/QuickFilters";
import { SiteFooter } from "@/components/public/SiteFooter";
import { SiteHeader, type NavItem } from "@/components/public/SiteHeader";
import { WhatsAppButton } from "@/components/public/WhatsAppButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MoreLink } from "@/components/ui/MoreLink";
import { Price } from "@/components/ui/Price";
import { Reveal } from "@/components/ui/Reveal";
import { Skeleton } from "@/components/ui/Skeleton";
import { demoProperties } from "./demo-data";

export const metadata: Metadata = {
  title: "Dirección visual (demo interna)",
  robots: { index: false, follow: false },
};

// Fictitious demo values. A clearly non-real number keeps the WhatsApp CTA visible.
const AGENT = {
  name: "Nombre Apellido",
  role: "Asesor inmobiliario",
  tagline: "[Ejemplo] Asesor inmobiliario · Quito",
  whatsapp: "+593 00 000 0000",
  email: "correo@ejemplo.com",
};

const NAV: NavItem[] = [
  { label: "Propiedades", href: "#destacadas" },
  { label: "Sistema", href: "#sistema" },
  { label: "Estados", href: "#estados" },
  { label: "Contacto", href: "#contacto" },
];

const SWATCHES = [
  ["paper", "bg-paper border border-line"],
  ["sand", "bg-sand"],
  ["mist", "bg-mist"],
  ["ink", "bg-ink"],
  ["night", "bg-night"],
  ["navy", "bg-navy"],
  ["link", "bg-link"],
  ["clay", "bg-clay"],
] as const;

const container = "mx-auto max-w-7xl px-5 sm:px-8 lg:px-12";

export default function DesignDemoPage() {
  // Internal design reference: never served in production.
  if (env.NODE_ENV === "production") notFound();
  const [lead, ...rest] = demoProperties;
  if (!lead) return null;

  return (
    <>
      <p className="bg-sand px-5 py-2 text-center text-xs text-ink-muted">
        Página interna de diseño. Los datos marcados <strong className="font-medium text-ink">[Ejemplo]</strong>{" "}
        son ficticios.
      </p>
      <SiteHeader name={AGENT.name} tagline={AGENT.tagline} homeHref="/dev/design" nav={NAV} ctaHref="#contacto" />

      <main id="contenido" className="flex-1">
        <AgentHero
          name={AGENT.name}
          role={AGENT.role}
          eyebrow={AGENT.tagline}
          headline="Decisiones grandes, con información clara."
          intro={<p>[Ejemplo] Te acompaño desde la primera visita hasta la firma.</p>}
          areas={["Cumbayá", "Tumbaco", "Quito norte", "Valle de los Chillos"]}
          photoSrc="/dev-assets/agente-hero.webp"
          photoAlt="Retrato del agente con traje azul marino y corbata gris en una oficina luminosa"
          whatsapp={AGENT.whatsapp}
          ctaHref="#contacto"
          secondaryHref="#destacadas"
        />

        <section id="destacadas" aria-labelledby="destacadas-title" className="bg-sand py-20 lg:py-28">
          <div className={container}>
            <Reveal className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
              <h2 id="destacadas-title" className="font-display text-display-lg text-ink">
                Propiedades destacadas.
              </h2>
              <MoreLink href="#sistema">Ver todas las propiedades</MoreLink>
            </Reveal>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:mt-14 lg:grid-cols-12">
              <li className="sm:col-span-2 lg:col-span-7 lg:row-span-2">
                <PropertyCard property={lead} href="#sistema" feature sizes="(min-width: 1024px) 58vw, 100vw" />
              </li>
              {rest.map((p, i) => (
                <li key={p.slug} className="lg:col-span-5">
                  <Reveal delay={i * 90} className="h-full">
                    <PropertyCard property={p} href="#sistema" sizes="(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 100vw" />
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <PropertySpotlight property={lead} href="#sistema" bookingHref="#contacto" />

        <section id="sistema" aria-labelledby="sistema-title" className="py-20 lg:py-28">
          <div className={container}>
            <p className="text-eyebrow text-clay">Sistema</p>
            <h2 id="sistema-title" className="mt-3 font-display text-display-lg text-ink">
              Tipografía, color y controles.
            </h2>

            <div className="mt-12 grid gap-12 lg:grid-cols-2">
              <div className="flex flex-col gap-4">
                <p className="font-display text-display-xl text-ink">Display XL</p>
                <p className="font-display text-display-lg text-ink">Display LG</p>
                <p className="font-display text-display-md text-ink">Display MD</p>
                <p className="text-headline text-ink">Headline</p>
                <p className="text-lead text-ink-muted">Lead: texto de apoyo bajo un titular.</p>
                <p className="text-eyebrow text-clay">Eyebrow</p>
              </div>
              <div className="flex flex-col gap-8">
                <ul className="grid grid-cols-4 gap-3">
                  {SWATCHES.map(([name, cls]) => (
                    <li key={name}>
                      <span className={`block aspect-square rounded-sm ${cls}`} />
                      <span className="mt-1 block text-xs text-ink-muted">{name}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-3">
                  <Button>Primario</Button>
                  <Button variant="secondary">Secundario</Button>
                  <Button variant="ghost">Fantasma</Button>
                  <MoreLink href="#sistema">Ver más</MoreLink>
                </div>
                <div className="flex flex-wrap items-center gap-3 rounded-md bg-night p-5">
                  <Button variant="inverse">Inverso</Button>
                  <MoreLink href="#sistema" tone="dark">
                    Ver más
                  </MoreLink>
                </div>
                <SegmentedLinks
                  label="Tipo de operación"
                  options={[
                    { label: "Todas", href: "#sistema", active: true },
                    { label: "Venta", href: "#sistema?venta", active: false },
                    { label: "Alquiler", href: "#sistema?alquiler", active: false },
                  ]}
                />
                <ChipLinks
                  label="Tipo de propiedad"
                  options={[
                    { label: "Todos los tipos", href: "#sistema", active: false },
                    { label: "Casa", href: "#sistema?casa", active: true },
                    { label: "Departamento", href: "#sistema?depa", active: false },
                    { label: "Terreno", href: "#sistema?terreno", active: false },
                  ]}
                />
                <div className="flex flex-wrap gap-2">
                  <Badge status="available" />
                  <Badge status="reserved" />
                  <Badge status="sold" />
                  <Badge status="rented" />
                </div>
              </div>
            </div>

            <div className="mt-20">
              <PropertyGallery images={lead.images} title={lead.title} />
            </div>
            <div className="mt-12 grid gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-7">
                <PropertyFacts property={lead} headingLevel={3} />
              </div>
              <aside aria-label="Precio y contacto" className="lg:col-span-4 lg:col-start-9">
                <div className="flex flex-col gap-4 rounded-lg bg-sand p-6 sm:p-8">
                  <p className="text-[0.9375rem] text-ink-muted">Precio</p>
                  <Price amount={lead.price} priceKind={lead.priceKind} className="-mt-3 block font-display text-display-md" />
                  <Button href="#contacto" size="lg">
                    Agenda una visita
                  </Button>
                  <WhatsAppButton phone={AGENT.whatsapp} size="lg" message={`Hola ${AGENT.name}, me interesa "${lead.title}".`} />
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section id="estados" aria-labelledby="estados-title" className="bg-sand py-20 lg:py-28">
          <div className={container}>
            <h2 id="estados-title" className="font-display text-display-lg text-ink">
              Estados.
            </h2>
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <div aria-busy="true" className="grid grid-cols-2 gap-4 rounded-md bg-white p-6">
                <span role="status" className="sr-only">
                  Cargando propiedades…
                </span>
                {[0, 1].map((i) => (
                  <div key={i}>
                    <Skeleton className="aspect-[4/3]" />
                    <Skeleton className="mt-4 h-3 w-1/3" />
                    <Skeleton className="mt-3 h-5 w-4/5" />
                  </div>
                ))}
              </div>
              <EmptyState
                surface="white"
                headingLevel={3}
                title="No hay propiedades con estos filtros"
                description="Prueba con otro sector o amplía el rango de precio."
                action={<Button variant="secondary">Quitar filtros</Button>}
              />
              <EmptyState
                surface="white"
                headingLevel={3}
                tone="error"
                title="No pudimos cargar las propiedades"
                description="Revisa tu conexión e inténtalo otra vez."
                action={<Button variant="secondary">Reintentar</Button>}
              />
              <EmptyState
                surface="white"
                headingLevel={3}
                tone="success"
                title="Recibí tu solicitud de cita"
                description="[Ejemplo] Te escribiré para confirmar el día y la hora."
              />
            </div>
          </div>
        </section>
      </main>

      <div id="contacto">
        <SiteFooter
          name={AGENT.name}
          tagline={AGENT.tagline}
          nav={NAV}
          whatsapp={AGENT.whatsapp}
          email={AGENT.email}
          location="[Ejemplo] Quito, Ecuador"
          legal="[Ejemplo] Información referencial; precios y disponibilidad sujetos a confirmación."
        />
      </div>
    </>
  );
}
