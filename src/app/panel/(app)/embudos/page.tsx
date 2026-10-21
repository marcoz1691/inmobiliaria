import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireMember } from "@/server/session";
import { listFunnels } from "@/modules/funnels/service";
import { FUNNEL_TEMPLATES } from "@/modules/funnels/scoring";
import { funnelMetrics, getAvailability, getMyProfile } from "@/modules/agents/admin";
import { PageHeader } from "@/components/admin/PageHeader";
import { CreateFunnel, FunnelStatusToggle, UtmBuilder } from "@/components/admin/FunnelControls";
import { Pill } from "@/components/admin/StatusTag";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { GroupBody, IconTile, ListGroup, ListRow } from "@/components/admin/ui/ListGroup";

export const metadata: Metadata = { title: "Embudos" };

const STATUS = { draft: "Borrador", active: "Activo", paused: "Pausado" } as const;
const STATUS_TONE = { draft: "gray", active: "green", paused: "amber" } as const;

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

      <div className="grid gap-8">
        {rules.length === 0 ? (
          <ListGroup footer="Puedes crear embudos, pero no activarlos hasta definir cuándo atiendes.">
            <ListRow
              href="/panel/agenda"
              leading={<IconTile name="clock" tone="amber" />}
              title="Aún no configuras tus horarios"
              subtitle="Sin horario, el embudo no puede ofrecer citas."
            />
          </ListGroup>
        ) : null}

        <section aria-labelledby="list">
          <h2 id="list" className="sr-only">
            Tus embudos
          </h2>
          {funnels.length ? (
            <div className="grid gap-6">
              {funnels.map((f) => {
                const k = metrics[f.id] ?? { submissions: 0, qualified: 0, bookings: 0 };
                return (
                  <ListGroup
                    key={f.id}
                    as="div"
                    title={f.name}
                    titleId={`funnel-${f.id}`}
                    action={<FunnelStatusToggle id={f.id} status={f.status} name={f.name} />}
                    footer={`/agenda/${f.slug}`}
                  >
                    <GroupBody>
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={STATUS_TONE[f.status]}>{STATUS[f.status]}</Pill>
                      </div>
                      <dl className="mt-4 grid grid-cols-3 gap-3">
                        {(
                          [
                            ["Envíos", k.submissions],
                            ["Calificados", k.qualified],
                            ["Citas", k.bookings],
                          ] as const
                        ).map(([label, n]) => (
                          <div key={label} className="flex flex-col-reverse gap-1 rounded-sm bg-ink/[0.04] px-3 py-3">
                            <dt className="text-sm text-ink-muted">{label}</dt>
                            <dd className="text-[1.75rem] leading-none font-bold tracking-[-0.03em] text-ink tabular-nums">{n}</dd>
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
                      <details className="mt-1">
                        <summary className="min-h-11 cursor-pointer content-center text-sm font-medium text-ink">Crear enlace para anuncios</summary>
                        <UtmBuilder baseUrl={`${origin}/agenda/${f.slug}`} />
                      </details>
                    </GroupBody>
                  </ListGroup>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="funnel" title="Aún no tienes embudos" description="Crea el primero desde una plantilla. Luego lo compartes en tus anuncios." />
          )}
        </section>

        <ListGroup as="div" title="Nuevo embudo desde plantilla" titleId="new">
          <GroupBody>
            <CreateFunnel templates={FUNNEL_TEMPLATES.map((t) => ({ key: t.key, name: t.name, description: `${t.headline}. ${t.questions.length} preguntas, cita de ${t.durationMinutes} min.` }))} />
          </GroupBody>
        </ListGroup>
      </div>
    </div>
  );
}
