import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/server/session";
import { listUpcomingBookings } from "@/modules/funnels/service";
import { listDeals } from "@/modules/crm/service";
import { getAvailability, getMyProfile } from "@/modules/agents/admin";
import { PageHeader } from "@/components/admin/PageHeader";
import { WeeklyHours } from "@/components/admin/WeeklyHours";
import { BookingOutcome } from "@/components/admin/BookingOutcome";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Agenda" };

const fmt = new Intl.DateTimeFormat("es-EC", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" });
const KIND: Record<string, string> = { video: "Videollamada", phone: "Llamada", in_person: "Presencial" };

/** Request time; past bookings of the last two weeks still need an outcome. */
function timeWindow() {
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
      <li key={b.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-medium text-ink first-letter:uppercase">{fmt.format(b.startsAt)}</p>
          <p className="text-sm text-ink-muted">
            {b.dealId ? (
              <Link href={`/panel/prospectos/${b.dealId}`} className="text-navy underline underline-offset-4">
                {who}
              </Link>
            ) : (
              who
            )}{" "}
            · {KIND[b.meetingKind] ?? b.meetingKind}
          </p>
        </div>
        {withOutcome ? <BookingOutcome bookingId={b.id} who={who} /> : null}
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Citas" title="Agenda" />

      {past.length ? (
        <section aria-labelledby="past" className="mt-8">
          <h2 id="past" className="font-display text-2xl text-ink">
            ¿Asistieron?
          </h2>
          <p className="mt-1 text-sm text-ink-muted">Citas pasadas sin resultado. Marcarlas activa el seguimiento correcto.</p>
          <ul className="mt-3 divide-y divide-line border-y border-line">{past.map((b) => row(b, true))}</ul>
        </section>
      ) : null}

      <section aria-labelledby="upcoming" className="mt-8">
        <h2 id="upcoming" className="font-display text-2xl text-ink">
          Próximas citas
        </h2>
        {upcoming.length ? (
          <ul className="mt-3 divide-y divide-line border-y border-line">{upcoming.map((b) => row(b, false))}</ul>
        ) : (
          <EmptyState className="mt-4" title="Sin citas próximas" description={rules.length ? "Cuando alguien agende desde tu embudo, la cita aparece aquí." : "Primero define tus horarios de atención."} />
        )}
      </section>

      <section aria-labelledby="hours" className="mt-10">
        <h2 id="hours" className="font-display text-2xl text-ink">
          Horario semanal de atención
        </h2>
        <p className="mt-1 text-sm text-ink-muted">Hora de Ecuador. Tus embudos solo ofrecen citas dentro de estas franjas.</p>
        <div className="mt-4">{profile ? <WeeklyHours initial={rules} /> : <p className="text-base text-ink-muted">Tu usuario no tiene perfil de agente asociado.</p>}</div>
      </section>
    </div>
  );
}
