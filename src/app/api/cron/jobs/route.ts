import { env } from "@/env";
import { safeEqual } from "@/lib/crypto";
import { getDb } from "@/server/db/client";
import { jobHandlers } from "@/modules/jobs/handlers";
import { runDueJobs } from "@/modules/jobs/runner";

export const maxDuration = 60;

/** Vercel Cron (vercel.json) calls this with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.CRON_SECRET || !safeEqual(auth, `Bearer ${env.CRON_SECRET}`)) return new Response("Unauthorized", { status: 401 });
  const summary = await runDueJobs(await getDb(), jobHandlers);
  return Response.json(summary);
}
