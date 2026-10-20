import { z } from "zod";
import { sha256 } from "@/lib/crypto";
import { errorInfo, log } from "@/lib/logger";
import { getCurrentTenant } from "@/server/tenant";
import { defaultAssistantDeps, webChatTurn } from "@/modules/assistant/service";

export const maxDuration = 60;

const bodySchema = z.object({
  message: z.string().trim().min(1, "Escribe un mensaje").max(1000, "El mensaje es muy largo"),
  token: z.string().max(500).nullish(),
  /** Honeypot: real visitors never fill it. */
  website: z.string().max(0).optional(),
});

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Whether the assistant is connected, so the widget can show the honest alternative up front. */
export async function GET() {
  return Response.json({ available: Boolean(defaultAssistantDeps().client) });
}

export async function POST(req: Request) {
  const deps = defaultAssistantDeps();
  if (!deps.client) return Response.json({ status: "unavailable" });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ status: "invalid", error: parsed.error.issues[0]?.message ?? "Mensaje no válido" }, { status: 400 });
  try {
    const tenant = await getCurrentTenant();
    const result = await webChatTurn({ tenantId: tenant.id, token: parsed.data.token, message: parsed.data.message, ipHash: sha256(clientIp(req)) }, deps);
    if (result.status === "rate_limited") {
      return Response.json({ status: "rate_limited", error: "Estás enviando muchos mensajes. Espera un momento e inténtalo de nuevo." }, { status: 429 });
    }
    return Response.json(result);
  } catch (err) {
    log.error("chat turn failed", errorInfo(err));
    return Response.json({ status: "error", error: "El asistente no pudo responder ahora. Inténtalo de nuevo o escríbele al agente." }, { status: 502 });
  }
}
