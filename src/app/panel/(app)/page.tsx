import Link from "next/link";
import { requireMember } from "@/server/session";
import { DEAL_STAGES, STAGE_LABEL, dashboardCounts, listDeals, type DealStage } from "@/modules/crm/service";
import { listUpcomingBookings } from "@/modules/funnels/service";
import { listForPanel } from "@/modules/properties/service";
import { getAvailability, getMyProfile, missingProfileFields } from "@/modules/agents/admin";
import { cn } from "@/components/ui/cn";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/admin/ui/Button";
import { Icon, type IconName } from "@/components/admin/ui/Icon";
import { IconTile, ListGroup, ListItem, ListRow, rowInteractive, type TileTone } from "@/components/admin/ui/ListGroup";
import { BookingDate, KIND_LABEL, bookingFull, bookingTime } from "@/components/admin/BookingDate";

type Attention = { href: string; title: string; detail: string; icon: IconName; tone: TileTone };

const today = new Intl.DateTimeFormat("es-EC", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Guayaquil" });

/** Stage colors for the pipeline bar; the legend always carries the label and the number. */
const STAGE_COLOR: Record<DealStage, string> = {
  new: "bg-navy",
  qualified: "bg-rented",
  booked: "bg-clay",
  attended: "bg-available",
  offer: "bg-reserved",
  won: "bg-available/60",
  lost: "bg-sold",
  no_show: "bg-ink-muted",
  nurture: "bg-line-strong",
};

export default async function DashboardPage() {
  const m = await requireMember();
  const [counts, bookings, drafts, profile, deals] = await Promise.all([dashboardCounts(m), listUpcomingBookings(m), listForPanel(m, { status: "draft" }), getMyProfile(m), listDeals(m)]);
  const rules = profile ? await getAvailability(m, profile.id) : [];
  const names = new Map(deals.map((d) => [d.deal.id, d.contact.name || d.contact.email || d.contact.phone || "Sin nombre"]));
  const newLeads = counts.deals.new ?? 0;
  const toReview = drafts.filter((d) => d.needsReview);
  const missing = missingProfileFields(profile);

  const stats: { label: string; value: number; href: string; icon: IconName; tone: TileTone }[] = [
    { label: "Prospectos nuevos", value: newLeads, href: "/panel/prospectos", icon: "people", tone: "navy" },
    { label: "Citas próximas", value: bookings.length, href: "/panel/agenda", icon: "calendar", tone: "red" },
    { label: "Borradores pendientes", value: counts.properties.draft ?? 0, href: "/panel/propiedades?estado=draft", icon: "pencil", tone: "amber" },
    { label: "Publicadas", value: counts.properties.published ?? 0, href: "/panel/propiedades?estado=published", icon: "globe", tone: "green" },
  ];

  const attention: Attention[] = [];
  if (newLeads > 0)
    attention.push({ href: "/panel/prospectos", title: newLeads === 1 ? "1 prospecto nuevo sin atender" : `${newLeads} prospectos nuevos sin atender`, detail: "Responder rápido multiplica las citas.", icon: "people", tone: "navy" });
  if (counts.tasksDue > 0)
    attention.push({ href: "/panel/prospectos", title: counts.tasksDue === 1 ? "1 tarea por vencer o atrasada" : `${counts.tasksDue} tareas por vencer o atrasadas`, detail: "Vencen en las próximas 24 horas o ya pasaron.", icon: "tasks", tone: "red" });
  for (const d of toReview.slice(0, 3))
    attention.push({ href: `/panel/propiedades/${d.id}`, title: `Revisar borrador importado: ${d.title || "sin título"}`, detail: "Confirma los datos leídos del PDF antes de publicar.", icon: "docImport", tone: "amber" });
  if (toReview.length > 3) attention.push({ href: "/panel/propiedades?estado=draft", title: `${toReview.length - 3} borradores importados más por revisar`, detail: "Abre la lista de borradores.", icon: "docImport", tone: "amber" });
  if (missing.length) attention.push({ href: "/panel/perfil", title: "Completa tu perfil", detail: `Falta: ${missing.join(", ")}. Tu sitio oculta lo que no has llenado.`, icon: "person", tone: "clay" });
  if (profile && rules.length === 0) attention.push({ href: "/panel/agenda", title: "Configura tus horarios de atención", detail: "Sin horarios, tus embudos no pueden ofrecer citas.", icon: "clock", tone: "blue" });

  const pipeline = DEAL_STAGES.map((s) => ({ stage: s, n: counts.deals[s] ?? 0 })).filter((x) => x.n > 0);
  const totalDeals = pipeline.reduce((a, b) => a + b.n, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={<span className="first-letter:uppercase">{today.format(new Date())}</span>}
        title={`Hola, ${m.userName}`}
        actions={
          <Button href="/panel/propiedades/nueva" size="lg" icon="plus" className="w-full sm:w-auto">
            Publicar propiedad
          </Button>
        }
      />

      <section aria-labelledby="stats">
        <h2 id="stats" className="sr-only">
          Resumen
        </h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <li key={s.label}>
              <Link
                href={s.href}
                className={cn("group flex h-full flex-col rounded-md bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-ink/[0.04] focus-visible:outline-offset-2 sm:p-5", "transition-[scale,box-shadow] duration-300 ease-apple hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] active:scale-[0.98]")}
              >
                <span className="flex items-start justify-between">
                  <IconTile name={s.icon} tone={s.tone} />
                  <Icon name="chevronRight" className="size-4 text-ink-muted/50 transition-[translate] duration-300 group-hover:translate-x-0.5" strokeWidth={2.2} />
                </span>
                <span className="mt-4 text-[2rem] leading-none font-bold tracking-[-0.03em] text-ink tabular-nums sm:text-[2.25rem]">{s.value}</span>
                <span className="mt-1.5 text-sm leading-snug font-medium text-ink-muted">{s.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
        <ListGroup title="Lo que requiere tu atención" titleId="attention">
          {attention.length ? (
            attention.map((a) => <ListRow key={a.href + a.title} href={a.href} leading={<IconTile name={a.icon} tone={a.tone} />} title={<span className="font-medium">{a.title}</span>} subtitle={a.detail} />)
          ) : (
            <ListRow leading={<IconTile name="check" tone="green" />} title={<span className="font-medium">Todo al día</span>} subtitle="Nada pendiente por ahora." />
          )}
        </ListGroup>

        <div className="grid gap-8">
          <ListGroup
            title="Próximas citas"
            titleId="next-bookings"
            action={
              <Link href="/panel/agenda" className="inline-flex min-h-11 items-center rounded-full px-2 text-[0.9375rem] text-navy hover:bg-navy/[0.07]">
                Ver agenda
              </Link>
            }
          >
            {bookings.length ? (
              bookings.slice(0, 3).map((b) => {
                const who = (b.dealId && names.get(b.dealId)) || "Sin nombre";
                return (
                  <ListItem key={b.id} inset="icon">
                    <Link href={b.dealId ? `/panel/prospectos/${b.dealId}` : "/panel/agenda"} className={cn("flex min-h-16 items-center gap-3 px-4 py-2.5", rowInteractive)}>
                      <BookingDate date={b.startsAt} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium text-ink">{who}</span>
                        <span className="block text-sm text-ink-muted">
                          <span className="sr-only">{bookingFull(b.startsAt)}</span>
                          <span aria-hidden="true">{bookingTime(b.startsAt)}</span> · {KIND_LABEL[b.meetingKind] ?? b.meetingKind}
                        </span>
                      </span>
                      <Icon name="chevronRight" className="-mr-1 size-[1.125rem] text-ink-muted/60" strokeWidth={2.2} />
                    </Link>
                  </ListItem>
                );
              })
            ) : (
              <ListRow leading={<IconTile name="calendar" tone="gray" />} title="Sin citas próximas" subtitle={rules.length ? "Cuando alguien agende desde tu embudo, aparece aquí." : "Primero define tus horarios de atención."} />
            )}
          </ListGroup>

          {totalDeals > 0 ? (
            <ListGroup as="div" title="Prospectos por etapa" titleId="pipeline" footer={`${totalDeals} en total. Solo se muestran las etapas con prospectos.`}>
              <div className="p-4">
                <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                  {pipeline.map((p) => (
                    <span key={p.stage} className={cn("h-full first:rounded-l-full last:rounded-r-full", STAGE_COLOR[p.stage])} style={{ flexGrow: p.n }} />
                  ))}
                </div>
                <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {pipeline.map((p) => (
                    <li key={p.stage} className="flex items-center gap-2 text-sm">
                      <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", STAGE_COLOR[p.stage])} />
                      <span className="min-w-0 flex-1 truncate text-ink">{STAGE_LABEL[p.stage]}</span>
                      <span className="font-semibold text-ink tabular-nums">{p.n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ListGroup>
          ) : null}
        </div>
      </div>
    </div>
  );
}
