import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { seedTenant, useTestDb } from "../../../test/db";
import type { Db } from "@/server/db/create";
import { conversations, deals, jobs, messages, properties } from "@/server/db/schema";
import { CONSENT_TEXT } from "@/modules/crm/service";
import { MAX_USER_TURNS, webChatTurn, type AssistantClient, type AssistantMessage, type CreateParams } from "./service";
import { buildSystemPrompt } from "./prompt";

type Step = { text?: string; tool?: { name: string; input: Record<string, unknown> } };

/** Scripted Claude: each call returns the next step; every request is recorded for assertions. */
function scripted(steps: Step[]) {
  const requests: CreateParams[] = [];
  let i = 0;
  const client: AssistantClient = {
    async create(params) {
      requests.push(structuredClone(params));
      const s = steps[i++] ?? { text: "Listo." };
      const content = s.tool
        ? [{ type: "tool_use", id: `tu_${i}`, name: s.tool.name, input: s.tool.input }]
        : [{ type: "text", text: s.text ?? "", citations: null }];
      return { id: `msg_${i}`, type: "message", role: "assistant", model: params.model, content, stop_reason: s.tool ? "tool_use" : "end_turn", stop_sequence: null, usage: {} } as unknown as AssistantMessage;
    },
  };
  return { client, requests };
}

const toolResults = (req: CreateParams) =>
  req.messages
    .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
    .filter((b) => b.type === "tool_result")
    .map((b) => (b as { content: string; is_error?: boolean }));

