import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { env } from "@/env";
import { CANTONS, findCanton, findProvince, PROVINCES } from "@/modules/geo/ecuador";
import { emptyListing, finalizeListing, setField } from "./listing";
import type { ExtractedListing, ListingField } from "./types";

/**
 * AI reading of a property PDF (any layout, scanned pages included): Claude reads the document
 * and returns every listing it describes as structured data. The result goes through the same
 * `finalizeListing` scrub as the rule-based parser and always lands as a draft that needs review.
 */

const OPERATION = z.enum(["sale", "rent"]).nullable();
const TYPE = z.enum(["house", "apartment", "land", "office", "commercial", "warehouse", "building", "other"]).nullable();

const AiListing = z.object({
  title: z.string().nullable().describe("Título corto para el portal: tipo, zona y lo que la distingue. Máximo 100 caracteres."),
  description: z
    .string()
    .nullable()
    .describe("Descripción para el público, en español de Ecuador, solo con datos del documento. Sin dirección exacta, linderos, códigos catastrales ni contactos."),
  operation: OPERATION.describe("sale = venta, rent = alquiler."),
  propertyType: TYPE,
  price: z.number().nullable().describe("En dólares, sin símbolos. Null si no aparece."),
  priceKind: z.enum(["sale", "rent", "appraisal"]).describe("appraisal si el valor es un avalúo o valor de tasación, no un precio de venta o alquiler."),
  priceNote: z.string().nullable().describe("Condiciones del precio que el documento indique (negociable, incluye alícuota…)."),
  landArea: z.number().nullable().describe("Área de terreno en m²."),
  builtArea: z.number().nullable().describe("Área de construcción en m²."),
  bedrooms: z.number().nullable(),
  bathrooms: z.number().nullable().describe("Medios baños cuentan 0.5."),
  parking: z.number().nullable(),
  address: z.string().nullable().describe("Dirección exacta, solo si aparece. Es privada: nunca la repitas en la descripción."),
  sector: z.string().nullable().describe("Barrio, urbanización o sector."),
  city: z.string().nullable().describe("Cantón de Ecuador donde está la propiedad, escrito como en la lista dada."),
  province: z.string().nullable().describe("Provincia de Ecuador, escrita como en la lista dada."),
  amenities: z.array(z.string()).describe("Comodidades concretas: piscina, guardianía, ascensor…"),
  highlights: z.array(z.string()).describe("Puntos fuertes del documento, frases cortas."),
  sourcePages: z.array(z.number()).describe("Páginas (desde 1) donde se describe esta propiedad, incluidas las de sus fotos."),
  uncertainFields: z.array(z.string()).describe("Nombres de los campos que dedujiste o leíste con dudas."),
  excludedBoundaries: z.boolean().describe("true si el documento traía linderos y los omitiste."),
  excludedCadastralCode: z.boolean().describe("true si traía código catastral o clave predial y lo omitiste."),
  excludedContacts: z.boolean().describe("true si traía nombres, teléfonos o correos de terceros (banco, administradores) y los omitiste."),
});

const AiResult = z.object({
  listings: z.array(AiListing),
  warnings: z.array(z.string()).describe("Avisos para el agente en español: datos contradictorios, páginas ilegibles, etc."),
});
type AiResultT = z.infer<typeof AiResult>;

const SYSTEM = `Eres el asistente de un portal inmobiliario de Ecuador. Lees documentos (fichas, catálogos de bancos, folletos) y llenas las fichas de las propiedades que describen, para que un agente inmobiliario las revise antes de publicarlas.

Reglas:
- Usa solo lo que dice el documento. Si un dato no aparece, déjalo en null o la lista vacía. No inventes precios, áreas, ubicaciones ni comodidades.
- Una entrada en "listings" por cada propiedad distinta. Un folleto de una sola propiedad da una sola entrada.
- Si el valor es un avalúo o tasación, priceKind = "appraisal".
- Nunca copies a ningún campo: linderos, códigos catastrales o claves prediales, ni nombres, teléfonos o correos de personas o empleados de bancos. Marca en excluded* si los había.
- La dirección exacta va solo en "address"; la descripción no la menciona.
- city debe ser el cantón y province la provincia, tal como aparecen en estas listas cuando correspondan.
Provincias: ${PROVINCES.map((p) => p.name).join(", ")}.
Cantones: ${CANTONS.map((c) => c.name).join(", ")}.`;

export type AiExtraction = { listings: ExtractedListing[]; warnings: string[] };

export const AI_REVIEW_NOTE = "Completado por IA a partir del PDF: revisa cada dato antes de publicar.";

