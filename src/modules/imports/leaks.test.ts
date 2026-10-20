import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { member, seedTenant, useTestDb } from "../../../test/db";
import { hasPdfDir, PDF_DIR } from "../../../test/pdf";
import { imports, properties, user } from "@/server/db/schema";
import { toPublic, type PropertyRow } from "@/modules/properties/service";
import { extractFromPdf } from "./extract";
import { getImport, importPdf } from "./service";
import type { ExtractedListing } from "./types";

/**
 * Privacy scan of the importer over the real sample PDFs (gitignored, skipped in CI).
 * Sensitive tokens are harvested from each PDF's own text, so the scan cannot pass vacuously
 * and does not depend on snapshots of the parser output.
 */

const PHONE = /(?<!\d)(?:\+?593[\s-]?)?0\d{8,9}(?!\d)|(?<!\d)0\d[\s-]\d{3}[\s-]\d{4}(?!\d)/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const CODE_LINE = /(c[óo]digo\s+catastral|clave\s+catastral|predio|piso\s+\d+)\s*:?\s*#?\s*([\d-]{6,})/gi;
/** Words that never belong in a public listing (labels of excluded sections, third parties). */
const FORBIDDEN = [
  /linderos?/i,
  /(?<!\p{L})(al\s+)?(norte|sur|este|oeste)\s*:/iu,
  /catastr/i,
  /predio/i,
  /banco|bancoguayaquil|austro/i,
  /administrador\s+de\s+bienes/i,
  /propiedad\s+intelectual/i,
  /(?<!\p{L})(celular|tel[eé]fono|correo)(?!\p{L})/iu,
  /\bext\.?\s*\d/i,
];

type Secrets = { phones: string[]; emails: string[]; mailboxes: string[]; codes: string[] };

const digits = (s: string) => s.replace(/\D/g, "");

function harvest(text: string): Secrets {
  const phones = [...new Set([...text.matchAll(PHONE)].map((m) => digits(m[0]).replace(/^593/, "0")))];
  const emails = [...new Set([...text.matchAll(EMAIL)].map((m) => m[0].toLowerCase()))];
  const mailboxes = [...new Set(emails.map((e) => e.split("@")[0]!).filter((x) => x.length >= 4))];
  const codes = [...new Set([...text.matchAll(CODE_LINE)].map((m) => m[2]!))];
  // Long bare digit runs on cover pages are cadastral keys too (e.g. "061050510118013000").
  for (const m of text.matchAll(/(?<![\d.,])\d{12,}(?![\d.,])/g)) codes.push(m[0]);
  return { phones, emails, mailboxes, codes };
}

/** Every field the importer may copy into a publishable property (internal bookkeeping excluded). */
function publishable(l: ExtractedListing): string {
  const { warnings: _w, confidence: _c, excluded: _e, sourcePages: _s, ...rest } = l;
  return JSON.stringify(rest);
}

function leaks(text: string, secrets: Secrets): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  const textDigits = text.replace(/[\s.-]/g, "");
  for (const re of FORBIDDEN) if (re.test(text)) found.push(`patrón ${re}`);
  for (const p of secrets.phones) if (textDigits.includes(p)) found.push(`teléfono ${p}`);
  for (const e of secrets.emails) if (lower.includes(e)) found.push(`correo ${e}`);
  for (const b of secrets.mailboxes) if (lower.includes(b)) found.push(`nombre de buzón ${b}`);
  for (const c of secrets.codes) if (text.includes(c) || textDigits.includes(digits(c))) found.push(`código ${c}`);
  for (const m of text.match(EMAIL) ?? []) found.push(`correo ${m}`);
  return found;
}

const FILES = hasPdfDir ? readdirSync(PDF_DIR).filter((f) => f.toLowerCase().endsWith(".pdf")).sort() : [];

describe.skipIf(!hasPdfDir)("importer privacy scan — real PDFs", () => {
  const extracted = new Map<string, { text: string; listings: ExtractedListing[] }>();

  beforeAll(async () => {
    for (const f of FILES) {
      const r = await extractFromPdf(new Uint8Array(readFileSync(path.join(PDF_DIR, f))));
      extracted.set(f, { text: r.text, listings: r.listings });
    }
  }, 180_000);

  it("covers the 11 sample PDFs and the scanner is not vacuous", () => {
    expect(FILES).toHaveLength(11);
    const all = [...extracted.values()].map((e) => e.text).join("\n");
    const s = harvest(all);
    // The sources really contain what must never be published.
    expect(s.phones.length).toBeGreaterThanOrEqual(4);
    expect(s.emails.length).toBeGreaterThanOrEqual(3);
    expect(s.codes.length).toBeGreaterThanOrEqual(5);
    expect(all).toMatch(/LINDEROS/);
    expect(all).toMatch(/BANCO DEL AUSTRO/);
    expect(leaks(all, s).length).toBeGreaterThan(5);
  });

  for (const f of FILES) {
    it(`${f}: no publishable field leaks contacts, banks, boundaries or cadastral codes`, () => {
      const { text, listings } = extracted.get(f)!;
      const secrets = harvest(text);
      for (const [i, l] of listings.entries()) {
        expect(leaks(publishable(l), secrets), `${f} #${i + 1} «${l.title}»`).toEqual([]);
      }
    });
  }

  it("full pipeline: imported drafts and their public projection stay clean", async () => {
    const db = await useTestDb();
    const { tenant, agent } = await seedTenant(db, "leaks");
    const m = member(tenant.id, { agentId: agent.id });
    await db.insert(user).values({ id: m.userId, name: "Leaks", email: "leaks@test.dev" });

    for (const f of FILES) {
      const data = readFileSync(path.join(PDF_DIR, f));
      const r = await importPdf(m, f, data);
      expect(r.kind, f).toBe("parsed");
      const secrets = harvest(extracted.get(f)!.text);
      const view = await getImport(m, r.importId);
      // The raw text (which has every contact) never leaves the server through the review view.
      expect(view.import.extractedText).toBeNull();
      const rows: PropertyRow[] = await db.select().from(properties).where(eq(properties.sourceImportId, r.importId));
      expect(rows.length, f).toBe(view.drafts.length);
      for (const row of rows) {
        expect(row.status).toBe("draft");
        expect(row.needsReview).toBe(true);
        const pub = JSON.stringify(toPublic({ ...row, status: "published" }, []));
        expect(leaks(pub, secrets), `${f} «${row.title}»`).toEqual([]);
        // Private review data is not part of the public projection.
        expect(pub).not.toContain("reviewNotes");
        expect(pub).not.toContain("fieldConfidence");
        if (row.priceKind === "appraisal") expect(JSON.parse(pub).price, `${f} «${row.title}» avalúo`).toBeNull();
      }
    }
    const stored = await db.select({ text: imports.extractedText }).from(imports).where(eq(imports.tenantId, tenant.id));
    expect(stored).toHaveLength(FILES.length);
  }, 600_000);
});
