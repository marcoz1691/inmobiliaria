import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { member, seedTenant, useTestDb } from "../../../../test/db";
import { makePdf } from "../../../../test/pdf";
import type { Db } from "@/server/db/create";
import { imports, user } from "@/server/db/schema";
import type { MemberContext } from "@/server/session";
import { readLocal } from "@/modules/media/storage";
import { setProfilePhoto } from "@/modules/agents/admin";
import * as props from "@/modules/properties/service";
import { importPdf, MAX_PDF_BYTES } from "@/modules/imports/service";

// The signed-in member is decided per test; the real one comes from Better Auth + Host.
const session = vi.hoisted(() => ({ member: null as MemberContext | null }));
vi.mock("@/server/session", () => ({
  getMember: async () => session.member,
  requireMember: async () => session.member,
}));

const photosRoute = () => import("./properties/[id]/photos/route");
const importsRoute = () => import("./imports/route");
const pdfRoute = () => import("./imports/[id]/pdf/route");
const profilePhotoRoute = () => import("./profile/photo/route");
const mediaRoute = () => import("../../media/[...key]/route");

const ORIGIN = "http://localhost:3000";
const jpeg = () => sharp({ create: { width: 320, height: 240, channels: 3, background: "#445566" } }).jpeg().toBuffer();
const params = <T,>(p: T) => ({ params: Promise.resolve(p) });
const u8 = (b: Buffer) => new Uint8Array(b);

function upload(url: string, file: Blob | null, opts: { name?: string; origin?: string; headers?: Record<string, string>; alt?: string } = {}) {
  const form = new FormData();
  if (file) form.set("file", file, opts.name ?? "archivo");
  if (opts.alt !== undefined) form.set("alt", opts.alt);
  return new Request(`${ORIGIN}${url}`, {
    method: "POST",
    body: form,
    headers: { host: "localhost:3000", ...(opts.origin ? { origin: opts.origin } : {}), ...opts.headers },
  });
}

async function errorOf(res: Response) {
  return ((await res.json()) as { ok: boolean; error?: string }).error;
}