/** Model used for PDF reading; switch with CLAUDE_IMPORT_MODEL (e.g. claude-sonnet-5-5 to halve the cost). */
export function importModel(): string {
  return env.CLAUDE_IMPORT_MODEL;
}

export function aiImportAvailable(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  // PDFs of 20+ pages can take a while to read; the import route allows up to 5 minutes.
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 240_000, maxRetries: 1 });
  return client;
}

/** Calls Claude with the PDF. Returns null when the model declines or the output does not parse. */
async function readPdf(data: Buffer): Promise<AiResultT | null> {
  const response = await getClient().beta.messages.parse({
    model: importModel(),
    // If the model declines a document, the API retries it on a fallback model in the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    max_tokens: 16000,
    output_config: { effort: "medium", format: betaZodOutputFormat(AiResult) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: data.toString("base64") } },
          { type: "text", text: "Llena las fichas de las propiedades de este documento." },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") return null;
  return response.parsed_output ?? null;
}

const LISTING_KEYS = new Set<string>(["title", "description", "operation", "propertyType", "price", "priceKind", "priceNote", "landArea", "builtArea", "bedrooms", "bathrooms", "parking", "address", "sector", "city", "province", "amenities", "highlights"]);

/** Model output → the importer's listing shape, with canonical places and the shared scrub. */
export function toExtractedListing(a: z.infer<typeof AiListing>): ExtractedListing {
  const l = emptyListing();
  const uncertain = new Set(a.uncertainFields.filter((f) => LISTING_KEYS.has(f)));
  const conf = (f: ListingField) => (uncertain.has(f) ? "low" : "high") as "low" | "high";
  const num = (v: number | null, max: number) => (v !== null && Number.isFinite(v) && v >= 0 && v <= max ? v : null);

  setField(l, "title", a.title?.trim().slice(0, 140) || null, conf("title"));
  setField(l, "description", a.description?.trim().slice(0, 6000) || null, conf("description"));
  setField(l, "operation", a.operation, conf("operation"));
  setField(l, "propertyType", a.propertyType, conf("propertyType"));
  setField(l, "price", num(a.price, 1_000_000_000), conf("price"));
  l.priceKind = a.priceKind;
  l.confidence.priceKind = conf("priceKind");
  setField(l, "priceNote", a.priceNote?.trim().slice(0, 200) || null, conf("priceNote"));
  setField(l, "landArea", num(a.landArea, 100_000_000), conf("landArea"));
  setField(l, "builtArea", num(a.builtArea, 1_000_000), conf("builtArea"));
  setField(l, "bedrooms", num(a.bedrooms, 100) === null ? null : Math.round(a.bedrooms!), conf("bedrooms"));
  setField(l, "bathrooms", num(a.bathrooms, 100), conf("bathrooms"));
  setField(l, "parking", num(a.parking, 1000) === null ? null : Math.round(a.parking!), conf("parking"));
  setField(l, "address", a.address?.trim().slice(0, 300) || null, conf("address"));
  setField(l, "sector", a.sector?.trim().slice(0, 120) || null, conf("sector"));
  // Places are normalized to the official names; anything else is kept as written and flagged.
  const canton = findCanton(a.city, a.province);
  const province = findProvince(a.province) ?? canton?.province ?? null;
  setField(l, "city", canton?.name ?? (a.city?.trim().slice(0, 120) || null), canton ? conf("city") : "low");
  setField(l, "province", province?.name ?? null, conf("province"));
  l.amenities = a.amenities.map((s) => s.trim()).filter(Boolean).slice(0, 60).map((s) => s.slice(0, 60));
  l.highlights = a.highlights.map((s) => s.trim()).filter(Boolean).slice(0, 30).map((s) => s.slice(0, 160));
  l.sourcePages = a.sourcePages.filter((p) => Number.isInteger(p) && p >= 1);
  l.excluded = { boundaries: a.excludedBoundaries, cadastralCode: a.excludedCadastralCode, thirdPartyContacts: a.excludedContacts };
  l.warnings.push(AI_REVIEW_NOTE);
  // Same last line of defence as the parser: phones, e-mails and boundary sentences never get through.
  return finalizeListing(l, { names: [], codes: [] });
}

/** Reads a PDF with Claude. Throws on API errors; the caller falls back to the rule-based parser. */
export async function extractWithAi(data: Buffer): Promise<AiExtraction | null> {
  const result = await readPdf(data);
  if (!result) return null;
  const listings = result.listings
    .map(toExtractedListing)
    // A draft with no price, no area and no location is noise, not a listing.
    .filter((l) => l.price !== null || l.landArea !== null || l.builtArea !== null || l.city !== null || l.priceNote !== null);
  return { listings, warnings: result.warnings.map((w) => w.trim()).filter(Boolean).slice(0, 10) };
}
