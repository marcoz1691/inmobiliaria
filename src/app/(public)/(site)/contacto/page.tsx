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

export default async function ContactPage() {
  const site = await getSite();
  const { agent } = site;
  const rows = [
    agent?.email ? { label: "Correo", value: agent.email, href: `mailto:${agent.email}` } : null,
    agent?.phone ? { label: "Teléfono", value: agent.phone, href: `tel:${agent.phone.replace(/[^\d+]/g, "")}` } : null,
    agent?.city ? { label: "Ciudad", value: agent.city, href: null } : null,
  ].filter((r): r is { label: string; value: string; href: string | null } => r !== null);

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-x-12">
        <header className="lg:col-span-5">
          <p className="text-eyebrow font-medium text-clay uppercase">Contacto</p>
          <h1 className="mt-3 font-display text-display-lg text-balance text-ink">Conversemos sobre lo que buscas</h1>
          <p className="mt-4 max-w-md text-lg text-pretty text-ink-muted">
            Cuéntame si quieres comprar, vender o alquilar, y te respondo por el medio que prefieras.
          </p>

          {rows.length > 0 ? (
            <dl className="mt-8 border-t border-line">
              {rows.map((r) => (
                <div key={r.label} className="flex flex-wrap items-baseline justify-between gap-x-6 border-b border-line py-3">
                  <dt className="text-sm text-ink-muted">{r.label}</dt>
                  <dd className="text-base text-ink">
                    {r.href ? (
                      <a href={r.href} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                        {r.value}
                      </a>
                    ) : (
                      r.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <WhatsAppButton phone={agent?.whatsapp} message={`Hola ${site.name}, quisiera más información.`} />
            {site.funnelHref ? (
              <Button href={site.funnelHref} variant="secondary">
                Agenda una cita
              </Button>
            ) : null}
          </div>
        </header>

        <section aria-labelledby="form-title" className="lg:col-span-6 lg:col-start-7">
          <h2 id="form-title" className="font-display text-display-md text-ink">
            Envíame un mensaje
          </h2>
          <div className="mt-6">
            <InquiryForm action={submitInquiry} formToken={issueFormToken()} honeypotName={HONEYPOT_FIELD} consentText={CONSENT_TEXT} />
          </div>
        </section>
      </div>
    </div>
  );
}
