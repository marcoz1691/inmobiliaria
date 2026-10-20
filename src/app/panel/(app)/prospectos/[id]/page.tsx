import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/server/session";
import { DEAL_STAGES, STAGE_LABEL, getDeal, type DealStage } from "@/modules/crm/service";
import { dealSubmission } from "@/modules/agents/admin";
import { AppError } from "@/lib/errors";
import { Button } from "@/components/ui/Button";
import { StageSelect } from "@/components/admin/StageSelect";
import { NoteForm, Tasks } from "@/components/admin/DealForms";

export const metadata: Metadata = { title: "Prospecto" };

const fmt = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });

const ACTIVITY: Record<string, string> = {
  inquiry: "Consulta desde el sitio",
  funnel_submitted: "Respondió el embudo",
  stage_changed: "Cambio de etapa",
  note: "Nota",
  booking_created: "Agendó una cita",
  booking_cancelled: "Canceló la cita",
  booking_completed: "Asistió a la cita",
  booking_no_show: "No asistió a la cita",
  opted_out: "Pidió no recibir mensajes",
};

function activityText(a: { type: string; body: string | null; data: Record<string, unknown> }): string | null {
  if (a.type === "stage_changed") {
    const from = STAGE_LABEL[a.data.from as DealStage] ?? String(a.data.from ?? "");
    const to = STAGE_LABEL[a.data.to as DealStage] ?? String(a.data.to ?? "");
    return `${from} → ${to}`;
  }
  return a.body;
}

export default async function DealPage({ params }: PageProps<"/panel/prospectos/[id]">) {
  const m = await requireMember();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let deal;
  try {
    deal = await getDeal(m, id);
  } catch (err) {
    if (err instanceof AppError) notFound();
    throw err;
  }
  const submission = await dealSubmission(m, id);
  const c = deal.contact;
  const name = c.name || c.email || c.phone || "Sin nombre";
  const wa = c.phone ? c.phone.replace(/[^\d]/g, "") : null;
  const stages = DEAL_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/panel/prospectos" className="inline-flex min-h-11 items-center text-sm text-ink underline-offset-4 hover:underline">
        <span aria-hidden="true">←&nbsp;</span>Prospectos
      </Link>
      <header className="border-b border-line pb-6">
        <p className="text-eyebrow text-clay uppercase">{STAGE_LABEL[deal.deal.stage]}</p>
        <h1 className="mt-1 font-display text-display-md text-ink">{name}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {[deal.deal.source, `desde ${fmt.format(deal.deal.createdAt)}`, c.optedOutAt ? "No desea mensajes automáticos" : null].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {c.phone ? (
            <Button href={`tel:${c.phone}`} variant="secondary">
              Llamar
            </Button>
          ) : null}
          {wa ? (
            <Button href={`https://wa.me/${wa}`} variant="secondary">
              WhatsApp
            </Button>
          ) : null}
          {c.email ? (
            <Button href={`mailto:${c.email}`} variant="secondary">
              Correo
            </Button>
          ) : null}
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {c.phone ? (
            <div>
              <dt className="inline text-ink-muted">Teléfono: </dt>
              <dd className="inline text-ink">{c.phone}</dd>
            </div>
          ) : null}
          {c.email ? (
            <div>
              <dt className="inline text-ink-muted">Correo: </dt>
              <dd className="inline break-all text-ink">{c.email}</dd>
            </div>
          ) : null}
          {deal.propertyTitle ? (
            <div className="sm:col-span-2">
              <dt className="inline text-ink-muted">Propiedad: </dt>
              <dd className="inline text-ink">{deal.propertyTitle}</dd>
            </div>
          ) : null}
        </dl>
      </header>

      <section aria-labelledby="stage" className="mt-6">
        <h2 id="stage" className="sr-only">
          Etapa
        </h2>
        <div className="max-w-xs">
          <StageSelect dealId={id} stage={deal.deal.stage} stages={stages} contactName={name} />
        </div>
        {deal.deal.stage === "lost" && deal.deal.lostReason ? <p className="mt-2 text-sm text-ink-muted">Motivo: {deal.deal.lostReason}</p> : null}
      </section>

      {deal.deal.message ? (
        <section aria-labelledby="msg" className="mt-8">
          <h2 id="msg" className="font-display text-xl text-ink">
            Mensaje
          </h2>
          <p className="mt-2 whitespace-pre-line text-base text-ink">{deal.deal.message}</p>
        </section>
      ) : null}

      {submission ? (
        <section aria-labelledby="funnel" className="mt-8">
          <h2 id="funnel" className="font-display text-xl text-ink">
            Respuestas del embudo
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {submission.funnelName} · Puntaje {submission.score} (mínimo {submission.threshold}) · {submission.qualified ? "Calificado" : `No calificado${submission.disqualifiedReason ? `: ${submission.disqualifiedReason}` : ""}`}
          </p>
          <dl className="mt-3 divide-y divide-line border-y border-line">
            {submission.answers.map((a) => (
              <div key={a.question} className="py-2">
                <dt className="text-sm text-ink-muted">{a.question}</dt>
                <dd className="text-base text-ink">{a.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="tasks" className="mt-8">
        <h2 id="tasks" className="font-display text-xl text-ink">
          Tareas
        </h2>
        <div className="mt-3">
          <Tasks
            dealId={id}
            tasks={deal.tasks.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt?.toISOString() ?? null, doneAt: t.doneAt?.toISOString() ?? null }))}
          />
        </div>
      </section>

      <section aria-labelledby="timeline" className="mt-8">
        <h2 id="timeline" className="font-display text-xl text-ink">
          Historial
        </h2>
        <div className="mt-3">
          <NoteForm dealId={id} />
        </div>
        {deal.timeline.length ? (
          <ol className="mt-6 border-l border-line pl-4">
            {deal.timeline.map((a) => {
              const text = activityText(a);
              return (
                <li key={a.id} className="relative pb-5">
                  <span aria-hidden="true" className="absolute top-2 -left-[1.3rem] size-2 rounded-full bg-line-strong" />
                  <p className="text-sm font-medium text-ink">{ACTIVITY[a.type] ?? a.type}</p>
                  <p className="text-xs text-ink-muted">
                    <time dateTime={a.createdAt.toISOString()}>{fmt.format(a.createdAt)}</time>
                  </p>
                  {text ? <p className="mt-1 whitespace-pre-line text-base text-ink">{text}</p> : null}
                </li>
              );
            })}
          </ol>
        ) : null}
      </section>
    </div>
  );
}
