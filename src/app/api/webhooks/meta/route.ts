import { after } from "next/server";
import { env } from "@/env";
import { safeEqual } from "@/lib/crypto";
import { errorInfo, log } from "@/lib/logger";
import { getDb } from "@/server/db/client";
import { defaultDeps } from "@/modules/integrations/config";
import { verifyMetaSignature } from "@/modules/integrations/meta";
import { extractEvents, processWebhookEvent, recordEvents } from "@/modules/integrations/meta-webhook";
import { assistantReply } from "@/modules/jobs/handlers";

export const maxDuration = 60;

const MAX_BODY_BYTES = 1_000_000;

/** Subscription check from Meta: echoes `hub.challenge` only when the verify token matches. */
export async function GET(req: Request) {
  if (!env.META_APP_SECRET || !env.META_VERIFY_TOKEN) return new Response("Webhook de Meta no configurado", { status: 503 });
  const q = new URL(req.url).searchParams;
  const token = q.get("hub.verify_token") ?? "";
  if (q.get("hub.mode") !== "subscribe" || !safeEqual(token, env.META_VERIFY_TOKEN)) return new Response("Forbidden", { status: 403 });
  return new Response(q.get("hub.challenge") ?? "", { status: 200, headers: { "content-type": "text/plain" } });
}

/**
 * WhatsApp, Messenger, Instagram and Lead Ads notifications. The signature is checked on the raw
 * body; events are stored once (idempotent) and processed after the 200 so Meta never times out.
 */
export async function POST(req: Request) {
  const secret = env.META_APP_SECRET;
  if (!secret) return new Response("Webhook de Meta no configurado", { status: 503 });
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });
  const raw = Buffer.from(await req.arrayBuffer());
  if (raw.byteLength > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), secret)) return new Response("Invalid signature", { status: 401 });

  let body: unknown;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const db = await getDb();
  const deps = defaultDeps();
  const ids = await recordEvents(db, extractEvents(body), deps);
  if (ids.length) {
    after(async () => {
      const reply = assistantReply();
      for (const id of ids) {
        // Failures stay recorded on the row; the backstop `meta.webhook` job retries them.
        await processWebhookEvent(db, id, deps, reply).catch((err) => log.warn("webhook processing failed", { id, ...errorInfo(err) }));
      }
    });
  }
  return Response.json({ received: true });
}
