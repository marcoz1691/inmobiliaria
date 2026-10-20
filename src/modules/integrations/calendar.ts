import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/server/db/create";
import { withTenant } from "@/server/db/tenant-tx";
import { bookings, calendarConnections } from "@/server/db/schema";
import { logActivity } from "@/modules/crm/service";
import type { HandlerResult } from "@/modules/jobs/runner";
import type { JobRow } from "@/modules/jobs/queue";
import { channelReady, type IntegrationDeps } from "./config";
import { loadRecords, loadTenant, tenantBaseUrl } from "./context";
import { accessToken, createEvent, deleteEvent } from "./google";

const calendarPayload = z.object({ bookingId: z.uuid(), action: z.enum(["create", "cancel"]) });

/**
 * Mirrors bookings into the agent's Google Calendar. Our own agenda is the source of truth: when the
 * agent has not connected Google (or the app has no Google credentials) the job ends `done` with a
 * timeline note instead of failing.
 */
export async function handleCalendarSync(job: JobRow, db: Db, deps: IntegrationDeps): Promise<HandlerResult> {
  const p = calendarPayload.parse(job.payload);
  const tenantId = job.tenantId;
  const base = await tenantBaseUrl(db, tenantId, deps.config);

  const data = await withTenant(db, tenantId, async (tx) => {
    const { booking, property } = await loadRecords(tx, tenantId, { bookingId: p.bookingId });
    if (!booking) return null;
    const [conn] = await tx
      .select()
      .from(calendarConnections)
      .where(and(eq(calendarConnections.tenantId, tenantId), eq(calendarConnections.agentId, booking.agentId), eq(calendarConnections.provider, "google")))
      .limit(1);
    if ((!conn || !channelReady.google(deps.config)) && p.action === "create") {
      await logActivity(tx, {
        tenantId,
        contactId: booking.contactId,
        dealId: booking.dealId,
        type: "calendar_not_synced",
        body: "Google Calendar no está conectado; la cita queda solo en la agenda del panel.",
        data: { bookingId: booking.id },
      });
    }
    if (!conn || !channelReady.google(deps.config)) return null;
    const { contact } = await loadRecords(tx, tenantId, { contactId: booking.contactId });
    const tenant = await loadTenant(tx, tenantId);
    return { booking, property, contact, conn, tenant };
  });
  if (!data) return { status: "done" };
  const { booking, conn } = data;

  const persist = (patch: { accessTokenEnc: string; expiresAt: Date }) =>
    withTenant(db, tenantId, async (tx) => {
      await tx.update(calendarConnections).set(patch).where(and(eq(calendarConnections.tenantId, tenantId), eq(calendarConnections.id, conn.id)));
    });

  if (p.action === "cancel") {
    if (!booking.googleEventId) return { status: "done" };
    await deleteEvent(deps, await accessToken(deps, conn, persist), conn.calendarId, booking.googleEventId);
    await withTenant(db, tenantId, (tx) => tx.update(bookings).set({ googleEventId: null }).where(and(eq(bookings.tenantId, tenantId), eq(bookings.id, booking.id))));
    return { status: "done" };
  }

  if (booking.status !== "confirmed" || booking.googleEventId) return { status: "done" };
  const who = data.contact?.name || "prospecto";
  const description = [
    "Cita agendada desde el sitio.",
    data.contact?.name && `Contacto: ${data.contact.name}`,
    data.contact?.phone && `Teléfono: ${data.contact.phone}`,
    data.contact?.email && `Correo: ${data.contact.email}`,
    data.property?.title && `Propiedad: ${data.property.title}`,
    booking.dealId && `Panel: ${base}/panel/prospectos/${booking.dealId}`,
  ]
    .filter(Boolean)
    .join("\n");
  const created = await createEvent(deps, await accessToken(deps, conn, persist), conn.calendarId, {
    summary: `Cita: ${who}`,
    description,
    start: booking.startsAt,
    end: booking.endsAt,
    timezone: data.tenant.timezone,
    requestId: booking.id,
    withMeet: booking.meetingKind === "video" && !booking.meetingUrl,
  });
  await withTenant(db, tenantId, (tx) =>
    tx
      .update(bookings)
      .set({ googleEventId: created.id, ...(created.hangoutLink && !booking.meetingUrl ? { meetingUrl: created.hangoutLink } : {}) })
      .where(and(eq(bookings.tenantId, tenantId), eq(bookings.id, booking.id))),
  );
  return { status: "done" };
}
