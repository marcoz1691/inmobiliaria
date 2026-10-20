import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { withTenant, type Tx } from "@/server/db/tenant-tx";
import { imports } from "@/server/db/schema";
import type { MemberContext } from "@/server/session";
import { AppError, notFound } from "@/lib/errors";
import { sha256 } from "@/lib/crypto";
import { errorInfo, log } from "@/lib/logger";
import { integrations } from "@/env";
import { audit } from "@/modules/audit/audit";
import { getStorage, readLocal } from "@/modules/media/storage";
import { addPhoto, createImportedDraft, listByImport, listDedupeCandidates } from "@/modules/properties/service";
import { extractFromPdf } from "./extract";
import { extractPdfImages } from "./images";
import { findDuplicates } from "./duplicates";
import type { DuplicateMatch, ExtractedListing, ListingField } from "./types";

export const MAX_PDF_BYTES = 20 * 1024 * 1024;
/** At or above this score an existing property is treated as the same listing and no draft is created. */
export const STRONG_DUPLICATE = 0.8;
export const MAX_PHOTOS_PER_LISTING = 12;

export const NEEDS_OCR_MESSAGE =
  "PDF escaneado: la lectura asistida por IA estará disponible al conectar la clave de IA.";

export type ImportRow = typeof imports.$inferSelect;

/** What happened to each extracted listing. Stored next to the listing inside `imports.extracted`. */
export type ListingOutcome = {
  propertyId: string | null;
  duplicates: (DuplicateMatch & { title: string })[];
  skippedReason: string | null;
  photos: number;
};
export type StoredListing = ExtractedListing & { outcome?: ListingOutcome };

export type ImportResult =
  | { kind: "already_imported"; importId: string; fileName: string }
  | { kind: "needs_ocr"; importId: string; message: string }
  | { kind: "parsed"; importId: string; created: number; skipped: number; warnings: string[] };

const run = async <T>(tenantId: string, fn: (tx: Tx) => Promise<T>) => withTenant(await getDb(), tenantId, fn);

function isPdf(data: Buffer): boolean {
  return data.subarray(0, 5).toString("latin1") === "%PDF-";
}

/** Maps the parser's per-field confidence to the property's `fieldConfidence` (only fields worth flagging). */
export function toFieldConfidence(confidence: Record<ListingField, "high" | "low" | "missing">) {
  const out: Record<string, "high" | "low" | "missing"> = {};
  for (const [field, level] of Object.entries(confidence)) out[field] = level;
  return out;
}

export function reviewNotesFor(listing: ExtractedListing, globalWarnings: string[]): string | null {
  const lines = [...listing.warnings, ...globalWarnings.filter((w) => !listing.warnings.includes(w))];
  if (listing.priceKind === "appraisal") lines.unshift("El precio importado es un avalúo, no un precio de venta. Confírmalo antes de publicar.");
  return lines.length ? lines.map((l) => `• ${l}`).join("\n").slice(0, 4000) : null;
}

function draftValues(l: ExtractedListing) {
  return {
    description: l.description,
    operation: l.operation,
    propertyType: l.propertyType,
    price: l.price,
    priceKind: l.priceKind,
    priceNote: l.priceNote,
    landArea: l.landArea,
    builtArea: l.builtArea,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    parking: l.parking,
    amenities: l.amenities.slice(0, 60),
    highlights: l.highlights.slice(0, 30),
    address: l.address,
    sector: l.sector,
    city: l.city,
    province: l.province,
    lat: l.lat,
    lng: l.lng,
  };
}

/**
 * PDF → stored file + `imports` row + one draft per extracted listing (unless a strong duplicate
 * exists). Never publishes anything and never invents data: drafts carry `needsReview`.
 */
