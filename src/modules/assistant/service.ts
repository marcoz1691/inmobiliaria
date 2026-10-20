import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/env";
import { getDb } from "@/server/db/client";
import { withTenant } from "@/server/db/tenant-tx";
import { rateLimit } from "@/server/rate-limit";
import { errorInfo, log } from "@/lib/logger";
import {
  appendMessage,
  conversationToken,
  countUserMessages,
  createConversation,
  getConversation,
  readConversationToken,
  recentMessages,
  type Channel,
  type MessageRow,
} from "@/modules/conversations/service";
import { loadAgent, loadTenant, tenantBaseUrl } from "@/modules/integrations/context";
import { configFromEnv } from "@/modules/integrations/config";
import { buildSystemPrompt } from "./prompt";
import { TOOL_DEFINITIONS, executeTool } from "./tools";

export type CreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
export type AssistantMessage = Anthropic.Beta.Messages.BetaMessage;

/** The only thing the assistant needs from the SDK; tests inject a mock. */
export type AssistantClient = { create(params: CreateParams): Promise<AssistantMessage> };

export type AssistantDeps = { client: AssistantClient | null; model: string; baseUrl?: string };

export function anthropicClient(apiKey: string): AssistantClient {
  const client = new Anthropic({ apiKey, timeout: 45_000, maxRetries: 2 });
  return { create: (params) => client.beta.messages.create(params) };
}

/** No API key → `client: null` → the chat reports `unavailable` instead of pretending. */
export function defaultAssistantDeps(): AssistantDeps {
  return { client: env.ANTHROPIC_API_KEY ? anthropicClient(env.ANTHROPIC_API_KEY) : null, model: env.CLAUDE_MODEL };
}

export const MAX_USER_TURNS = 20;
const MAX_TOOL_ROUNDS = 6;
const MAX_INPUT_CHARS = 1000;

export const LIMIT_REPLY =
  "Llegamos al límite de mensajes de esta conversación automática. Para seguir, escríbele directamente al agente o deja tus datos en el formulario de contacto.";
const REFUSAL_REPLY = "No puedo ayudarte con eso. Si quieres, te pongo en contacto con el agente.";
const FAILURE_REPLY = "Disculpa, no pude completar tu consulta. ¿Quieres que te ponga en contacto con el agente?";

/** Server-side refusal fallback ("default" routing) is available for these models on the Claude API. */
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-fable-5"]);

function requestParams(model: string, system: string, messages: Anthropic.Beta.Messages.BetaMessageParam[]): CreateParams {
  return {
    model,
    max_tokens: 4096,
    // Tools + system are identical for every turn of a tenant, so they are cached together.
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    tools: TOOL_DEFINITIONS,
    messages,
    // Short conversational turns: low effort keeps latency and cost down.
    ...(/^claude-(opus|sonnet|fable|haiku)-5/.test(model) ? { output_config: { effort: "low" as const } } : {}),
    ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  };
}

/** Stored history → API messages: alternating roles, starting with the visitor, text only. */
export function toApiMessages(history: MessageRow[]): Anthropic.Beta.Messages.BetaMessageParam[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of history) {
    if (m.role === "system") continue;
    const role = m.role === "user" ? "user" : "assistant";
    const text = m.role === "agent" ? `[Mensaje del agente humano] ${m.body}` : m.body;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += `\n\n${text}`;
    else out.push({ role, content: text });
  }
  while (out[0]?.role === "assistant") out.shift();
  return out;
}

const textOf = (m: AssistantMessage) =>
  m.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

/**
 * Runs the tool-use loop over the stored conversation and returns the reply text (not stored).
 * Never holds a database transaction while waiting on the model.
 */
