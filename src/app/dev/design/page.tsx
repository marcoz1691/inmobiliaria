import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/env";
import { AgentHero } from "@/components/public/AgentHero";
import { OPERATION_LABEL, formatLocation } from "@/components/public/format";
import { PropertyCard } from "@/components/public/PropertyCard";
import { PropertyFacts } from "@/components/public/PropertyFacts";
import { PropertyGallery } from "@/components/public/PropertyGallery";
import { SiteFooter } from "@/components/public/SiteFooter";
import { SiteHeader, type NavItem } from "@/components/public/SiteHeader";
import { WhatsAppButton } from "@/components/public/WhatsAppButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Price } from "@/components/ui/Price";
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
  { label: "Ficha", href: "#ficha" },
  { label: "Estados", href: "#estados" },
  { label: "Contacto", href: "#contacto" },
];

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
      <SiteHeader
        name={AGENT.name}
        tagline={AGENT.role}
        homeHref="/dev/design"
        nav={NAV}
        ctaHref="#contacto"
      />

      <main id="contenido" className="flex-1">
        <AgentHero
          name={AGENT.name}
          role={AGENT.role}
          eyebrow={AGENT.tagline}
          headline="Decisiones grandes, con información clara."
          intro={
            <p>
              [Ejemplo] Te acompaño desde la primera visita hasta la firma, con precios
              comparados y documentos revisados antes de que tomes una decisión.
            </p>
          }
          areas={["Cumbayá", "Tumbaco", "Quito norte", "Valle de los Chillos"]}
          photoSrc="/dev-assets/agente-hero.webp"
          photoAlt="Retrato del agente con traje azul marino y corbata gris en una oficina luminosa"
          whatsapp={AGENT.whatsapp}
          ctaHref="#contacto"
        />

        {/* Featured */}
        <section id="destacadas" aria-labelledby="destacadas-title" className="border-t border-line py-16 lg:py-24">
          <div className={container}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-eyebrow font-medium text-clay uppercase">Selección</p>
                <h2 id="destacadas-title" className="mt-3 font-display text-display-lg text-ink">
                  Propiedades destacadas
                </h2>
              </div>
              <Button href="#ficha" variant="ghost" className="-mx-5">
                Ver todas las propiedades
              </Button>
            </div>

            <div className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:mt-14 lg:grid-cols-12">
              <PropertyCard
                property={lead}
                href="#ficha"
                feature
                className="sm:col-span-2 lg:col-span-6"
                sizes="(min-width: 1280px) 600px, (min-width: 1024px) 50vw, 100vw"
              />
              {rest.map((p) => (
                <PropertyCard
                  key={p.slug}
                  property={p}
                  href="#ficha"
                  className="lg:col-span-3"
                  sizes="(min-width: 1280px) 300px, (min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                />
              ))}
            </div>
          </div>
        </section>

        {/* Property detail */}
        <section id="ficha" aria-labelledby="ficha-title" className="border-t border-line bg-white py-16 lg:py-24">
          <div className={container}>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-eyebrow text-ink-muted uppercase">
                {lead.propertyType} · {OPERATION_LABEL[lead.operation]}
              </p>
              <Badge status={lead.status} />
            </div>
            <h2 id="ficha-title" className="mt-4 max-w-3xl font-display text-display-lg text-balance text-ink">
              {lead.title}
            </h2>
            <p className="mt-3 text-base text-ink-muted">{formatLocation(lead)} · ubicación aproximada</p>

            <div className="mt-8 lg:mt-10">
              <PropertyGallery images={lead.images} title={lead.title} />
            </div>

            <div className="mt-10 grid gap-12 lg:mt-14 lg:grid-cols-12 lg:gap-16">
              <aside
                aria-label="Precio y contacto"
                className="lg:sticky lg:top-28 lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:self-start"
              >
                <p className="text-sm text-ink-muted">Precio de venta</p>
                <Price
                  amount={lead.price}
                  priceKind={lead.priceKind}
                  className="mt-1 block font-display text-display-md text-ink"
                />
                <div className="mt-6 flex flex-col gap-3">
                  <Button href="#contacto" size="lg">
                    Agenda una visita
                  </Button>
                  <WhatsAppButton
                    phone={AGENT.whatsapp}
                    size="lg"
                    label="Pregunta por WhatsApp"
                    message={`Hola ${AGENT.name}, me interesa "${lead.title}" (ref. ${lead.slug}). ¿Podemos coordinar una visita?`}
                  />
                </div>
                <p className="mt-4 text-sm text-ink-muted">Ref. {lead.slug}</p>
              </aside>

              <div className="lg:col-span-8 lg:row-start-1">
                <p className="max-w-2xl text-lg leading-relaxed text-pretty text-ink">
                  [Ejemplo] Casa de dos plantas en una calle tranquila, con espacios sociales
                  abiertos al jardín y dormitorios separados del área de estar.
                </p>
                <PropertyFacts property={lead} headingLevel={3} className="mt-12" />
              </div>
            </div>
          </div>
        </section>

        {/* States */}
        <section id="estados" aria-labelledby="estados-title" className="border-t border-line py-16 lg:py-24">
          <div className={container}>
            <p className="text-eyebrow font-medium text-clay uppercase">Sistema</p>
            <h2 id="estados-title" className="mt-3 font-display text-display-lg text-ink">
              Estados
            </h2>

            <div className="mt-10 grid gap-x-12 gap-y-16 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-ink-muted">Carga</h3>
                <div aria-busy="true" className="mt-4 grid grid-cols-2 gap-6">
                  <span role="status" className="sr-only">
                    Cargando propiedades…
                  </span>
                  {[0, 1].map((i) => (
                    <div key={i}>
                      <Skeleton className="aspect-[4/3]" />
                      <Skeleton className="mt-4 h-3 w-1/3" />
                      <Skeleton className="mt-3 h-5 w-4/5" />
                      <Skeleton className="mt-2 h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-ink-muted">Vacío</h3>
                <EmptyState
                  className="mt-4"
                  headingLevel={4}
                  title="No hay propiedades con estos filtros"
                  description="Prueba con otro sector o amplía el rango de precio. También puedes escribirme y te aviso cuando aparezca algo así."
                  action={<Button variant="secondary">Quitar filtros</Button>}
                />
              </div>

              <div>
                <h3 className="text-sm font-medium text-ink-muted">Error</h3>
                <EmptyState
                  className="mt-4"
                  headingLevel={4}
                  tone="error"
                  title="No pudimos cargar las propiedades"
                  description="Revisa tu conexión e inténtalo otra vez. Si el problema sigue, escríbeme por WhatsApp."
                  action={<Button variant="secondary">Reintentar</Button>}
                />
              </div>

              <div>
                <h3 className="text-sm font-medium text-ink-muted">Confirmación</h3>
                <EmptyState
                  className="mt-4"
                  headingLevel={4}
                  tone="success"
                  title="Recibí tu solicitud de cita"
                  description="[Ejemplo] Te escribiré para confirmar el día y la hora. No necesitas hacer nada más."
                  action={
                    <Button href="#destacadas" variant="ghost" className="-mx-5">
                      Seguir viendo propiedades
                    </Button>
                  }
                />
              </div>
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
