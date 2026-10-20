import type { Metadata } from "next";
import { InquiryForm } from "@/components/public/InquiryForm";
import { WhatsAppButton } from "@/components/public/WhatsAppButton";
import { Button } from "@/components/ui/Button";
import { CONSENT_TEXT } from "@/modules/crm/service";
import { submitInquiry } from "../../_lib/actions";
import { HONEYPOT_FIELD, issueFormToken } from "../../_lib/guard";
import { getSite } from "../../_lib/site";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Escríbeme para comprar, vender o alquilar una propiedad.",
  alternates: { canonical: "/contacto" },
};

const container = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12";

export default async function ContactPage() {
  const site = await getSite();
  const { agent } = site;
  const rows = [
    agent?.email ? { label: "Correo", value: agent.email, href: `mailto:${agent.email}` } : null,
    agent?.phone ? { label: "Teléfono", value: agent.phone, href: `tel:${agent.phone.replace(/[^\d+]/g, "")}` } : null,
    agent?.city ? { label: "Ciudad", value: agent.city, href: null } : null,
  ].filter((r): r is { label: string; value: string; href: string | null } => r !== null);
  const hasActions = Boolean(agent?.whatsapp || site.funnelHref);

  return (
    <>
      <header className="bg-paper">
        <div className={`${container} max-w-4xl pt-14 pb-12 text-center lg:pt-24 lg:pb-16`}>
          <p className="text-eyebrow text-clay">Contacto</p>
          <h1 className="mt-3 font-display text-display-xl text-balance text-ink">Conversemos sobre lo que buscas.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lead text-pretty text-ink-muted">
            Cuéntame si quieres comprar, vender o alquilar, y te respondo por el medio que prefieras.
          </p>
          {hasActions ? (
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {site.funnelHref ? (
                <Button href={site.funnelHref} size="lg">
                  Agenda una cita
                </Button>
              ) : null}
              <WhatsAppButton phone={agent?.whatsapp} size="lg" message={`Hola ${site.name}, quisiera más información.`} />
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex-1 bg-sand">
        <div className={`${container} grid gap-6 py-10 lg:grid-cols-12 lg:gap-8 lg:py-16`}>
          {rows.length > 0 ? (
            <section aria-labelledby="datos-title" className="lg:col-span-4">
              <div className="rounded-lg bg-white p-6 sm:p-8 lg:sticky lg:top-20">
                <h2 id="datos-title" className="text-headline text-ink">
                  Datos de contacto
                </h2>
                <dl className="mt-4 divide-y divide-line">
                  {rows.map((r) => (
                    <div key={r.label} className="flex flex-col py-3">
                      <dt className="text-sm text-ink-muted">{r.label}</dt>
                      <dd className="text-[1.0625rem] text-ink">
                        {r.href ? (
                          <a href={r.href} className="inline-flex min-h-11 items-center break-all text-link underline-offset-4 hover:underline">
                            {r.value}
                          </a>
                        ) : (
                          <span className="inline-flex min-h-11 items-center">{r.value}</span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>
          ) : null}

          <section
            aria-labelledby="form-title"
            className={rows.length > 0 ? "lg:col-span-8" : "lg:col-span-8 lg:col-start-3"}
          >
            <div className="rounded-lg bg-white p-6 sm:p-10">
              <h2 id="form-title" className="font-display text-display-md text-ink">
                Envíame un mensaje
              </h2>
              <p className="mt-2 text-[1.0625rem] text-ink-muted">Te respondo lo antes posible.</p>
              <div className="mt-8 max-w-2xl">
                <InquiryForm action={submitInquiry} formToken={issueFormToken()} honeypotName={HONEYPOT_FIELD} consentText={CONSENT_TEXT} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
