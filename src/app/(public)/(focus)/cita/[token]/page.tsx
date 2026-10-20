import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CancelBooking } from "@/components/funnel/CancelBooking";
import { formatAppointment } from "@/components/funnel/slots";
import { MEETING_LABEL } from "@/components/funnel/types";
import { Button } from "@/components/ui/Button";
import { findBookingByToken } from "@/modules/funnels/service";
import { cancelBooking } from "../../../_lib/actions";
import { getSite } from "../../../_lib/site";

export const metadata: Metadata = {
  title: "Tu cita",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const STATUS_TEXT = {
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Realizada",
  no_show: "No asististe",
} as const;

export default async function BookingPage({ params }: PageProps<"/cita/[token]">) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) notFound();
  const site = await getSite();
  const booking = await findBookingByToken(site.tenantId, token);
  if (!booking) notFound();
  const upcoming = booking.status === "confirmed" && booking.endsAt > new Date();
  const minutes = Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pt-10 pb-20 sm:px-8 sm:pt-16">
      <p className="text-eyebrow text-clay">Tu cita con {site.name}</p>
      <h1 className="mt-3 font-display text-display-lg text-balance text-ink first-letter:uppercase">{formatAppointment(booking.startsAt, site.timezone)}</h1>

      <dl className="mt-8 divide-y divide-line rounded-md bg-sand px-5">
        {[
          ["Estado", STATUS_TEXT[booking.status]],
          ["Duración", `${minutes} minutos`],
          ["Modalidad", MEETING_LABEL[booking.meetingKind]],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-6 py-4">
            <dt className="text-[0.9375rem] text-ink-muted">{k}</dt>
            <dd className="text-[1.0625rem] font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      {upcoming ? (
        <div className="mt-8 flex flex-col gap-8">
          <a
            href={`/cita/${token}/ics`}
            download="cita.ics"
            className="inline-flex min-h-12 items-center justify-center self-start rounded-full bg-navy px-7 text-[1.0625rem] font-medium text-white transition-colors duration-300 ease-apple hover:bg-navy-hover"
          >
            Añadir a mi calendario
          </a>
          <CancelBooking token={token} action={cancelBooking} />
        </div>
      ) : (
        <div className="mt-8">
          <p role="status" className="text-base text-ink-muted">
            {booking.status === "cancelled" ? "Esta cita fue cancelada." : "Esta cita ya no está activa."}
          </p>
          {site.funnelHref ? (
            <Button href={site.funnelHref} className="mt-4">
              Agendar otra cita
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
