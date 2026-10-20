import type { JobHandler } from "./runner";
import { defaultDeps, type IntegrationDeps } from "@/modules/integrations/config";
import { handleMessageSend, handleNotifyBooking, handleNotifyNewLead } from "@/modules/integrations/messages";
import { handleMetaCapi } from "@/modules/integrations/capi";
import { handleCalendarSync } from "@/modules/integrations/calendar";
import { handleWebhookJob, type ReplyFn } from "@/modules/integrations/meta-webhook";
import { defaultAssistantDeps, generateReply } from "@/modules/assistant/service";

export type HandlerOptions = { deps?: Partial<IntegrationDeps>; reply?: ReplyFn | null };

/** Assistant replies for inbound WhatsApp/Messenger/Instagram messages; null when AI is not configured. */
export function assistantReply(): ReplyFn | null {
  const deps = defaultAssistantDeps();
  return deps.client ? (tenantId, conversationId) => generateReply(tenantId, conversationId, deps) : null;
}

/**
 * Job type → handler. Credentials are read per run, so connecting a channel only needs the env var
 * plus `unblock()`. Unregistered types are parked as `blocked`, never reported as done.
 */
export function createJobHandlers(opts: HandlerOptions = {}): Record<string, JobHandler> {
  const deps = () => defaultDeps(opts.deps);
  const reply = () => (opts.reply !== undefined ? opts.reply : assistantReply());
  return {
    "message.send": (job, db) => handleMessageSend(job, db, deps()),
    "notify.agent.new_lead": (job, db) => handleNotifyNewLead(job, db, deps()),
    "notify.agent.booking": (job, db) => handleNotifyBooking(job, db, deps()),
    "meta.capi": (job, db) => handleMetaCapi(job, db, deps()),
    "calendar.sync": (job, db) => handleCalendarSync(job, db, deps()),
    "meta.webhook": (job, db) => handleWebhookJob(job, db, deps(), reply()),
  };
}

export const jobHandlers: Record<string, JobHandler> = createJobHandlers();
