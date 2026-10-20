import type { IntegrationDeps } from "./config";
import { requestJson } from "./http";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  /** RFC 8058 one-click unsubscribe URL (adds List-Unsubscribe headers). */
  unsubscribeUrl?: string | null;
  /** Resend de-duplicates retries carrying the same key for 24 h. */
  idempotencyKey?: string;
};

/** Resend REST API (https://resend.com/docs/api-reference/emails/send-email). */
export async function sendEmail(deps: IntegrationDeps, msg: OutgoingEmail): Promise<{ id: string | null }> {
  const { resendApiKey, emailFrom } = deps.config;
  if (!resendApiKey || !emailFrom) throw new Error("Email no conectado");
  const headers: Record<string, string> = { authorization: `Bearer ${resendApiKey}` };
  if (msg.idempotencyKey) headers["idempotency-key"] = msg.idempotencyKey.slice(0, 256);
  const res = await requestJson<{ id?: string }>(deps.fetch, "Resend", "https://api.resend.com/emails", {
    headers,
    body: {
      from: emailFrom,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      ...(msg.unsubscribeUrl
        ? { headers: { "List-Unsubscribe": `<${msg.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }
        : {}),
    },
  });
  return { id: res?.id ?? null };
}
