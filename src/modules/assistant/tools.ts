import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { withTenant } from "@/server/db/tenant-tx";
import { AppError } from "@/lib/errors";
import { CONSENT_TEXT, captureInquiry, inquirySchema } from "@/modules/crm/service";
import { getPublicProperty, listCatalog, type PublicListing } from "@/modules/properties/service";
import { OPERATION_LABEL, STATUS_LABEL, TYPE_LABEL, catalogFiltersSchema } from "@/modules/properties/domain";
import { linkContact, recentMessages, requestHandoff } from "@/modules/conversations/service";
import { enqueue } from "@/modules/jobs/queue";
import { activeFunnel, funnelUrl, loadAgent } from "@/modules/integrations/context";

/** Server-side context. `tenantId` never comes from the model or the browser. */
export type ToolContext = { tenantId: string; conversationId: string; baseUrl: string };

export const TOOL_DEFINITIONS: Anthropic.Beta.BetaTool[] = [
  {
    name: "buscar_propiedades",
    description:
      "Busca propiedades publicadas en este sitio. Devuelve hasta 6 resultados con título, precio tal como está publicado, ubicación aproximada, características y enlace. Úsala antes de mencionar cualquier propiedad.",
    input_schema: {
      type: "object",
      properties: {
        operacion: { type: "string", enum: ["venta", "alquiler"], description: "Venta o alquiler." },
        tipo: { type: "string", enum: ["casa", "departamento", "terreno", "oficina", "local", "bodega", "edificio", "otro"] },
        texto: { type: "string", description: "Ciudad, sector o palabra del título. Ej.: 'Cumbayá'." },
        precio_min: { type: "number" },
        precio_max: { type: "number" },
        dormitorios_min: { type: "integer" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "ver_propiedad",
    description: "Detalle público de una propiedad del sitio por su slug (lo devuelve buscar_propiedades).",
    input_schema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"], additionalProperties: false },
  },
  {
    name: "comparar_propiedades",
    description: "Compara de 2 a 4 propiedades del sitio por sus slugs con sus datos públicos lado a lado.",
    input_schema: {
      type: "object",
      properties: { slugs: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 } },
      required: ["slugs"],
      additionalProperties: false,
    },
  },
  {
    name: "capturar_prospecto",
    description:
      "Registra los datos de contacto para que el agente se comunique. Solo después de mostrar el texto de consentimiento literal y recibir un sí explícito. Requiere nombre y al menos email o teléfono.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        email: { type: "string" },
        telefono: { type: "string" },
        mensaje: { type: "string", description: "Resumen breve de lo que busca la persona." },
        slug_propiedad: { type: "string", description: "Propiedad de interés, si hay una." },
        consentimiento_confirmado: { type: "boolean" },
      },
      required: ["nombre", "consentimiento_confirmado"],
      additionalProperties: false,
    },
  },
  {
    name: "agendar_cita",
    description:
      "Devuelve el enlace para agendar una cita con el agente (formulario corto + calendario). No reserva dentro del chat.",
    input_schema: { type: "object", properties: { slug_propiedad: { type: "string" } }, additionalProperties: false },
  },
  {
    name: "derivar_a_humano",
    description: "Avisa al agente humano para que continúe la conversación.",
    input_schema: { type: "object", properties: { motivo: { type: "string" } }, required: ["motivo"], additionalProperties: false },
  },
];

const OP: Record<string, "sale" | "rent"> = { venta: "sale", alquiler: "rent" };
const TYPE: Record<string, string> = {
  casa: "house",
  departamento: "apartment",
  terreno: "land",
  oficina: "office",
  local: "commercial",
  bodega: "warehouse",
  edificio: "building",
  otro: "other",
};