export async function generateReply(tenantId: string, conversationId: string, deps: AssistantDeps): Promise<string | null> {
  if (!deps.client) return null;
  const db = await getDb();
  const { history, tenant, agent, channel } = await withTenant(db, tenantId, async (tx) => {
    const conv = await getConversation(tx, tenantId, conversationId);
    return {
      history: await recentMessages(tx, tenantId, conversationId, 40),
      tenant: await loadTenant(tx, tenantId),
      agent: await loadAgent(tx, tenantId),
      channel: (conv?.channel ?? "web") as Channel,
    };
  });
  const messages = toApiMessages(history);
  // The model must answer a visitor turn (no assistant prefill on current models).
  if (messages[messages.length - 1]?.role !== "user") return null;
  const baseUrl = deps.baseUrl ?? (await tenantBaseUrl(db, tenantId, configFromEnv()));
  const system = buildSystemPrompt({ siteName: tenant.name, agentName: agent?.displayName ?? null, channel });
  const ctx = { tenantId, conversationId, baseUrl };

  let lastText = "";
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await deps.client.create(requestParams(deps.model, system, messages));
    if (res.stop_reason === "refusal") return REFUSAL_REPLY;
    lastText = textOf(res) || lastText;
    if (res.stop_reason !== "tool_use") return lastText || FAILURE_REPLY;
    messages.push({ role: "assistant", content: res.content });
    const calls = res.content.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use");
    const results = await Promise.all(
      calls.map(async (call): Promise<Anthropic.Beta.Messages.BetaToolResultBlockParam> => {
        const out = await executeTool(call.name, call.input, ctx).catch((e: unknown) => {
          log.error("assistant tool failed", { tool: call.name, tenantId, ...errorInfo(e) });
          return { content: "La herramienta falló. Ofrece derivar al agente.", isError: true };
        });
        return { type: "tool_result", tool_use_id: call.id, content: out.content, ...(out.isError ? { is_error: true } : {}) };
      }),
    );
    messages.push({ role: "user", content: results });
  }
  return lastText || FAILURE_REPLY;
}

export type ChatResult =
  | { status: "ok"; reply: string; conversationToken: string }
  | { status: "limit"; reply: string; conversationToken: string }
  | { status: "unavailable" }
  | { status: "rate_limited" };

export type ChatInput = { tenantId: string; token?: string | null; message: string; ipHash: string };

/** One web-chat turn: rate limits, stores the visitor message, runs the assistant, stores the reply. */
export async function webChatTurn(input: ChatInput, deps: AssistantDeps): Promise<ChatResult> {
  if (!deps.client) return { status: "unavailable" };
  const text = input.message.trim().slice(0, MAX_INPUT_CHARS);
  const { tenantId } = input;
  const knownId = readConversationToken(input.token, tenantId);
  if (!(await rateLimit(`chat:ip:${input.ipHash}`, 30, 600))) return { status: "rate_limited" };
  if (knownId && !(await rateLimit(`chat:conv:${knownId}`, 8, 60))) return { status: "rate_limited" };

  const db = await getDb();
  const turn = await withTenant(db, tenantId, async (tx) => {
    let conv = knownId ? await getConversation(tx, tenantId, knownId) : null;
    if (!conv || conv.channel !== "web") conv = await createConversation(tx, { tenantId, channel: "web" });
    if ((await countUserMessages(tx, tenantId, conv.id)) >= MAX_USER_TURNS) return { id: conv.id, limited: true };
    await appendMessage(tx, { tenantId, conversationId: conv.id, direction: "in", role: "user", body: text });
    return { id: conv.id, limited: false };
  });
  const token = conversationToken(tenantId, turn.id);
  if (turn.limited) return { status: "limit", reply: LIMIT_REPLY, conversationToken: token };

  const reply = (await generateReply(tenantId, turn.id, deps)) ?? FAILURE_REPLY;
  await withTenant(db, tenantId, (tx) => appendMessage(tx, { tenantId, conversationId: turn.id, direction: "out", role: "assistant", body: reply }));
  return { status: "ok", reply, conversationToken: token };
}
