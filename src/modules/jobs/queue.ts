import { and, eq, inArray, lte, sql } from "drizzle-orm";
import type { Tx } from "@/server/db/tenant-tx";
import type { Db } from "@/server/db/create";
import { jobs } from "@/server/db/schema";

export type JobInput = {
  tenantId: string;
  type: string;
  payload?: Record<string, unknown>;
  runAt?: Date;
  /** Same key → same job. Re-enqueuing is a no-op, which makes producers idempotent. */
  idempotencyKey: string;
  maxAttempts?: number;
};

export async function enqueue(tx: Tx, job: JobInput): Promise<void> {
  await tx
    .insert(jobs)
    .values({
      tenantId: job.tenantId,
      type: job.type,
      payload: job.payload ?? {},
      runAt: job.runAt ?? new Date(),
      idempotencyKey: job.idempotencyKey,
      maxAttempts: job.maxAttempts ?? 5,
    })
    .onConflictDoNothing();
}

/** Cancels pending jobs whose idempotency key starts with `prefix` (e.g. reminders of a cancelled booking). */
export async function cancelPending(tx: Tx, tenantId: string, prefix: string): Promise<void> {
  await tx
    .update(jobs)
    .set({ status: "cancelled" })
    .where(and(eq(jobs.tenantId, tenantId), inArray(jobs.status, ["pending", "blocked"]), sql`${jobs.idempotencyKey} like ${prefix + "%"}`));
}

export type JobRow = typeof jobs.$inferSelect;

/**
 * Claims due jobs across tenants with SKIP LOCKED so concurrent cron runs never take the same job.
 * Runs as the owner role: the runner is a trusted system process (src/modules/jobs/runner.ts).
 */
export async function claimDue(db: Db, limit = 25): Promise<JobRow[]> {
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.status, "pending"), lte(jobs.runAt, new Date())))
      .orderBy(jobs.runAt)
      .limit(limit)
      .for("update", { skipLocked: true });
    if (!due.length) return [];
    return tx
      .update(jobs)
      .set({ status: "running", lockedAt: new Date(), attempts: sql`${jobs.attempts} + 1` })
      .where(inArray(jobs.id, due.map((d) => d.id)))
      .returning();
  });
}

export async function complete(db: Db, id: string): Promise<void> {
  await db.update(jobs).set({ status: "done", completedAt: new Date(), lastError: null }).where(eq(jobs.id, id));
}

/** Channel not connected: park the job visibly instead of pretending it was sent. */
export async function block(db: Db, id: string, reason: string): Promise<void> {
  await db.update(jobs).set({ status: "blocked", lastError: reason, lockedAt: null }).where(eq(jobs.id, id));
}

export async function fail(db: Db, job: JobRow, error: string): Promise<void> {
  const exhausted = job.attempts >= job.maxAttempts;
  const backoffMinutes = Math.min(2 ** job.attempts, 120);
  await db
    .update(jobs)
    .set({
      status: exhausted ? "failed" : "pending",
      lastError: error.slice(0, 1000),
      lockedAt: null,
      runAt: exhausted ? job.runAt : new Date(Date.now() + backoffMinutes * 60_000),
    })
    .where(eq(jobs.id, job.id));
}

/** Re-queues blocked jobs of a type once its channel gets connected. */
export async function unblock(db: Db, types: string[]): Promise<void> {
  await db.update(jobs).set({ status: "pending", lastError: null }).where(and(eq(jobs.status, "blocked"), inArray(jobs.type, types)));
}
