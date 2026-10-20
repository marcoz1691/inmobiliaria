import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireMember } from "@/server/session";
import { listFunnels } from "@/modules/funnels/service";
import { FUNNEL_TEMPLATES } from "@/modules/funnels/scoring";
import { funnelMetrics, getAvailability, getMyProfile } from "@/modules/agents/admin";
import { PageHeader } from "@/components/admin/PageHeader";
import { CreateFunnel, FunnelStatusToggle, UtmBuilder } from "@/components/admin/FunnelControls";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Embudos" };

const STATUS = { draft: "Borrador", active: "Activo", paused: "Pausado" } as const;

export default async function FunnelsPage() {
  const m = await requireMember();
  const profile = await getMyProfile(m);
  const [funnels, metrics, rules] = await Promise.all([listFunnels(m), funnelMetrics(m), profile ? getAvailability(m, profile.id) : []]);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Captación" title="Embudos" description="Un embudo califica a quien llega de un anuncio y le deja agendar una cita contigo." />

      {rules.length === 0 ? (
        <div role="note" className="mt-6 border-t-2 border-reserved bg-reserved-bg/60 p-4">
          <p className="text-base text-ink">Aún no configuras tus horarios. Puedes crear embudos, pero no activarlos hasta definir cuándo atiendes.</p>
          <Button href="/panel/agenda" variant="secondary" className="mt-3">
            Configurar horarios
          </Button>
        </div>
      ) : null}

      <section aria-labelledby="list" className="mt-8">
        <h2 id="list" className="font-display text-2xl text-ink">
          Tus embudos
        </h2>
        {funnels.length ? (
          <ul className="mt-4 space-y-8">
            {funnels.map((f) => {
              const k = metrics[f.id] ?? { submissions: 0, qualified: 0, bookings: 0 };
              return (
                <li key={f.id} className="border-t border-ink pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-xl text-ink">{f.name}</h3>
                      <p className="text-sm text-ink-muted">
                        {STATUS[f.status]} · /agenda/{f.slug}
                      </p>
                    </div>
                    <FunnelStatusToggle id={f.id} status={f.status} name={f.name} />
                  </div>
                  <dl className="mt-4 grid grid-cols-3 border-t border-line">
                    {[
                      ["Envíos", k.submissions],
                      ["Calificados", k.qualified],
                      ["Citas", k.bookings],
                    ].map(([label, n]) => (
                      <div key={label} className="flex flex-col-reverse gap-1 border-b border-line py-3">
                        <dt className="text-sm text-ink-muted">{label}</dt>
                        <dd className="font-display text-3xl leading-none text-ink">{n}</dd>
                      </div>
                    ))}
                  </dl>
                  <details className="mt-4">
                    <summary className="min-h-11 cursor-pointer content-center text-sm font-medium text-ink">
                      Ver preguntas y umbral ({f.questions.length} preguntas, mínimo {f.threshold} puntos)
                    </summary>
                    <ol className="mt-2 list-decimal space-y-3 pl-5 text-sm text-ink">
                      {f.questions.map((q) => (
                        <li key={q.id}>
                          <p className="font-medium">{q.label}</p>
                          {q.options?.length ? (
                            <ul className="mt-1 text-ink-muted">
                              {q.options.map((o) => (
                                <li key={o.value}>
                                  {o.label} · {o.score} pts{o.disqualify ? " · descalifica" : ""}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </details>
                  <details className="mt-2">
                    <summary className="min-h-11 cursor-pointer content-center text-sm font-medium text-ink">Crear enlace para anuncios</summary>
                    <UtmBuilder baseUrl={`${origin}/agenda/${f.slug}`} />
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-base text-ink-muted">Aún no tienes embudos. Crea el primero desde una plantilla.</p>
        )}
      </section>

      <section aria-labelledby="new" className="mt-10 border-t border-line pt-6">
        <h2 id="new" className="font-display text-2xl text-ink">
          Nuevo embudo desde plantilla
        </h2>
        <div className="mt-4">
          <CreateFunnel templates={FUNNEL_TEMPLATES.map((t) => ({ key: t.key, name: t.name, description: `${t.headline}. ${t.questions.length} preguntas, cita de ${t.durationMinutes} min.` }))} />
        </div>
      </section>
    </div>
  );
}
