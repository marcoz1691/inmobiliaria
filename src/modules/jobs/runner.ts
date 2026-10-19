import type { Db } from "@/server/db/create";
import { errorInfo, log } from "@/lib/logger";
import { block, claimDue, complete, fail, type JobRow } from "./queue";

/** `blocked` = cannot run until something is configured (e.g. channel credentials). Not a failure. */
export type HandlerResult = { status: "done" } | { status: "blocked"; reason: string };
export type JobHandler = (job: JobRow, db: Db) => Promise<HandlerResult>;

export async function runDueJobs(db: Db, handlers: Record<string, JobHandler>, limit = 25) {
  const claimed = await claimDue(db, limit);
  const summary = { claimed: claimed.length, done: 0, blocked: 0, failed: 0 };
  for (const job of claimed) {
    const handler = handlers[job.type];
    try {
      if (!handler) {
        await block(db, job.id, `Sin manejador para "${job.type}"`);
        summary.blocked++;
        continue;
      }
      const result = await handler(job, db);
      if (result.status === "done") {
        await complete(db, job.id);
        summary.done++;
      } else {
        await block(db, job.id, result.reason);
        summary.blocked++;
      }
    } catch (err) {
      await fail(db, job, errorInfo(err).error);
      summary.failed++;
      log.warn("job failed", { jobId: job.id, type: job.type, attempt: job.attempts, ...errorInfo(err) });
    }
  }
  return summary;
}