const slug = z.string().trim().min(1).max(160);
const schemas = {
  buscar_propiedades: z.object({
    operacion: z.enum(["venta", "alquiler"]).optional(),
    tipo: z.string().max(20).optional(),
    texto: z.string().max(80).optional(),
    precio_min: z.number().min(0).optional(),
    precio_max: z.number().min(0).optional(),
    dormitorios_min: z.number().int().min(0).max(20).optional(),
  }),
  ver_propiedad: z.object({ slug }),
  comparar_propiedades: z.object({ slugs: z.array(slug).min(2).max(4) }),
  capturar_prospecto: z.object({
    nombre: z.string().max(120),
    email: z.string().max(160).optional(),
    telefono: z.string().max(30).optional(),
    mensaje: z.string().max(1000).optional(),
    slug_propiedad: slug.optional(),
    consentimiento_confirmado: z.boolean(),
  }),
  agendar_cita: z.object({ slug_propiedad: slug.optional() }),
  derivar_a_humano: z.object({ motivo: z.string().max(500) }),
};

export type ToolName = keyof typeof schemas;

function price(l: PublicListing): string {
  // Appraisals are never public prices.
  if (l.price === null || l.priceKind === "appraisal") return "a consultar";
  const amount = new Intl.NumberFormat("es-EC", { style: "currency", currency: l.currency || "USD", maximumFractionDigits: 0 }).format(l.price);
  return l.operation === "rent" ? `${amount} al mes` : amount;
}

function summary(l: PublicListing, base: string) {
  return {
    slug: l.slug,
    titulo: l.title,
    estado: STATUS_LABEL[l.status],
    operacion: l.operation ? OPERATION_LABEL[l.operation] : null,
    tipo: l.propertyType ? TYPE_LABEL[l.propertyType] : null,
    precio: price(l),
    ubicacion: [l.sector, l.city, l.province].filter(Boolean).join(", ") || null,
    dormitorios: l.bedrooms,
    banos: l.bathrooms,
    parqueaderos: l.parking,
    area_construida_m2: l.builtArea,
    area_terreno_m2: l.landArea,
    url: `${base}/propiedades/${encodeURIComponent(l.slug)}`,
  };
}

function detail(l: PublicListing, base: string) {
  return {
    ...summary(l, base),
    nota_precio: l.priceKind === "appraisal" ? null : l.priceNote,
    descripcion: l.description ? l.description.slice(0, 1500) : null,
    amenidades: l.amenities,
    destacados: l.highlights,
    direccion: l.address,
    fotos: l.images.length,
  };
}