describe("panel route handlers", () => {
  let db: Db;
  let mA: MemberContext;
  let mB: MemberContext;
  let propertyA: string;

  beforeAll(async () => {
    db = await useTestDb();
    const A = await seedTenant(db, "rt-a");
    const B = await seedTenant(db, "rt-b");
    mA = member(A.tenant.id, { agentId: A.agent.id });
    mB = member(B.tenant.id, { agentId: B.agent.id });
    await db.insert(user).values([
      { id: mA.userId, name: "A", email: "rt-a@test.dev" },
      { id: mB.userId, name: "B", email: "rt-b@test.dev" },
    ]);
    propertyA = (await props.createDraft(mA, "Casa de rutas")).id;
  });

  beforeEach(() => {
    session.member = null;
  });

  describe("POST /api/panel/properties/[id]/photos", () => {
    const url = (id: string) => `/api/panel/properties/${id}/photos`;

    it("401 without a session, 403 from another origin", async () => {
      const { POST } = await photosRoute();
      expect((await POST(upload(url(propertyA), new Blob([u8(await jpeg())])), params({ id: propertyA }))).status).toBe(401);
      session.member = mA;
      const cross = await POST(upload(url(propertyA), new Blob([u8(await jpeg())]), { origin: "https://evil.example" }), params({ id: propertyA }));
      expect(cross.status).toBe(403);
    });

    it("404 for malformed ids and for a property of another tenant", async () => {
      const { POST } = await photosRoute();
      session.member = mB;
      for (const id of ["../../etc", "not-a-uuid", propertyA]) {
        const res = await POST(upload(url(id), new Blob([u8(await jpeg())]), { origin: ORIGIN }), params({ id }));
        expect(res.status, id).toBe(404);
      }
      expect((await props.getForEdit(mA, propertyA)).media).toHaveLength(0);
    });

    it("403 for an agent who does not own the listing", async () => {
      const { POST } = await photosRoute();
      session.member = { ...mA, role: "agent", userId: "otro-agente", agentId: null };
      expect((await POST(upload(url(propertyA), new Blob([u8(await jpeg())])), params({ id: propertyA }))).status).toBe(403);
    });

    it("413 above 15 MB (declared or actual), 400 without a file", async () => {
      const { POST } = await photosRoute();
      session.member = mA;
      const declared = await POST(upload(url(propertyA), new Blob([u8(await jpeg())]), { headers: { "content-length": String(40 * 1024 * 1024) } }), params({ id: propertyA }));
      expect(declared.status).toBe(413);
      const big = await POST(upload(url(propertyA), new Blob([u8(Buffer.alloc(15 * 1024 * 1024 + 1))]), { name: "grande.jpg" }), params({ id: propertyA }));
      expect(big.status).toBe(413);
      expect(await errorOf(big)).toBe("La foto supera 15 MB.");
      expect((await POST(upload(url(propertyA), null), params({ id: propertyA }))).status).toBe(400);
      expect((await POST(upload(url(propertyA), new Blob([])), params({ id: propertyA }))).status).toBe(400);
    });

    it("415 for corrupt images, PDFs and SVG disguised as photos", async () => {
      const { POST } = await photosRoute();
      session.member = mA;
      const truncated = (await jpeg()).subarray(0, 200);
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><script>alert(1)</script></svg>');
      for (const [name, body] of [
        ["corrupta.jpg", truncated],
        ["ruido.jpg", Buffer.from("no es una imagen ".repeat(20))],
        ["ficha.jpg", makePdf(["CASA"])],
        ["vector.jpg", svg],
      ] as const) {
        const res = await POST(upload(url(propertyA), new Blob([u8(body)], { type: "image/jpeg" }), { name }), params({ id: propertyA }));
        expect(res.status, name).toBe(415);
      }
      expect((await props.getForEdit(mA, propertyA)).media).toHaveLength(0);
    });

    it("200 with a valid photo; the alt text is capped", async () => {
      const { POST } = await photosRoute();
      session.member = mA;
      const res = await POST(upload(url(propertyA), new Blob([u8(await jpeg())]), { name: "sala.jpg", origin: ORIGIN, alt: "x".repeat(500) }), params({ id: propertyA }));
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const body = (await res.json()) as { ok: boolean; data: { src: string; alt: string; isCover: boolean } };
      expect(body.ok).toBe(true);
      expect(body.data.src).toMatch(new RegExp(`^media:/media/tenants/${mA.tenantId}/properties/${propertyA}/`));
      expect(body.data.alt).toHaveLength(200);
      expect(body.data.isCover).toBe(true);
    });
  });

  describe("POST /api/panel/imports", () => {
    it("401 without a session, 403 cross-origin", async () => {
      const { POST } = await importsRoute();
      expect((await POST(upload("/api/panel/imports", new Blob([u8(makePdf(["x"]))])))).status).toBe(401);
      session.member = mA;
      expect((await POST(upload("/api/panel/imports", new Blob([u8(makePdf(["x"]))]), { origin: "http://localhost.evil.example" }))).status).toBe(403);
    });

    it("413 above 20 MB, 400 for missing, non-PDF or corrupt files", async () => {
      const { POST } = await importsRoute();
      session.member = mA;
      const declared = await POST(upload("/api/panel/imports", new Blob([u8(makePdf(["x"]))]), { headers: { "content-length": String(MAX_PDF_BYTES + 128 * 1024) } }));
      expect(declared.status).toBe(413);
      const big = await POST(upload("/api/panel/imports", new Blob([u8(Buffer.alloc(MAX_PDF_BYTES + 1))]), { name: "grande.pdf" }));
      expect(big.status).toBe(413);
      expect((await POST(upload("/api/panel/imports", null))).status).toBe(400);
      const notPdf = await POST(upload("/api/panel/imports", new Blob([u8(await jpeg())], { type: "application/pdf" }), { name: "foto.pdf" }));
      expect(notPdf.status).toBe(400);
      expect(await errorOf(notPdf)).toBe("El archivo no es un PDF válido.");
      const corrupt = await POST(upload("/api/panel/imports", new Blob([u8(Buffer.from("%PDF-1.5\n" + "basura ".repeat(100)))]), { name: "dañado.pdf" }));
      expect(corrupt.status).toBe(400);
      expect(await errorOf(corrupt)).toMatch(/No pudimos leer este PDF/);
    });

    it("200 for a valid PDF, scoped to the member's tenant", async () => {
      const { POST } = await importsRoute();
      session.member = mA;
      const res = await POST(upload("/api/panel/imports", new Blob([u8(makePdf(["CASA RUTA - QUITO", "sin ficha"]))]), { name: "ruta.pdf", origin: ORIGIN }));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; data: { kind: string } };
      expect(body.ok).toBe(true);
      expect(["parsed", "needs_ocr"]).toContain(body.data.kind);
    });
  });

  describe("GET /api/panel/imports/[id]/pdf", () => {
    let importId: string;
    beforeAll(async () => {
      const r = await importPdf(mA, 'ficha "rara" ñ\r\n.pdf', makePdf(["CASA PDF - QUITO", "otra"]));
      importId = r.importId;
    });

    it("401 without a session, 404 for bad or foreign ids", async () => {
      const { GET } = await pdfRoute();
      const req = new Request(`${ORIGIN}/api/panel/imports/${importId}/pdf`);
      expect((await GET(req, params({ id: importId }))).status).toBe(401);
      session.member = mB;
      expect((await GET(req, params({ id: importId }))).status).toBe(404);
      expect((await GET(req, params({ id: "../../../package.json" }))).status).toBe(404);
      session.member = mA;
      expect((await GET(req, params({ id: crypto.randomUUID() }))).status).toBe(404);
    });

    it("200 for the owner, private and with a safe Content-Disposition", async () => {
      const { GET } = await pdfRoute();
      session.member = mA;
      const res = await GET(new Request(`${ORIGIN}/api/panel/imports/${importId}/pdf`), params({ id: importId }));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/pdf");
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      const cd = res.headers.get("content-disposition")!;
      expect(cd).not.toMatch(/[\r\n]/);
      const ascii = /filename="([^"]*)"/.exec(cd)?.[1];
      expect(ascii).toBeDefined();
      expect(ascii).not.toContain('"');
      expect(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
    });
  });

  describe("POST /api/panel/profile/photo", () => {
    it("401, 413 and 400 for unreadable images", async () => {
      const { POST } = await profilePhotoRoute();
      expect((await POST(upload("/api/panel/profile/photo", new Blob([u8(await jpeg())])))).status).toBe(401);
      session.member = mA;
      expect((await POST(upload("/api/panel/profile/photo", new Blob([u8(await jpeg())]), { origin: "https://evil.example" }))).status).toBe(403);
      expect((await POST(upload("/api/panel/profile/photo", new Blob([u8(Buffer.alloc(15 * 1024 * 1024 + 1))])))).status).toBe(413);
      const bad = await POST(upload("/api/panel/profile/photo", new Blob([u8(Buffer.from("GIF89a no"))])));
      expect(bad.status).toBe(400);
      const ok = await POST(upload("/api/panel/profile/photo", new Blob([u8(await jpeg())]), { origin: ORIGIN }));
      expect(ok.status).toBe(200);
      expect(((await ok.json()) as { data: { photoUrl: string } }).data.photoUrl).toContain(`/tenants/${mA.tenantId}/agents/`);
    });
  });

  describe("GET /media/[...key]", () => {
    const get = async (key: string[]) => (await mediaRoute()).GET(new Request(`${ORIGIN}/media/${key.join("/")}`), params({ key }));

    it("serves stored photo variants as WebP", async () => {
      const p = await props.createDraft(mA, "Casa con foto pública");
      const photo = await props.addPhoto(mA, p.id, await jpeg());
      const res = await get(`${photo.storageKey}-480.webp`.split("/"));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/webp");
      const agentPhoto = (await setProfilePhoto(mA, await jpeg())).replace(/^media:\/media\//, "");
      expect((await get(`${agentPhoto}-960.webp`.split("/"))).status).toBe(200);
      // Media of another tenant is reachable only by its unguessable key, like any public photo.
      expect((await get(`${photo.storageKey}-480.webp`.replace(mA.tenantId, mB.tenantId).split("/"))).status).toBe(404);
    });

    it("rejects path traversal, absolute paths and null bytes", async () => {
      for (const key of [
        ["..", "..", "package.json"],
        ["tenants", "..", "..", "..", "package.json"],
        ["..", "dev-secret"],
        ["", "etc", "passwd"],
        ["%2e%2e", "%2e%2e", "package.json"],
        ["tenants", "a\u0000.webp"],
        [".."],
      ]) {
        const res = await get(key);
        expect(res.status, key.join("/")).toBe(404);
        expect(await res.text()).not.toContain('"name"');
      }
    });
  });
});
