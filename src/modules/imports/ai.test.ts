import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { member, seedTenant, useTestDb } from "../../../test/db";
import { makePdf } from "../../../test/pdf";
import { imports, properties, user } from "@/server/db/schema";
import { emptyListing } from "./listing";
import type { ExtractedListing } from "./types";

// The Claude call is the only thing simulated: no network, no key needed.
const ai = vi.hoisted(() => ({ available: true, impl: null as null | (() => Promise<unknown>) }));
vi.mock("./ai", async (orig) => {
  const real = await orig<typeof import("./ai")>();
  return { ...real, aiImportAvailable: () => ai.available, extractWithAi: () => ai.impl!() };
});

const { toExtractedListing, AI_REVIEW_NOTE } = await import("./ai");
const { importPdf, AI_WARNINGS } = await import("./service");

const raw = (over: Record<string, unknown> = {}) => ({
  title: "Casa con jardín en Sangolquí",
  description: "Casa de tres dormitorios. Informes al 0991234567 o ventas@banco.ec.",
  operation: "sale" as const,
  propertyType: "house" as const,
  price: 120000,
  priceKind: "appraisal" as const,
  priceNote: null,
  landArea: 300,
  builtArea: 180,
  bedrooms: 3,
  bathrooms: 2.5,
  parking: 2,
  address: "Calle Los Pinos 123",
  sector: "San Rafael",
  city: "Sangolquí",
  province: null,
  amenities: ["Jardín", "jardín", "Guardianía"],
  highlights: ["Cerca del Triángulo"],
  sourcePages: [1, 2],
  uncertainFields: ["builtArea", "nonsense"],
  excludedBoundaries: true,
  excludedCadastralCode: false,
  excludedContacts: true,
  ...over,
});

describe("AI listing mapping", () => {
  it("normalizes places, keeps confidence and scrubs contacts", () => {
    const l = toExtractedListing(raw());
    expect(l.city).toBe("Rumiñahui");
    expect(l.province).toBe("Pichincha");
    expect(l.confidence.builtArea).toBe("low");
    expect(l.confidence.price).toBe("high");
    expect(l.description).not.toMatch(/0991234567|banco\.ec/);
    expect(l.amenities).toEqual(["Jardín", "Guardianía"]);
    expect(l.warnings).toContain(AI_REVIEW_NOTE);
    expect(l.warnings.join(" ")).toMatch(/avalúo/);
    expect(l.warnings.join(" ")).toMatch(/linderos/);
  });

  it("drops impossible numbers and flags unknown cities", () => {
    const l = toExtractedListing(raw({ price: -5, bedrooms: 5000, city: "Cumbayá", province: "Pichincha" }));
    expect(l.price).toBeNull();
    expect(l.bedrooms).toBeNull();
    expect(l.city).toBe("Cumbayá");
    expect(l.confidence.city).toBe("low");
    expect(l.province).toBe("Pichincha");
  });
});

describe("import pipeline with the AI reader", () => {
  let m: ReturnType<typeof member>;
  let n = 0;
  const pdf = () => makePdf([`Documento de prueba ${++n} con texto suficiente para no parecer escaneado.`]);

  beforeAll(async () => {
    const db = await useTestDb();
    const A = await seedTenant(db, "ai-imp");
    m = member(A.tenant.id, { agentId: A.agent.id });
    await db.insert(user).values({ id: m.userId, name: "A", email: "ai-imp@test.dev" });
  });
  beforeEach(() => {
    ai.available = true;
  });

  it("creates drafts from what the AI read and records the method", async () => {
    const listing: ExtractedListing = toExtractedListing(raw());
    ai.impl = async () => ({ listings: [listing], warnings: [] });
    const r = await importPdf(m, "folleto.pdf", pdf());
    expect(r).toMatchObject({ kind: "parsed", created: 1, method: "ai" });
    const db = await useTestDbHandle();
    const [row] = await db.select().from(imports).where(eq(imports.id, r.importId));
    expect(row?.method).toBe("ai");
    const [draft] = await db.select().from(properties).where(eq(properties.sourceImportId, r.importId));
    expect(draft).toMatchObject({ status: "draft", needsReview: true, city: "Rumiñahui", title: "Casa con jardín en Sangolquí" });
    expect(draft?.reviewNotes).toContain("Completado por IA");
  });

  it("falls back to the rule-based reader when the AI fails or finds nothing", async () => {
    ai.impl = async () => {
      throw new Error("network down");
    };
    const failed = await importPdf(m, "otro.pdf", pdf());
    expect(failed).toMatchObject({ kind: "parsed", method: "parser" });
    expect(failed.kind === "parsed" && failed.warnings).toContain(AI_WARNINGS.failed);

    ai.impl = async () => ({ listings: [emptyListing()].filter(() => false), warnings: [] });
    const empty = await importPdf(m, "vacio.pdf", pdf());
    expect(empty.kind === "parsed" && empty.warnings).toContain(AI_WARNINGS.empty);
  });

  it("does not call the AI when it is not connected", async () => {
    ai.available = false;
    ai.impl = async () => {
      throw new Error("should not be called");
    };
    const r = await importPdf(m, "sin-ia.pdf", pdf());
    expect(r).toMatchObject({ method: "parser" });
    expect(r.kind === "parsed" && r.warnings).not.toContain(AI_WARNINGS.failed);
  });
});

async function useTestDbHandle() {
  return (await (globalThis as unknown as { __db: Promise<import("@/server/db/create").Db> }).__db)!;
}
