import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { member, seedTenant, useTestDb } from "../../../test/db";
import { makePdf } from "../../../test/pdf";
import type { Db } from "@/server/db/create";
import { imports, properties, user } from "@/server/db/schema";
import * as props from "@/modules/properties/service";
import { getImport, importPdf, listImports, MAX_PDF_BYTES, NEEDS_OCR_MESSAGE, readImportPdf } from "./service";

/** Synthetic one-property sheet in the "ficha" layout, with data that must stay private. */
const FICHA = makePdf([
  "CASA LOS CEIBOS - GUAYAQUIL\nCÓDIGO CATASTRAL 0912345678",
  [
    "INFORMACIÓN GENERAL",
    "Dirección:",
    "Casa",
    "Uso residencial",
    "Av. del Bombero km 6, cantón Guayaquil, provincia del Guayas.",
    "$95.000,00",
    "Precio de Venta",
    "Hitos del sector",
  ].join("\n"),
  "LINDEROS\nAl norte: Lote 12 con 10,00 m\nAl sur: Calle pública",
  "CONTACTOS\nMaría Pérez Gómez\nCelular 0991234567\nCorreo: mperez@bancoejemplo.com",
]);

/** Import pipeline: tenant isolation, validation, dedupe and failure states (runs without private PDFs). */
describe("imports service: isolation and validation", () => {
  let db: Db;
  let mA: ReturnType<typeof member>;
  let mB: ReturnType<typeof member>;
  let importId: string;

  beforeAll(async () => {
    db = await useTestDb();
    const A = await seedTenant(db, "impi-a");
    const B = await seedTenant(db, "impi-b");
    mA = member(A.tenant.id, { agentId: A.agent.id });
    mB = member(B.tenant.id, { agentId: B.agent.id });
    await db.insert(user).values([
      { id: mA.userId, name: "A", email: "impi-a@test.dev" },
      { id: mB.userId, name: "B", email: "impi-b@test.dev" },
    ]);
    const r = await importPdf(mA, "ficha.pdf", FICHA);
    if (r.kind !== "parsed") throw new Error(`unexpected ${r.kind}`);
    importId = r.importId;
  });

  it("creates one reviewable draft without boundaries, cadastral code or contacts", async () => {
    const view = await getImport(mA, importId);
    expect(view.drafts).toHaveLength(1);
    const d = view.drafts[0]!;
    expect(d).toMatchObject({ status: "draft", needsReview: true, price: 95000, city: "Guayaquil", province: "Guayas" });
    expect(view.import.extractedText).toBeNull();
    const pub = JSON.stringify(props.toPublic(d, []));
    expect(pub).not.toMatch(/0912345678|linderos|al norte|lote 12|0991234567|mperez|bancoejemplo|María Pérez/i);
  });

  it("another tenant cannot list, open, read the PDF of, or see drafts from the import", async () => {
    expect((await listImports(mB)).map((i) => i.id)).not.toContain(importId);
    expect((await listImports(mA)).map((i) => i.id)).toContain(importId);
    await expect(getImport(mB, importId)).rejects.toMatchObject({ code: "not_found" });
    await expect(readImportPdf(mB, importId)).rejects.toMatchObject({ code: "not_found" });
    expect(await props.listByImport(mB, importId)).toEqual([]);
    const drafts = await db.select().from(properties).where(eq(properties.sourceImportId, importId));
    await expect(props.getForEdit(mB, drafts[0]!.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("the same file is a new import for another tenant (dedupe is per tenant)", async () => {
    const r = await importPdf(mB, "ficha.pdf", FICHA);
    expect(r.kind).toBe("parsed");
    expect(r.importId).not.toBe(importId);
    expect((await importPdf(mA, "otra-vez.pdf", FICHA)).kind).toBe("already_imported");
  });

  it("an agent sees the import but only drafts they own", async () => {
    const colleague = member(mA.tenantId, { role: "agent", userId: "impi-colega", agentId: null });
    const view = await getImport(colleague, importId);
    expect(view.drafts).toEqual([]);
  });

  it("rejects non-PDF, oversized and malformed ids", async () => {
    await expect(importPdf(mA, "x.pdf", Buffer.from("PK\u0003\u0004 zip disfrazado"))).rejects.toMatchObject({ code: "invalid" });
    await expect(importPdf(mA, "x.pdf", Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(MAX_PDF_BYTES)]))).rejects.toMatchObject({
      code: "invalid",
      message: "El PDF supera 20 MB.",
    });
    for (const id of ["../../etc/passwd", "1 or 1=1", "", "00000000-0000-0000-0000-00000000000g"]) {
      await expect(getImport(mA, id), id).rejects.toMatchObject({ code: "not_found" });
    }
    await expect(getImport(mA, crypto.randomUUID())).rejects.toMatchObject({ code: "not_found" });
  });

  it("a corrupt PDF fails cleanly and is recorded as failed", async () => {
    const corrupt = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.from("esto no es un pdf ".repeat(50))]);
    await expect(importPdf(mA, "dañado.pdf", corrupt)).rejects.toMatchObject({ code: "invalid", message: expect.stringMatching(/No pudimos leer este PDF/) });
    const rows = await db.select().from(imports).where(eq(imports.fileName, "dañado.pdf"));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("failed");
    expect(await db.select().from(properties).where(eq(properties.sourceImportId, rows[0]!.id))).toEqual([]);
  });

  it("a text-less (scanned) PDF asks for OCR and creates no drafts", async () => {
    const r = await importPdf(mA, "escaneado.pdf", makePdf(["", " "]));
    expect(r).toMatchObject({ kind: "needs_ocr", message: NEEDS_OCR_MESSAGE });
    const view = await getImport(mA, r.importId);
    expect(view.needsOcr).toBe(true);
    expect(view.drafts).toEqual([]);
  });

  it("file names are stripped of path separators and control characters", async () => {
    const r = await importPdf(mA, '..\\..//evil"\r\nX-Injected: 1.pdf', makePdf(["CASA UNO\n", "otra página"]));
    const [row] = await db.select().from(imports).where(eq(imports.id, r.importId));
    expect(row!.fileName).not.toMatch(/[\\/\r\n]/);
    expect(row!.storageKey).toBe(`tenants/${mA.tenantId}/imports/${row!.fileSha256}.pdf`);
  });
});