export async function importPdf(m: MemberContext, fileName: string, data: Buffer): Promise<ImportResult> {
  if (data.byteLength > MAX_PDF_BYTES) throw new AppError("invalid", "El PDF supera 20 MB.");
  if (!isPdf(data)) throw new AppError("invalid", "El archivo no es un PDF válido.");
  const sha = sha256(data);
  const safeName = fileName.replace(/[\\/\u0000-\u001f]/g, "").slice(0, 200) || "documento.pdf";

  const existing = await run(m.tenantId, (tx) =>
    tx.select({ id: imports.id, fileName: imports.fileName }).from(imports).where(and(eq(imports.tenantId, m.tenantId), eq(imports.fileSha256, sha))).limit(1),
  );
  if (existing[0]) return { kind: "already_imported", importId: existing[0].id, fileName: existing[0].fileName };

  const storageKey = `tenants/${m.tenantId}/imports/${sha}.pdf`;
  await getStorage().put(storageKey, data, "application/pdf");

  const inserted = await run(m.tenantId, async (tx) => {
    const rows = await tx
      .insert(imports)
      .values({ tenantId: m.tenantId, fileName: safeName, fileSha256: sha, storageKey, status: "pending", createdBy: m.userId })
      .onConflictDoNothing()
      .returning({ id: imports.id });
    if (rows[0]) await audit(tx, { tenantId: m.tenantId, actorUserId: m.userId, action: "import.create", entityType: "import", entityId: rows[0].id });
    return rows[0];
  });
  if (!inserted) {
    // Lost a race with a concurrent upload of the same file.
    const [row] = await run(m.tenantId, (tx) =>
      tx.select({ id: imports.id, fileName: imports.fileName }).from(imports).where(and(eq(imports.tenantId, m.tenantId), eq(imports.fileSha256, sha))),
    );
    return { kind: "already_imported", importId: row!.id, fileName: row!.fileName };
  }
  const importId = inserted.id;

  try {
    const result = await extractFromPdf(new Uint8Array(data));
    if (result.needsOcr) {
      await run(m.tenantId, (tx) =>
        tx
          .update(imports)
          .set({ status: "parsed", pageCount: result.pageCount, extractedText: result.text, extracted: [], method: "parser", error: NEEDS_OCR_MESSAGE })
          .where(and(eq(imports.tenantId, m.tenantId), eq(imports.id, importId))),
      );
      return { kind: "needs_ocr", importId, message: NEEDS_OCR_MESSAGE };
    }

    const candidates = await listDedupeCandidates(m);
    const images = result.listings.length ? await extractPdfImages(new Uint8Array(data)).catch((err) => {
      log.warn("import images failed", { importId, ...errorInfo(err) });
      return [];
    }) : [];

    const stored: StoredListing[] = [];
    let created = 0;
    for (const listing of result.listings) {
      const duplicates = findDuplicates(listing, candidates).map((d) => ({ ...d, title: candidates.find((c) => c.id === d.id)?.title ?? "" }));
      const strong = duplicates.find((d) => d.score >= STRONG_DUPLICATE);
      if (strong) {
        stored.push({ ...listing, outcome: { propertyId: null, duplicates, skippedReason: `Ya existe una propiedad muy parecida: «${strong.title || "sin título"}».`, photos: 0 } });
        continue;
      }
      const draft = await createImportedDraft(m, {
        title: listing.title ?? "",
        values: draftValues(listing),
        fieldConfidence: toFieldConfidence(listing.confidence),
        reviewNotes: reviewNotesFor(listing, result.warnings),
        sourceImportId: importId,
      });
      created++;
      // A single-property sheet owns every photo in the file; catalog listings only those on their pages.
      const pages = new Set(listing.sourcePages);
      const single = result.listings.length === 1;
      const own = images.filter((img) => single || pages.size === 0 || pages.has(img.page)).slice(0, MAX_PHOTOS_PER_LISTING);
      let photos = 0;
      for (const img of own) {
        try {
          await addPhoto(m, draft.id, img.webp);
          photos++;
        } catch (err) {
          log.warn("import photo skipped", { importId, page: img.page, ...errorInfo(err) });
        }
      }
      stored.push({ ...listing, outcome: { propertyId: draft.id, duplicates, skippedReason: null, photos } });
    }

    await run(m.tenantId, (tx) =>
      tx
        .update(imports)
        .set({
          status: created > 0 ? "converted" : "parsed",
          pageCount: result.pageCount,
          extractedText: result.text,
          extracted: stored,
          method: result.method,
          error: result.warnings.length ? result.warnings.join("\n").slice(0, 2000) : null,
        })
        .where(and(eq(imports.tenantId, m.tenantId), eq(imports.id, importId))),
    );
    return { kind: "parsed", importId, created, skipped: stored.length - created, warnings: result.warnings };
  } catch (err) {
    log.error("import failed", { importId, ...errorInfo(err) });
    await run(m.tenantId, (tx) =>
      tx
        .update(imports)
        .set({ status: "failed", error: "No pudimos leer este PDF. Puede estar dañado o protegido." })
        .where(and(eq(imports.tenantId, m.tenantId), eq(imports.id, importId))),
    );
    throw new AppError("invalid", "No pudimos leer este PDF. Puede estar dañado o protegido con contraseña.");
  }
}

export async function listImports(m: MemberContext) {
  return run(m.tenantId, (tx) =>
    tx
      .select({ id: imports.id, fileName: imports.fileName, status: imports.status, pageCount: imports.pageCount, createdAt: imports.createdAt, error: imports.error })
      .from(imports)
      .where(eq(imports.tenantId, m.tenantId))
      .orderBy(desc(imports.createdAt))
      .limit(100),
  );
}

export async function getImport(m: MemberContext, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound("Importación");
  const [row] = await run(m.tenantId, (tx) =>
    tx.select().from(imports).where(and(eq(imports.tenantId, m.tenantId), eq(imports.id, id))).limit(1),
  );
  if (!row) throw notFound("Importación");
  const listings = (Array.isArray(row.extracted) ? row.extracted : []) as StoredListing[];
  const drafts = await listByImport(m, id);
  return { import: { ...row, extractedText: null }, listings, drafts, needsOcr: row.error === NEEDS_OCR_MESSAGE };
}

/** Raw PDF for the authenticated panel route. */
export async function readImportPdf(m: MemberContext, id: string): Promise<{ body: Buffer; fileName: string }> {
  const { import: row } = await getImport(m, id);
  if (!row.storageKey) throw notFound("Archivo");
  if (integrations.supabaseStorage) {
    const res = await fetch(getStorage().url(row.storageKey));
    if (!res.ok) throw notFound("Archivo");
    return { body: Buffer.from(await res.arrayBuffer()), fileName: row.fileName };
  }
  return { body: await readLocal(row.storageKey), fileName: row.fileName };
}
