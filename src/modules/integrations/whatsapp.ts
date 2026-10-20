import type { IntegrationDeps } from "./config";
import { requestJson } from "./http";

/** E.164 without "+" as the Cloud API expects ("+593991234567" → "593991234567"). */
export function waNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

type SendResult = { messages?: { id: string }[] };

async function send(deps: IntegrationDeps, body: Record<string, unknown>): Promise<{ id: string | null }> {
  const { whatsappToken, whatsappPhoneNumberId, metaGraphVersion } = deps.config;
  if (!whatsappToken || !whatsappPhoneNumberId) throw new Error("WhatsApp no conectado");
  const res = await requestJson<SendResult>(
    deps.fetch,
    "WhatsApp",
    `https://graph.facebook.com/${metaGraphVersion}/${encodeURIComponent(whatsappPhoneNumberId)}/messages`,
    { headers: { authorization: `Bearer ${whatsappToken}` }, body: { messaging_product: "whatsapp", recipient_type: "individual", ...body } },
  );
  return { id: res?.messages?.[0]?.id ?? null };
}

/**
 * Business-initiated messages must use a template approved in Meta (WhatsApp Manager).
 * Suggested texts live in docs/integrations.md.
 */
export function sendWhatsAppTemplate(deps: IntegrationDeps, t: { to: string; name: string; language: string; params: string[] }) {
  return send(deps, {
    to: waNumber(t.to),
    type: "template",
    template: {
      name: t.name,
      language: { code: t.language },
      components: t.params.length ? [{ type: "body", parameters: t.params.map((text) => ({ type: "text", text: text.slice(0, 1000) })) }] : [],
    },
  });
}

/** Free-form text: only valid inside the 24 h customer-service window (replies to inbound messages). */
export function sendWhatsAppText(deps: IntegrationDeps, t: { to: string; body: string }) {
  return send(deps, { to: waNumber(t.to), type: "text", text: { body: t.body.slice(0, 4096), preview_url: true } });
}