async function findListing(tenantId: string, s: string): Promise<PublicListing | null> {
  const r = await getPublicProperty(tenantId, s);
  return r.kind === "ok" ? r.listing : null;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const CONSENT_NORM = norm(CONSENT_TEXT);
const NEGATIVE = /^\s*no\b|\bno (acepto|autorizo|estoy de acuerdo|doy|quiero)\b/i;
const AFFIRMATIVE = /\b(si|sí|acepto|autorizo|de acuerdo|ok|okay|claro|dale|confirmo|esta bien|está bien|por supuesto|bueno)\b/i;

/**
 * Consent is verified from the stored conversation, not from the model's word: the consent text must
 * have been shown by the assistant and a later visitor message must accept it.
 */
export async function consentGiven(tenantId: string, conversationId: string): Promise<boolean> {
  const history = await withTenant(await getDb(), tenantId, (tx) => recentMessages(tx, tenantId, conversationId, 40));
  const shownAt = history.findLastIndex((m) => m.role === "assistant" && norm(m.body).includes(CONSENT_NORM));
  if (shownAt < 0) return false;
  return history.slice(shownAt + 1).some((m) => m.role === "user" && AFFIRMATIVE.test(m.body) && !NEGATIVE.test(m.body));
}

type ToolOutput = { content: string; isError?: boolean };
const ok = (data: unknown): ToolOutput => ({ content: JSON.stringify(data) });
const err = (message: string): ToolOutput => ({ content: message, isError: true });

/** Executes one tool call. Input is untrusted model output: validated, and any extra field (e.g. a tenant id) is dropped. */
export async function executeTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolOutput> {
  if (!(name in schemas)) return err(`Herramienta desconocida: ${name}`);
  const parsed = schemas[name as ToolName].safeParse(rawInput ?? {});
  if (!parsed.success) return err("Parámetros no válidos para la herramienta.");
  const input = parsed.data as Record<string, unknown>;
  const { tenantId, baseUrl } = ctx;
  try {
    switch (name as ToolName) {
      case "buscar_propiedades": {
        const i = input as z.infer<typeof schemas.buscar_propiedades>;
        const filters = catalogFiltersSchema.parse({
          operation: i.operacion ? OP[i.operacion] : undefined,
          type: i.tipo ? TYPE[i.tipo.toLowerCase()] : undefined,
          q: i.texto,
          minPrice: i.precio_min,
          maxPrice: i.precio_max,
          bedrooms: i.dormitorios_min,
        });
        const { items, total } = await listCatalog(tenantId, filters);
        return ok({ total, resultados: items.slice(0, 6).map((l) => summary(l, baseUrl)) });
      }
      case "ver_propiedad": {
        const l = await findListing(tenantId, (input as { slug: string }).slug);
        return l ? ok(detail(l, baseUrl)) : ok({ error: "Esa propiedad no está publicada en este sitio." });
      }
      case "comparar_propiedades": {
        const slugs = (input as { slugs: string[] }).slugs;
        const found = await Promise.all(slugs.map((s) => findListing(tenantId, s)));
        return ok({
          propiedades: found.filter((l): l is PublicListing => Boolean(l)).map((l) => summary(l, baseUrl)),
          no_encontradas: slugs.filter((_, idx) => !found[idx]),
        });
      }
      case "capturar_prospecto": {
        const i = input as z.infer<typeof schemas.capturar_prospecto>;
        if (!i.consentimiento_confirmado || !(await consentGiven(tenantId, ctx.conversationId))) {
          return err("Aún no hay consentimiento: muestra el texto de consentimiento literal y espera que la persona acepte antes de registrar sus datos.");
        }
        const listing = i.slug_propiedad ? await findListing(tenantId, i.slug_propiedad) : null;
        const data = inquirySchema.safeParse({ name: i.nombre, email: i.email ?? "", phone: i.telefono ?? "", message: i.mensaje, consent: true, propertyId: listing?.id });
        if (!data.success) return err(data.error.issues[0]?.message ?? "Datos de contacto no válidos.");
        const { contactId, dealId } = await captureInquiry(tenantId, data.data, { source: "chat" });
        await withTenant(await getDb(), tenantId, (tx) => linkContact(tx, tenantId, ctx.conversationId, contactId, listing?.id));
        return ok({ registrado: true, prospecto: dealId, nota: "Datos registrados para que el agente se comunique." });
      }
      case "agendar_cita": {
        const s = (input as { slug_propiedad?: string }).slug_propiedad;
        const listing = s ? await findListing(tenantId, s) : null;
        const funnel = await withTenant(await getDb(), tenantId, (tx) => activeFunnel(tx, tenantId, { propertyId: listing?.id }));
        if (!funnel) return ok({ disponible: false, nota: "No hay agenda en línea activa. Ofrece derivar a un humano o registrar sus datos." });
        return ok({ disponible: true, enlace: funnelUrl(baseUrl, funnel.slug, { utm_source: "chat", utm_medium: "asistente" }) });
      }
      case "derivar_a_humano": {
        const motivo = (input as { motivo: string }).motivo;
        const agent = await withTenant(await getDb(), tenantId, async (tx) => {
          if (await requestHandoff(tx, tenantId, ctx.conversationId)) {
            await enqueue(tx, {
              tenantId,
              type: "notify.agent.new_lead",
              payload: { conversationId: ctx.conversationId, reason: motivo.slice(0, 300) },
              idempotencyKey: `conversation:${ctx.conversationId}:handoff`,
            });
          }
          return loadAgent(tx, tenantId);
        });
        const wa = agent?.whatsapp?.replace(/\D/g, "");
        return ok({
          derivado: true,
          nota: "La conversación quedó marcada para que el agente la continúe.",
          whatsapp_agente: wa ? `https://wa.me/${wa}` : null,
          contacto: `${baseUrl}/contacto`,
        });
      }
    }
  } catch (e) {
    if (e instanceof AppError) return err(e.message);
    throw e;
  }
}
