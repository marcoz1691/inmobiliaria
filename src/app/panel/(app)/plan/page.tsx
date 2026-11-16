import type { Metadata } from "next";
import { env } from "@/env";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/admin/ui/Button";
import { Icon } from "@/components/admin/ui/Icon";
import { card } from "@/components/admin/ui/ListGroup";
import { cn } from "@/components/ui/cn";
import { IVA_RATE, PLAN_IDS, PLANS, type Plan } from "@/modules/billing/plans";
import { planUsage } from "@/modules/billing/service";
import { requireMember } from "@/server/session";

export const metadata: Metadata = { title: "Tu plan" };

const usd = (n: number) => `US$${n.toLocaleString("es-EC", { maximumFractionDigits: 2 })}`;
const date = new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeZone: "America/Guayaquil" });

function Meter({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-ink">{label}</span>
        <span className="text-ink-muted tabular-nums">
          {used} de {max}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/10" role="presentation">
        <div className={cn("h-full rounded-full", pct >= 100 ? "bg-sold" : "bg-navy")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Plans and usage. Online payment is not connected yet: paid plans are activated by the portal
 * team (`npm run plan:set`), and the page says so instead of pretending to charge.
 */
export default async function PlanPage({ searchParams }: PageProps<"/panel/plan">) {
  const m = await requireMember();
  const welcome = (await searchParams).bienvenida !== undefined;
  const { plan, live, featured, aiUsed } = await planUsage(m);
  const wa = env.BILLING_WHATSAPP?.replace(/\D/g, "");
  const activateHref = (p: Plan) =>
    wa ? `https://wa.me/${wa}?text=${encodeURIComponent(`Hola, quiero activar el plan ${p.name} (US$${p.priceUsd}/mes) para mi cuenta "${m.tenantSlug}".`)}` : null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={welcome ? "¡Tu cuenta está lista!" : "Cuenta"}
        title={welcome ? "Elige cómo empezar" : "Tu plan"}
        description={
          welcome
            ? "Empieza gratis con una propiedad para probar el portal. Cuando quieras publicar más, mejora tu plan."
            : "Lo que incluye tu plan y cuánto llevas usado este mes."
        }
      />

      <section aria-labelledby="uso" className={cn(card, "grid gap-5 p-5 sm:grid-cols-[1fr_2fr] sm:p-6")}>
        <div>
          <h2 id="uso" className="text-sm font-medium text-ink-muted">
            Plan actual
          </h2>
          <p className="mt-1 text-[1.75rem] leading-tight font-bold tracking-[-0.02em] text-ink">{plan.name}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {plan.priceUsd ? `${usd(plan.priceUsd)} al mes + IVA` : "Sin costo"}
            {plan.expiresAt && plan.id !== "free" ? ` · vigente hasta el ${date.format(plan.expiresAt)}` : ""}
          </p>
          {plan.chosen !== plan.id ? (
            <p className="mt-2 text-sm font-medium text-reserved">Tu plan {PLANS[plan.chosen].name} venció: funcionas como Gratis hasta renovarlo.</p>
          ) : null}
        </div>
        <div className="grid gap-4">
          <Meter label="Propiedades publicadas" used={live} max={plan.maxListings} />
          <Meter label="PDFs leídos con IA este mes" used={aiUsed} max={plan.aiImportsPerMonth} />
          {plan.maxFeatured > 0 ? <Meter label="Propiedades destacadas" used={featured} max={plan.maxFeatured} /> : null}
        </div>
      </section>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_IDS.map((id) => {
          const p = PLANS[id];
          const current = p.id === plan.id;
          const href = activateHref(p);
          return (
            <li key={id} className={cn(card, "relative flex flex-col p-5", p.highlight && "ring-2 ring-navy")}>
              {p.highlight ? <span className="absolute -top-3 left-5 rounded-full bg-navy px-3 py-1 text-xs font-semibold text-white">Más elegido</span> : null}
              <h3 className="text-[1.25rem] font-bold tracking-[-0.02em] text-ink">{p.name}</h3>
              <p className="mt-1 text-sm text-ink-muted">{p.pitch}</p>
              <p className="mt-4">
                <span className="text-[2rem] font-bold tracking-[-0.03em] text-ink">{p.priceUsd ? usd(p.priceUsd) : "Gratis"}</span>
                {p.priceUsd ? <span className="text-sm text-ink-muted"> /mes + IVA</span> : null}
              </p>
              {p.priceUsd ? <p className="text-xs text-ink-muted">{usd(Math.round(p.priceUsd * (1 + IVA_RATE) * 100) / 100)} con IVA</p> : null}
              <ul className="mt-4 grid flex-1 content-start gap-2 text-sm text-ink">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Icon name="check" className="mt-0.5 size-4 shrink-0 text-available" strokeWidth={2.4} />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {current ? (
                  <p className="flex min-h-11 items-center justify-center rounded-full bg-ink/[0.06] text-[0.9375rem] font-semibold text-ink">Tu plan actual</p>
                ) : p.id === "free" ? (
                  <p className="flex min-h-11 items-center justify-center text-center text-sm text-ink-muted">Siempre disponible</p>
                ) : href ? (
                  <Button href={href} variant={p.highlight ? "filled" : "tinted"} className="w-full" target="_blank" rel="noopener noreferrer">
                    Activar {p.name}
                  </Button>
                ) : (
                  <p className="text-center text-sm text-ink-muted">Pago en línea próximamente</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-sm text-ink-muted">
        {wa
          ? "Por ahora los planes se activan con nuestro equipo por WhatsApp; el pago en línea llegará pronto. "
          : "El pago en línea todavía no está habilitado en este portal. "}
        Si dejas de pagar, tus propiedades no se borran: solo no podrás publicar más de lo que permite el plan Gratis.
      </p>

      {welcome ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/panel/propiedades/nueva" size="lg">
            Publicar mi primera propiedad
          </Button>
          <Button href="/panel/importar" variant="tinted" size="lg">
            Subir un PDF
          </Button>
        </div>
      ) : null}
    </div>
  );
}
