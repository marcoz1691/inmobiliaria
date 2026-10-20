import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/server/db/create";
import { withTenant } from "@/server/db/tenant-tx";
import { adEvents, contacts, funnelSubmissions, funnels } from "@/server/db/schema";
import type { HandlerResult } from "@/modules/jobs/runner";
import type { JobRow } from "@/modules/jobs/queue";
import { blockedReason, channelReady, type IntegrationDeps } from "./config";
import { funnelUrl, tenantBaseUrl } from "./context";
import { ExternalError } from "./http";
import { buildCapiEvent, sendCapiEvent } from "./meta";

const capiPayload = z.object({
  eventName: z.string().min(1).max(60),
  eventId: z.string().min(1).max(120),
  submissionId: z.uuid().nullish(),
  contactId: z.uuid().nullish(),
});

/**
 * Conversions API. One row per (tenant, event_name, event_id) in `ad_events`: a retried job never
 * sends the same event twice, and `event_id` matches the browser Pixel so Meta deduplicates too.
 */
export async function handleMetaCapi(job: JobRow, db: Db, deps: IntegrationDeps): Promise<HandlerResult> {
  if (!channelReady.capi(deps.config)) return { status: "blocked", reason: blockedReason.capi(deps.config) };
  const p = capiPayload.parse(job.payload);
  const tenantId = job.tenantId;
  const base = await tenantBaseUrl(db, tenantId, deps.config);

  const prepared = await withTenant(db, tenantId, async (tx) => {
    const [sub] = p.submissionId
      ? await tx
          .select({ fbc: funnelSubmissions.fbc, fbp: funnelSubmissions.fbp, contactId: funnelSubmissions.contactId, funnelSlug: funnels.slug, funnelName: funnels.name })
          .from(funnelSubmissions)
          .innerJoin(funnels, eq(funnels.id, funnelSubmissions.funnelId))
          .where(and(eq(funnelSubmissions.tenantId, tenantId), eq(funnelSubmissions.id, p.submissionId)))
          .limit(1)
      : [];
    const contactId = p.contactId ?? sub?.contactId ?? null;
    const [contact] = contactId
      ? await tx.select({ id: contacts.id, email: contacts.email, phone: contacts.phone }).from(contacts).where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)))
      : [];
    const event = buildCapiEvent({
      eventName: p.eventName,
      eventId: p.eventId,
      // The job is enqueued in the same transaction as the business event, so its creation time is the event time.
      eventTime: job.createdAt,
      email: contact?.email,
      phone: contact?.phone,
      externalId: contact?.id,
      fbc: sub?.fbc,
      fbp: sub?.fbp,
      eventSourceUrl: funnelUrl(base, sub?.funnelSlug),
      customData: sub?.funnelName ? { content_name: sub.funnelName } : {},
    });
    await tx
      .insert(adEvents)
      .values({ tenantId, eventName: p.eventName, eventId: p.eventId, contactId: contact?.id ?? null, payload: event, status: "pending" })
      .onConflictDoNothing();
    const [row] = await tx
      .select({ id: adEvents.id, status: adEvents.status })
      .from(adEvents)
      .where(and(eq(adEvents.tenantId, tenantId), eq(adEvents.eventName, p.eventName), eq(adEvents.eventId, p.eventId)));
    return { event, row: row! };
  });

  if (prepared.row.status === "sent") return { status: "done" };
  const mark = (status: string, response: unknown) =>
    withTenant(db, tenantId, (tx) => tx.update(adEvents).set({ status, response }).where(and(eq(adEvents.tenantId, tenantId), eq(adEvents.id, prepared.row.id))));
  try {
    const response = await sendCapiEvent(deps, prepared.event);
    await mark("sent", response ?? null);
  } catch (err) {
    await mark("error", { error: err instanceof ExternalError ? err.message : "error de red" });
    throw err;
  }
  return { status: "done" };
}