describe("assistant", () => {
  let db: Db;
  let A: Awaited<ReturnType<typeof seedTenant>>;
  let B: Awaited<ReturnType<typeof seedTenant>>;
  let ip = 0;
  const turn = (tenantId: string, client: AssistantClient | null, message: string, token?: string | null) =>
    webChatTurn({ tenantId, message, token, ipHash: `ip-${++ip}` }, { client, model: "claude-sonnet-5-5", baseUrl: "https://a.test" });

  beforeAll(async () => {
    db = await useTestDb();
    A = await seedTenant(db, "a");
    B = await seedTenant(db, "b");
    const pub = { status: "published" as const, operation: "sale" as const, propertyType: "house" as const, city: "Quito", publishedAt: new Date() };
    await db.insert(properties).values([
      { ...pub, tenantId: A.tenant.id, slug: "casa-cumbaya", title: "Casa en Cumbayá", price: 250000 },
      { ...pub, tenantId: A.tenant.id, slug: "casa-borrador", title: "Casa borrador", status: "draft" },
      { ...pub, tenantId: B.tenant.id, slug: "casa-ajena", title: "Casa de otro tenant", price: 99000 },
    ]);
  });

  it("is honestly unavailable without an API key", async () => {
    expect(await turn(A.tenant.id, null, "Hola")).toEqual({ status: "unavailable" });
  });

  it("system prompt carries the restrictions", () => {
    const p = buildSystemPrompt({ siteName: "Sitio", agentName: null, channel: "web" });
    expect(p).toContain("Nunca inventes ni estimes precios, disponibilidad");
    expect(p).toContain('di "No lo sé" y ofrece derivar');
    expect(p).toContain("No des asesoría legal, tributaria, notarial, financiera ni de crédito definitiva");
    expect(p).toContain("Habla solo de propiedades publicadas de este sitio");
    expect(p).toContain(CONSENT_TEXT);
  });

  it("tools use the server tenant: a model-supplied tenant id is ignored and only published A listings come back", async () => {
    const { client, requests } = scripted([
      { tool: { name: "buscar_propiedades", input: { texto: "Casa", tenantId: B.tenant.id } } },
      { tool: { name: "ver_propiedad", input: { slug: "casa-ajena" } } },
      { text: "Tengo la Casa en Cumbayá: https://a.test/propiedades/casa-cumbaya" },
    ]);
    const out = await turn(A.tenant.id, client, "¿Qué casas tienes?");
    expect(out).toMatchObject({ status: "ok", reply: "Tengo la Casa en Cumbayá: https://a.test/propiedades/casa-cumbaya" });

    expect(requests[0]).toMatchObject({
      model: "claude-sonnet-5-5",
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
    });
    const system = (requests[0]!.system as { text: string }[])[0]!.text;
    expect(system).toContain("Nunca inventes");
    expect(requests[0]!.tools!.map((t) => (t as { name: string }).name)).toEqual([
      "buscar_propiedades",
      "ver_propiedad",
      "comparar_propiedades",
      "capturar_prospecto",
      "agendar_cita",
      "derivar_a_humano",
    ]);
    const [search] = toolResults(requests[1]!);
    const found = JSON.parse(search!.content);
    expect(found.resultados.map((r: { titulo: string }) => r.titulo)).toEqual(["Casa en Cumbayá"]);
    expect(found.resultados[0].precio).toContain("250");
    expect(search!.content).not.toContain("otro tenant");
    const [detail] = toolResults(requests[2]!).slice(-1);
    expect(detail!.content).toContain("no está publicada en este sitio");
  });

  it("lead capture requires the consent text to have been shown and accepted", async () => {
    const early = scripted([
      { tool: { name: "capturar_prospecto", input: { nombre: "Ana Pérez", email: "ana@correo.ec", consentimiento_confirmado: true } } },
      { text: CONSENT_TEXT + " ¿Aceptas?" },
    ]);
    const first = await turn(A.tenant.id, early.client, "Quiero que me llamen, soy Ana Pérez, ana@correo.ec");
    if (first.status !== "ok") throw new Error("expected ok");
    const [refused] = toolResults(early.requests[1]!);
    expect(refused!.is_error).toBe(true);
    expect(await db.select().from(deals).where(eq(deals.source, "chat"))).toHaveLength(0);

    const accepted = scripted([
      { tool: { name: "capturar_prospecto", input: { nombre: "Ana Pérez", email: "ana@correo.ec", slug_propiedad: "casa-cumbaya", consentimiento_confirmado: true } } },
      { text: "Listo, registré tus datos." },
    ]);
    const second = await turn(A.tenant.id, accepted.client, "Sí, acepto", first.conversationToken);
    expect(second.status).toBe("ok");
    const [ok] = toolResults(accepted.requests[1]!);
    expect(ok!.is_error).toBeUndefined();
    const [deal] = await db.select().from(deals).where(eq(deals.source, "chat"));
    expect(deal).toMatchObject({ tenantId: A.tenant.id, stage: "new" });
    const [conv] = await db.select().from(conversations).where(eq(conversations.contactId, deal!.contactId));
    expect(conv!.tenantId).toBe(A.tenant.id);
  });

  it("handoff marks the conversation once and queues one agent alert; scheduling returns the funnel link or says there is none", async () => {
    const s = scripted([
      { tool: { name: "agendar_cita", input: {} } },
      { tool: { name: "derivar_a_humano", input: { motivo: "Quiere negociar el precio" } } },
      { tool: { name: "derivar_a_humano", input: { motivo: "otra vez" } } },
      { text: "Le aviso al agente." },
    ]);
    const out = await turn(A.tenant.id, s.client, "Quiero hablar con una persona");
    if (out.status !== "ok") throw new Error("expected ok");
    const [schedule] = toolResults(s.requests[1]!);
    expect(JSON.parse(schedule!.content)).toMatchObject({ disponible: false });
    const alerts = await db.select().from(jobs).where(eq(jobs.type, "notify.agent.new_lead"));
    expect(alerts.filter((j) => (j.payload as { conversationId?: string }).conversationId)).toHaveLength(1);
  });

  it("forged conversation tokens start a new conversation, and turns are capped", async () => {
    const s = scripted([{ text: "Hola" }]);
    const first = await turn(A.tenant.id, s.client, "Hola");
    if (first.status !== "ok") throw new Error("expected ok");
    const other = await turn(B.tenant.id, scripted([{ text: "Hola" }]).client, "Hola", first.conversationToken);
    if (other.status !== "ok") throw new Error("expected ok");
    expect(other.conversationToken).not.toBe(first.conversationToken);

    const [conv] = await db.select().from(conversations).where(eq(conversations.tenantId, A.tenant.id)).orderBy(conversations.createdAt).limit(1);
    const id = conv!.id;
    const existing = await db.select().from(messages).where(eq(messages.conversationId, id));
    const missing = MAX_USER_TURNS - existing.filter((m) => m.role === "user").length;
    if (missing > 0) {
      await db.insert(messages).values(Array.from({ length: missing }, () => ({ tenantId: A.tenant.id, conversationId: id, direction: "in" as const, role: "user" as const, body: "x" })));
    }
    const { conversationToken } = await import("@/modules/conversations/service");
    const limited = await turn(A.tenant.id, scripted([]).client, "una más", conversationToken(A.tenant.id, id));
    expect(limited.status).toBe("limit");
  });
});
