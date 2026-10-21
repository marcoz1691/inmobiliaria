import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { member, seedTenant, useTestDb } from "../../../test/db";
import type { Db } from "@/server/db/create";
import { agentProfiles, properties, user } from "@/server/db/schema";
import * as svc from "./service";

const jpeg = () => sharp({ create: { width: 640, height: 480, channels: 3, background: "#6f7f8f" } }).jpeg().toBuffer();

/**
 * Horizontal access on the panel functions (list, photos, review, dedupe) and the
 * per-agent ownership rule: an `agent` only edits listings they created or are assigned to.
 */
describe("properties: tenant isolation and agent ownership", () => {
  let db: Db;
  let A: Awaited<ReturnType<typeof seedTenant>>;
  let mA: ReturnType<typeof member>;
  let mB: ReturnType<typeof member>;
  let agentA: ReturnType<typeof member>;
  let colleague: ReturnType<typeof member>;

  beforeAll(async () => {
    db = await useTestDb();
    A = await seedTenant(db, "iso-a");
    const B = await seedTenant(db, "iso-b");
    const [second] = await db.insert(agentProfiles).values({ tenantId: A.tenant.id, slug: "segundo", displayName: "Segundo" }).returning();
    mA = member(A.tenant.id, { agentId: A.agent.id });
    mB = member(B.tenant.id, { agentId: B.agent.id });
    agentA = member(A.tenant.id, { role: "agent", userId: "agent-a", agentId: second!.id });
    colleague = member(A.tenant.id, { role: "agent", userId: "colleague-a", agentId: null });
    await db.insert(user).values([
      { id: mA.userId, name: "A", email: "iso-a@test.dev" },
      { id: mB.userId, name: "B", email: "iso-b@test.dev" },
      { id: agentA.userId, name: "Agente", email: "agent-a@test.dev" },
      { id: colleague.userId, name: "Colega", email: "colleague-a@test.dev" },
    ]);
  });

  it("panel list never includes another tenant's rows, even when searching for them", async () => {
    const p = await svc.createDraft(mA, "Casa secreta Tumbaco");
    await svc.updateDraft(mA, p.id, { city: "Tumbaco" });
    for (const opts of [{}, { q: "secreta" }, { q: "Tumbaco" }, { status: "draft" as const }, { status: "active" as const }, { status: "archived" as const }]) {
      expect((await svc.listForPanel(mB, opts)).map((r) => r.id), JSON.stringify(opts)).not.toContain(p.id);
    }
    expect((await svc.listForPanel(mA, { q: "secreta" })).map((r) => r.id)).toEqual([p.id]);
    expect((await svc.listDedupeCandidates(mB)).map((r) => r.id)).not.toContain(p.id);
  });

  it("photo operations reject ids of another tenant", async () => {
    const p = await svc.createDraft(mA, "Fotos de A");
    const photo = await svc.addPhoto(mA, p.id, await jpeg());
    const other = await svc.createDraft(mB, "Fotos de B");
    const photoB = await svc.addPhoto(mB, other.id, await jpeg());

    await expect(svc.updatePhotoAlt(mB, p.id, photo.id, "x")).rejects.toMatchObject({ code: "not_found" });
    await expect(svc.setCover(mB, p.id, photo.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(svc.removePhoto(mB, p.id, photo.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(svc.reorderPhotos(mB, p.id, [photo.id])).rejects.toMatchObject({ code: "not_found" });
    // Own property, foreign media id: still refused.
    await expect(svc.setCover(mA, p.id, photoB.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(svc.removePhoto(mA, p.id, photoB.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(svc.updatePhotoAlt(mA, p.id, photoB.id, "x")).rejects.toMatchObject({ code: "not_found" });
    await expect(svc.reorderPhotos(mA, p.id, [photoB.id])).rejects.toMatchObject({ code: "invalid" });

    expect((await svc.getForEdit(mA, p.id)).media.map((m) => m.id)).toEqual([photo.id]);
    expect((await svc.getForEdit(mB, other.id)).media.map((m) => m.id)).toEqual([photoB.id]);
  });

  it("photo of a sibling property (same tenant) cannot be moved or deleted through another listing", async () => {
    const one = await svc.createDraft(mA, "Uno");
    const two = await svc.createDraft(mA, "Dos");
    const photoTwo = await svc.addPhoto(mA, two.id, await jpeg());
    await expect(svc.setCover(mA, one.id, photoTwo.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(svc.removePhoto(mA, one.id, photoTwo.id)).rejects.toMatchObject({ code: "not_found" });
    expect((await svc.getForEdit(mA, two.id)).media).toHaveLength(1);
  });

  it("review, duplicate and import lookups are tenant-scoped", async () => {
    const importId = crypto.randomUUID();
    const p = await svc.createImportedDraft(mA, { title: "Importada A", values: { city: "Quito" }, fieldConfidence: {}, reviewNotes: "• nota", sourceImportId: importId });
    await expect(svc.markReviewed(mB, p.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(svc.duplicate(mB, p.id)).rejects.toMatchObject({ code: "not_found" });
    expect(await svc.listByImport(mB, importId)).toEqual([]);
    expect((await svc.listByImport(mA, importId)).map((r) => r.id)).toEqual([p.id]);
    expect((await svc.getForEdit(mA, p.id)).property.needsReview).toBe(true);
  });

  it("an agent sees and edits only listings they created or are assigned to", async () => {
    const ownerOnly = await svc.createDraft(mA, "Del dueño, sin asignar");
    const assigned = await svc.createDraft(mA, "Asignada al agente");
    await db.update(properties).set({ agentId: agentA.agentId }).where(eq(properties.id, assigned.id));
    const own = await svc.createDraft(agentA, "Creada por el agente");

    const visible = (await svc.listForPanel(agentA)).map((r) => r.id);
    expect(visible).toContain(assigned.id);
    expect(visible).toContain(own.id);
    expect(visible).not.toContain(ownerOnly.id);

    await expect(svc.getForEdit(agentA, ownerOnly.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(svc.addPhoto(agentA, ownerOnly.id, await jpeg())).rejects.toMatchObject({ code: "forbidden" });
    await expect(svc.changeStatus(agentA, ownerOnly.id, "archived")).rejects.toMatchObject({ code: "forbidden" });
    await expect(svc.duplicate(agentA, ownerOnly.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(svc.deleteDraft(agentA, ownerOnly.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(svc.markReviewed(agentA, ownerOnly.id)).rejects.toMatchObject({ code: "forbidden" });

    await expect(svc.updateDraft(agentA, assigned.id, { city: "Quito" })).resolves.toMatchObject({ city: "Quito" });
    await expect(svc.updateDraft(agentA, own.id, { city: "Loja" })).resolves.toMatchObject({ city: "Loja" });

    // A colleague without a profile only reaches what they created themselves.
    expect((await svc.listForPanel(colleague)).map((r) => r.id)).toEqual([]);
    await expect(svc.updateDraft(colleague, own.id, { title: "mía" })).rejects.toMatchObject({ code: "forbidden" });
    const photo = await svc.addPhoto(agentA, own.id, await jpeg());
    await expect(svc.updatePhotoAlt(colleague, own.id, photo.id, "x")).rejects.toMatchObject({ code: "forbidden" });
    await expect(svc.setCover(colleague, own.id, photo.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(svc.removePhoto(colleague, own.id, photo.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(svc.reorderPhotos(colleague, own.id, [photo.id])).rejects.toMatchObject({ code: "forbidden" });
  });
});
