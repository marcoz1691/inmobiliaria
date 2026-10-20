import Link from "next/link";
import { AgentHero } from "@/components/public/AgentHero";
import { toCardProperty } from "@/components/public/listing";
import { PropertyCard } from "@/components/public/PropertyCard";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { listFeatured } from "@/modules/properties/service";
import { agentTagline, getSite } from "../_lib/site";

const container = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12";

// Editorial rhythm: lead item 6 columns, then 3 + 3, then rows of three. One or two items split evenly.
const featuredSpan = (i: number, n: number) =>
  n <= 2 ? "lg:col-span-6" : i === 0 ? "lg:col-span-6" : i < 3 ? "lg:col-span-3" : "lg:col-span-4";

export default async function HomePage() {
  const site = await getSite();
  const featured = (await listFeatured(site.tenantId, 6)).map(toCardProperty);
  const { agent } = site;

  return (
    <>
      <AgentHero
        name={site.name}
        role={agent?.headline ?? undefined}
        eyebrow={agentTagline(agent)}
        headline="Tu próxima propiedad, con acompañamiento de principio a fin."
        intro={
          <p>
            {agent?.bio ??
              "Revisa las propiedades disponibles, agenda una cita y resuelve tus dudas antes de decidir. Sin compromiso."}
          </p>
        }
        photoSrc={agent?.photoUrl}
        whatsapp={agent?.whatsapp}
        ctaHref={site.bookingHref}
        ctaLabel={site.funnelHref ? "Agenda una cita" : "Escríbeme"}
      />

      <section aria-labelledby="destacadas-title" className="border-t border-line py-16 lg:py-24">
        <div className={container}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-eyebrow font-medium text-clay uppercase">Selección</p>
              <h2 id="destacadas-title" className="mt-2 font-display text-display-lg text-ink">
                Propiedades destacadas
              </h2>
            </div>
            {featured.length > 0 ? (
              <Link
                href="/propiedades"
                className="inline-flex min-h-11 items-center text-base font-medium text-ink underline underline-offset-4 hover:text-navy"
              >
                Ver todas las propiedades
              </Link>
            ) : null}
          </div>

          {featured.length > 0 ? (
            <ul className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-12 lg:gap-x-8">
              {featured.map((p, i) => (
                <li key={p.slug} className={cn(featuredSpan(i, featured.length), i === 0 && featured.length !== 2 && "sm:col-span-2")}>
                  <PropertyCard
                    property={p}
                    href={`/propiedades/${p.slug}`}
                    feature={i === 0 && featured.length !== 2}
                    sizes={i === 0 ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              className="mt-10 max-w-2xl"
              headingLevel={3}
              title="Aún no hay propiedades publicadas"
              description="Estamos preparando las primeras fichas. Mientras tanto, cuéntame qué buscas y te aviso cuando haya opciones."
              action={<Button href={site.bookingHref}>{site.funnelHref ? "Agenda una cita" : "Escríbeme"}</Button>}
            />
          )}
        </div>
      </section>

      <section aria-labelledby="cta-title" className="bg-sand py-16 lg:py-24">
        <div className={cn(container, "grid gap-8 lg:grid-cols-12 lg:items-end")}>
          <div className="lg:col-span-8">
            <h2 id="cta-title" className="font-display text-display-lg text-balance text-ink">
              ¿Buscas comprar, vender o alquilar?
            </h2>
            <p className="mt-4 max-w-xl text-lg text-pretty text-ink-muted">
              {site.funnelHref
                ? "Responde unas preguntas rápidas y elige un horario para conversar."
                : "Cuéntame qué necesitas y te respondo lo antes posible."}
            </p>
          </div>
          <div className="lg:col-span-4 lg:justify-self-end">
            <Button href={site.bookingHref} size="lg">
              {site.funnelHref ? "Agenda una cita" : "Escríbeme"}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
