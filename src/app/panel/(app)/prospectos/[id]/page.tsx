import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireMember } from "@/server/session";
import { DEAL_STAGES, STAGE_LABEL, getDeal, type DealStage } from "@/modules/crm/service";
import { dealSubmission } from "@/modules/agents/admin";
import { AppError } from "@/lib/errors";
import { PageHeader } from "@/components/admin/PageHeader";
import { StageSelect } from "@/components/admin/StageSelect";
import { NoteForm, Tasks } from "@/components/admin/DealForms";
import { Button } from "@/components/admin/ui/Button";
import { GroupBody, IconTile, ListGroup, ListRow } from "@/components/admin/ui/ListGroup";

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
      <PageHeader
        back={{ href: "/panel/prospectos", label: "Prospectos" }}
        eyebrow={STAGE_LABEL[deal.deal.stage]}
        title={name}
        meta={
          <p className="text-sm text-ink-muted">
            {[deal.deal.source, `desde ${fmt.format(deal.deal.createdAt)}`, c.optedOutAt ? "No desea mensajes automáticos" : null].filter(Boolean).join(" · ")}
          </p>
        }
        actions={
          <>
            {c.phone ? (
              <Button href={`tel:${c.phone}`} variant="tinted" icon="phone" className="max-sm:flex-1">
                Llamar
              </Button>
            ) : null}
            {wa ? (
              <Button href={`https://wa.me/${wa}`} variant="tinted" icon="chat" className="max-sm:flex-1">
                WhatsApp
              </Button>
            ) : null}
            {c.email ? (
              <Button href={`mailto:${c.email}`} variant="gray" icon="mail" className="max-sm:flex-1">
                Correo
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-8">
        <ListGroup as="div" title="Etapa" titleId="stage">
          <GroupBody>
            <div className="max-w-xs">
              <StageSelect dealId={id} stage={deal.deal.stage} stages={stages} contactName={name} />
            </div>
            {deal.deal.stage === "lost" && deal.deal.lostReason ? <p className="mt-2 text-sm text-ink-muted">Motivo: {deal.deal.lostReason}</p> : null}
          </GroupBody>
        </ListGroup>

        {c.phone || c.email || deal.propertyTitle ? (
          <ListGroup title="Datos de contacto" titleId="contact">
            {c.phone ? <ListRow leading={<IconTile name="phone" tone="green" />} title="Teléfono" value={c.phone} /> : null}
            {c.email ? <ListRow leading={<IconTile name="mail" tone="blue" />} title="Correo" subtitle={c.email} /> : null}
            {deal.propertyTitle ? <ListRow leading={<IconTile name="building" tone="navy" />} title="Propiedad" subtitle={deal.propertyTitle} /> : null}
          </ListGroup>
        ) : null}

        {deal.deal.message ? (
          <ListGroup as="div" title="Mensaje" titleId="msg">
            <GroupBody>
              <p className="whitespace-pre-line text-base text-ink">{deal.deal.message}</p>
            </GroupBody>
          </ListGroup>
        ) : null}

        {submission ? (
          <ListGroup
            title="Respuestas del embudo"
            titleId="funnel"
            footer={`${submission.funnelName} · Puntaje ${submission.score} (mínimo ${submission.threshold}) · ${submission.qualified ? "Calificado" : `No calificado${submission.disqualifiedReason ? `: ${submission.disqualifiedReason}` : ""}`}`}
          >
            {submission.answers.map((a) => (
              <ListRow key={a.question} title={a.question} subtitle={a.answer} />
            ))}
          </ListGroup>
        ) : null}

        <ListGroup as="div" title="Tareas" titleId="tasks">
          <GroupBody>
            <Tasks
              dealId={id}
              tasks={deal.tasks.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt?.toISOString() ?? null, doneAt: t.doneAt?.toISOString() ?? null }))}
            />
          </GroupBody>
        </ListGroup>

        <ListGroup as="div" title="Historial" titleId="timeline">
          <GroupBody>
            <NoteForm dealId={id} />
            {deal.timeline.length ? (
              <ol className="mt-6 border-l border-line pl-4">
                {deal.timeline.map((a) => {
                  const text = activityText(a);
                  return (
                    <li key={a.id} className="relative pb-5 last:pb-0">
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
          </GroupBody>
        </ListGroup>
      </div>
    </div>
  );
}
