import { isIP } from "node:net";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import type { Db } from "@/server/db/create";
import type { Tx } from "@/server/db/tenant-tx";
import { funnelSubmissions, jobs } from "@/server/db/schema";

/**
 * Visitor IP and user agent kept on `funnel_submissions` only so the Conversions API can match
 * the event. They are personal data, so they live as short as possible:
 *  - captured only while CAPI is connected (the caller decides);
 *  - cleared as soon as a CAPI event for the submission is sent;
 *  - otherwise purged after 7 days by the job runner.
 */
export const CLIENT_DATA_TTL_MS = 7 * 86_400_000;

export type ClientNetwork = { ip: string | null; userAgent: string | null };

type HeaderReader = { get(name: string): string | null };

const LOOPBACK = /^(127\.|::1$|::ffff:127\.)/;

/**
 * Reads the client address from the request headers. On Vercel `x-forwarded-for` / `x-real-ip`
 * are overwritten by the platform with the real client IP (client-sent values are discarded);
 * `x-vercel-forwarded-for` keeps it when another proxy sits in front. Elsewhere these headers are
 * only trustworthy behind a proxy that overwrites them. Invalid or loopback values are dropped.
 */
export function clientNetworkFromHeaders(h: HeaderReader): ClientNetwork | null {
  const raw = h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for");
  const candidate = raw?.split(",")[0]?.trim() ?? "";
  const ip = candidate.length <= 45 && isIP(candidate) && !LOOPBACK.test(candidate) ? candidate : null;
  const ua = h.get("user-agent")?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 512) || null;
  return ip || ua ? { ip, userAgent: ua } : null;
}

/** Column values for an insert/update; `now()` matches the creation time of jobs enqueued in the same transaction. */
export function clientNetworkColumns(client: ClientNetwork | null | undefined) {
  if (!client) return {};
  return { clientIp: client.ip, clientUa: client.userAgent, clientCapturedAt: sql`now()` };
}

/**
 * After a CAPI event was sent: clears the data unless it was captured again later (e.g. at booking,
 * for the pending "Schedule" event). Compared in SQL to keep microsecond precision.
 */
export async function clearClientNetwork(tx: Tx, tenantId: string, submissionId: string, jobId: string): Promise<void> {
  await tx
    .update(funnelSubmissions)
    .set({ clientIp: null, clientUa: null, clientCapturedAt: null })
    .where(
      and(
        eq(funnelSubmissions.tenantId, tenantId),
        eq(funnelSubmissions.id, submissionId),
        sql`${funnelSubmissions.clientCapturedAt} <= (select ${jobs.createdAt} from ${jobs} where ${jobs.id} = ${jobId})`,
      ),
    );
}

/** Retention sweep across tenants (system role, run by the job runner). Returns rows cleared. */
export async function purgeExpiredClientNetwork(db: Db, now = new Date()): Promise<number> {
  const cleared = await db
    .update(funnelSubmissions)
    .set({ clientIp: null, clientUa: null, clientCapturedAt: null })
    .where(and(isNotNull(funnelSubmissions.clientCapturedAt), lt(funnelSubmissions.clientCapturedAt, new Date(now.getTime() - CLIENT_DATA_TTL_MS))))
    .returning({ id: funnelSubmissions.id });
  return cleared.length;
}
