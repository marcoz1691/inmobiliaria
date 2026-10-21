import { expect, test } from "@playwright/test";

// Fixture (scripts/e2e-fixtures.ts): approximate location at -0.2018, -78.4321; price 185 000.
const SLUG = "casa-de-prueba-e2e-en-cumbaya";
const EXACT = ["-0.2018", "-78.4321"];

test.describe("public privacy in rendered HTML (including the RSC payload)", () => {
  test("listing page and catalog never carry exact coordinates or private fields", async ({ request }) => {
    for (const path of [`/propiedades/${SLUG}`, "/propiedades", "/"]) {
      const res = await request.get(path, { timeout: 120_000 });
      expect(res.status(), path).toBe(200);
      const html = await res.text();
      for (const c of EXACT) expect(html, `${path} ${c}`).not.toContain(c);
      expect(html, path).not.toMatch(/reviewNotes|fieldConfidence|sourceImportId|needsReview|createdBy/);
    }
  });

  test("JSON-LD states the sale price but no street address or geo point", async ({ request }) => {
    const html = await (await request.get(`/propiedades/${SLUG}`, { timeout: 120_000 })).text();
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]!) as Record<string, unknown>);
    const listing = blocks.find((b) => b["@type"] === "RealEstateListing") as { offers?: { price?: number }; about?: { address?: Record<string, unknown> } } | undefined;
    expect(listing).toBeDefined();
    expect(listing!.offers?.price).toBe(185000);
    expect(listing!.about?.address).not.toHaveProperty("streetAddress");
    expect(JSON.stringify(blocks)).not.toMatch(/"geo"|"latitude"|"longitude"/);
  });
});

/** Slice starting at the consent control so the site footer link to /privacidad does not count. */
function aroundConsent(html: string): string | undefined {
  const i = html.search(/name="consent"|id="[^"]*consent"/);
  if (i < 0) return undefined;
  return html.slice(i, i + 1600);
}

test.describe("LOPDP consent control on public HTML", () => {
  test("contacto and listing place a /privacidad link next to the checkbox", async ({ request }) => {
    for (const path of ["/contacto", `/propiedades/${SLUG}`]) {
      const html = await (await request.get(path, { timeout: 120_000 })).text();
      const slice = aroundConsent(html);
      expect(slice, path).toBeTruthy();
      expect(slice, path).toMatch(/href="\/privacidad"/);
    }
  });
});

test.describe("panel APIs on the real server", () => {
  test("anonymous requests get 401 and never a file", async ({ request }) => {
    const id = "00000000-0000-4000-8000-000000000000";
    expect((await request.post("/api/panel/imports", { multipart: { file: { name: "x.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") } } })).status()).toBe(401);
    expect((await request.get(`/api/panel/imports/${id}/pdf`)).status()).toBe(401);
    expect((await request.post(`/api/panel/properties/${id}/photos`, { multipart: { file: { name: "x.jpg", mimeType: "image/jpeg", buffer: Buffer.from("x") } } })).status()).toBe(401);
    expect((await request.post("/api/panel/profile/photo", { multipart: { file: { name: "x.jpg", mimeType: "image/jpeg", buffer: Buffer.from("x") } } })).status()).toBe(401);
  });

  test("the media route does not walk out of the media folder", async ({ request }) => {
    for (const path of ["/media/..%2f..%2fpackage.json", "/media/%2e%2e/%2e%2e/package.json", "/media/tenants/..%2f..%2f..%2f.env.local"]) {
      const res = await request.get(path);
      // Next rejects encoded separators with 400 before the route runs; either way, no file.
      expect([400, 404], path).toContain(res.status());
      expect(await res.text(), path).not.toMatch(/"dependencies"|DATABASE_URL|BETTER_AUTH_SECRET/);
    }
  });
});
