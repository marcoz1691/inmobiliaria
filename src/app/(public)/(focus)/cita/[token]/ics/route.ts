import { MEETING_LABEL } from "@/components/funnel/types";
import { findBookingByToken } from "@/modules/funnels/service";
import { buildIcs } from "../../../../_lib/ics";
import { getSite, siteOrigin } from "../../../../_lib/site";

/** Calendar file for the visitor's appointment, generated on the server from the signed link. */
export async function GET(_req: Request, { params }: RouteContext<"/cita/[token]/ics">) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return new Response("Not found", { status: 404 });
  const site = await getSite();
  const booking = await findBookingByToken(site.tenantId, token);
  if (!booking || booking.status !== "confirmed") return new Response("Not found", { status: 404 });
  const origin = await siteOrigin();
  const ics = buildIcs({
    uid: `${booking.id}@${new URL(origin).hostname}`,
    start: booking.startsAt,
    end: booking.endsAt,
    summary: `Cita con ${site.name}`,
    description: `${MEETING_LABEL[booking.meetingKind]}. Para cambiarla o cancelarla: ${origin}/cita/${token}`,
    url: `${origin}/cita/${token}`,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cita.ics"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
