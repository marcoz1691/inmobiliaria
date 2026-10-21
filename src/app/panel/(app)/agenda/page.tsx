import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/server/session";
import { listUpcomingBookings } from "@/modules/funnels/service";
import { listDeals } from "@/modules/crm/service";
import { getAvailability, getMyProfile } from "@/modules/agents/admin";
import { PageHeader } from "@/components/admin/PageHeader";
import { WeeklyHours } from "@/components/admin/WeeklyHours";
import { BookingOutcome } from "@/components/admin/BookingOutcome";
import { BookingDate, KIND_LABEL, bookingFull, bookingTime } from "@/components/admin/BookingDate";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Button } from "@/components/admin/ui/Button";
import { IconTile, ListGroup, ListItem, ListRow, rowInteractive } from "@/components/admin/ui/ListGroup";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Agenda" };

/** Request time; past bookings of the last two weeks still need an outcome. */
function timeWindow() {
  const now = Date.now();
  return { now, since: new Date(now - 14 * 24 * 3600 * 1000) };
}

export default async function AgendaPage() {
  const m = await requireMember();
  const profile = await getMyProfile(m);
  const { now, since } = timeWindow();
  const [rules, bookings, deals] = await Promise.all([profile ? getAvailability(m, profile.id) : [], listUpcomingBookings(m, since), listDeals(m)]);
  const names = new Map(deals.map((d) => [d.deal.id, d.contact.name || d.contact.email || d.contact.phone || "Sin nombre"]));
  const past = bookings.filter((b) => b.startsAt.getTime() < now);
  const upcoming = bookings.filter((b) => b.startsAt.getTime() >= now);

  const row = (b: (typeof bookings)[number], withOutcome: boolean) => {
    const who = (b.dealId && names.get(b.dealId)) || "Sin nombre";
    return (
      <ListItem key={b.id} inset="icon">
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <BookingDate date={b.startsAt} />
            <div className="min-w-0">
              {b.dealId ? (
                <Link href={`/panel/prospectos/${b.dealId}`} className={cn("block truncate text-base font-medium text-ink hover:text-navy", rowInteractive, "rounded-xs")}>
                  {who}
                </Link>
              ) : (
                <p className="truncate text-base font-medium text-ink">{who}</p>
              )}
              <p className="text-sm text-ink-muted">
                <span className="sr-only">{bookingFull(b.startsAt)}</span>
                <span aria-hidden="true" className="first-letter:uppercase">
                  {bookingTime(b.startsAt)}
                </span>
                {" · "}
                {KIND_LABEL[b.meetingKind] ?? b.meetingKind}
              </p>
            </div>
          </div>
          {withOutcome ? <BookingOutcome bookingId={b.id} who={who} /> : null}
        </div>
      </ListItem>
    );
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Citas" title="Agenda" description="Citas de tus embudos y el horario en el que puedes atender. Hora de Ecuador." />

      <div className="grid gap-8">
        {past.length ? (
          <ListGroup title="¿Asistieron?" titleId="past" footer="Citas pasadas sin resultado. Marcarlas activa el seguimiento correcto.">
            {past.map((b) => row(b, true))}
          </ListGroup>
        ) : null}

        {upcoming.length ? (
          <ListGroup title="Próximas citas" titleId="upcoming">
            {upcoming.map((b) => row(b, false))}
          </ListGroup>
        ) : (
          <section aria-labelledby="upcoming">
            <h2 id="upcoming" className="sr-only">
              Próximas citas
            </h2>
            <EmptyState
              icon="calendar"
              title="Sin citas próximas"
              description={rules.length ? "Cuando alguien agende desde tu embudo, la cita aparece aquí." : "Primero define tus horarios de atención."}
              action={
                rules.length ? null : (
                  <Button href="#hours" variant="tinted" icon="clock">
                    Ir a horarios
                  </Button>
                )
              }
            />
          </section>
        )}

        <section aria-labelledby="hours">
          <h2 id="hours" className="mb-1 px-1 text-[1.25rem] leading-tight font-bold tracking-[-0.02em] text-ink">
            Horario semanal de atención
          </h2>
          <p className="mb-3 px-1 text-[0.8125rem] leading-snug text-ink-muted">Hora de Ecuador. Tus embudos solo ofrecen citas dentro de estas franjas.</p>
          {profile ? (
            <WeeklyHours initial={rules} />
          ) : (
            <ListGroup>
              <ListRow leading={<IconTile name="person" tone="gray" />} title="Sin perfil de agente" subtitle="Tu usuario no tiene perfil de agente asociado." />
            </ListGroup>
          )}
        </section>
      </div>
    </div>
  );
}
