import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lte, ne, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { withTenant, type Tx } from "@/server/db/tenant-tx";
import { properties, propertyMedia } from "@/server/db/schema";
import type { MemberContext } from "@/server/session";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/modules/audit/audit";
import { getStorage } from "@/modules/media/storage";
import { processImage } from "@/modules/media/process";
import { MEDIA_WIDTHS } from "@/lib/image-loader";
import {
  approximateLocation,
  canTransition,
  CATALOG_STATUSES,
  PUBLIC_STATUSES,
  propertyDraftSchema,
  publishProblems,
  ilikeContains,
  slugify,
  type CatalogFilters,
  type PropertyStatus,
  type PublishCheckInput,
} from "./domain";

export type PropertyRow = typeof properties.$inferSelect;
export type MediaRow = typeof propertyMedia.$inferSelect;

const PAGE_SIZE = 12;

/* ───────────── helpers ───────────── */

/** `media:` URL understood by the next/image loader (src/lib/image-loader.ts). */
export function mediaSrc(m: Pick<MediaRow, "storageKey">): string {
  return `media:${getStorage().url(m.storageKey)}`;
}

async function uniqueSlug(tx: Tx, tenantId: string, base: string, excludeId?: string): Promise<string> {
  const root = slugify(base);
  const taken = await tx
    .select({ slug: properties.slug })
    .from(properties)
    .where(and(eq(properties.tenantId, tenantId), ilike(properties.slug, `${root}%`), excludeId ? ne(properties.id, excludeId) : undefined));
  const set = new Set(taken.map((t) => t.slug));
  if (!set.has(root)) return root;
  for (let i = 2; ; i++) if (!set.has(`${root}-${i}`)) return `${root}-${i}`;
}

/** Loads a property of the member's tenant and enforces per-agent ownership for the `agent` role. */
async function loadEditable(tx: Tx, m: MemberContext, id: string): Promise<PropertyRow> {
  const [row] = await tx
    .select()
    .from(properties)
    .where(and(eq(properties.tenantId, m.tenantId), eq(properties.id, id)))
    .limit(1);
  if (!row) throw notFound("Propiedad");
  if (m.role === "agent" && row.createdBy !== m.userId && (!m.agentId || row.agentId !== m.agentId)) throw forbidden();
  return row;
}

async function mediaFor(tx: Tx, tenantId: string, propertyId: string): Promise<MediaRow[]> {
  return tx
    .select()
    .from(propertyMedia)
    .where(and(eq(propertyMedia.tenantId, tenantId), eq(propertyMedia.propertyId, propertyId)))
    .orderBy(desc(propertyMedia.isCover), asc(propertyMedia.position));
}

const run = async <T>(tenantId: string, fn: (tx: Tx) => Promise<T>) => withTenant(await getDb(), tenantId, fn);

const LIVE_STATUSES = new Set<PropertyStatus>(["published", "reserved"]);

function publishCheck(p: PropertyRow, photoCount: number): PublishCheckInput {
  return {
    title: p.title,
    operation: p.operation,
    propertyType: p.propertyType,
    city: p.city,
    price: p.price,
    priceKind: p.priceKind,
    needsReview: p.needsReview,
    photoCount,
  };
}

/** Published/reserved listings must stay complete; reject instead of silently dropping required data. */
function assertLiveStillPublishable(current: PropertyRow, next: PublishCheckInput) {
  if (!LIVE_STATUSES.has(current.status)) return;
  const problems = publishProblems(next);
  if (problems.length) {
    throw new AppError("invalid", "No se guardó el cambio: la propiedad publicada o reservada quedaría incompleta.", {
      problems,
    });
  }
}

function containsIlike(column: SQLWrapper, q: string) {
  return sql`${column} ilike ${ilikeContains(q)} escape '\\'`;
}

/* ───────────── panel ───────────── */

export async function createDraft(m: MemberContext, title = ""): Promise<PropertyRow> {
  return run(m.tenantId, async (tx) => {
    const slug = await uniqueSlug(tx, m.tenantId, title || `borrador-${Date.now().toString(36)}`);
    const [row] = await tx
      .insert(properties)
      .values({ tenantId: m.tenantId, slug, title, agentId: m.agentId, createdBy: m.userId })
      .returning();
    await audit(tx, { tenantId: m.tenantId, actorUserId: m.userId, action: "property.create", entityType: "property", entityId: row!.id });
    return row!;
  });
}

/** Autosave. Validates and persists only the provided fields. */
export async function updateDraft(m: MemberContext, id: string, input: unknown): Promise<PropertyRow> {
  const parsed = propertyDraftSchema.safeParse(input);
  if (!parsed.success) throw new AppError("invalid", "Revisa los datos ingresados", { issues: parsed.error.flatten().fieldErrors });
  const patch = parsed.data;
  return run(m.tenantId, async (tx) => {
    const current = await loadEditable(tx, m, id);
    // An appraisal only comes from a PDF import; the panel can confirm a real price, never set one.
    if (patch.priceKind === "appraisal" && current.priceKind !== "appraisal") {
      throw new AppError("invalid", "El avalúo no se puede usar como precio. Ingresa el precio de venta o alquiler.");
    }
    const values: Partial<typeof properties.$inferInsert> = { ...patch };
    // Keep the URL stable once published; drafts follow the title.
    if (patch.title !== undefined && current.status === "draft" && patch.title.trim()) {
      values.slug = await uniqueSlug(tx, m.tenantId, patch.title, id);
    }
    if (patch.price !== undefined && current.priceKind === "appraisal" && patch.priceKind === undefined) {
      // Editing an imported appraisal price means the agent is setting the real asking price.
      values.priceKind = current.operation === "rent" ? "rent" : "sale";
    }
    const next = { ...current, ...values };
    assertLiveStillPublishable(current, publishCheck(next, (await mediaFor(tx, m.tenantId, id)).length));
    const [row] = await tx
      .update(properties)
      .set(values)
      .where(and(eq(properties.tenantId, m.tenantId), eq(properties.id, id)))
      .returning();
    await audit(tx, {
      tenantId: m.tenantId,
      actorUserId: m.userId,
      action: "property.update",
      entityType: "property",
      entityId: id,
      diff: { fields: Object.keys(patch) },
    });
    return row!;
  });
}

export async function getForEdit(m: MemberContext, id: string) {
  return run(m.tenantId, async (tx) => {
    const property = await loadEditable(tx, m, id);
    return { property, media: await mediaFor(tx, m.tenantId, id) };
  });
}

export async function listForPanel(m: MemberContext, opts: { status?: PropertyStatus | "active"; q?: string } = {}) {
  return run(m.tenantId, async (tx) => {
    const where: (SQL | undefined)[] = [eq(properties.tenantId, m.tenantId)];
    if (opts.status === "active") where.push(inArray(properties.status, ["published", "reserved", "paused"]));
    else if (opts.status) where.push(eq(properties.status, opts.status));
    else where.push(ne(properties.status, "archived"));
    if (opts.q) where.push(or(containsIlike(properties.title, opts.q), containsIlike(properties.city, opts.q)));
    if (m.role === "agent") where.push(or(eq(properties.createdBy, m.userId), m.agentId ? eq(properties.agentId, m.agentId) : undefined));
    const rows = await tx
      .select({
        property: properties,
        // Qualified on purpose: drizzle renders ${properties.id} as a bare "id", which inside the
        // subquery would resolve to property_media.id.
        cover: sql<string | null>`(select storage_key from property_media pm where pm.property_id = "properties"."id" order by pm.is_cover desc, pm.position asc limit 1)`,
        photoCount: sql<number>`(select count(*)::int from property_media pm where pm.property_id = "properties"."id")`,
      })
      .from(properties)
      .where(and(...where))
      .orderBy(desc(properties.updatedAt))
      .limit(200);
    return rows.map((r) => ({ ...r.property, coverSrc: r.cover ? mediaSrc({ storageKey: r.cover }) : null, photoCount: r.photoCount }));
  });
}

export async function changeStatus(m: MemberContext, id: string, to: PropertyStatus): Promise<PropertyRow> {
  return run(m.tenantId, async (tx) => {
    const current = await loadEditable(tx, m, id);
    if (current.status === to) return current;
    if (!canTransition(current.status, to)) throw new AppError("invalid", "Ese cambio de estado no está permitido");
    if (to === "published") {
      const photoCount = (await mediaFor(tx, m.tenantId, id)).length;
      const problems = publishProblems({ ...current, photoCount });
      if (problems.length) throw new AppError("invalid", "Aún falta información para publicar", { problems });
    }
    const [row] = await tx
      .update(properties)
      .set({ status: to, publishedAt: to === "published" && !current.publishedAt ? new Date() : current.publishedAt })
      .where(and(eq(properties.tenantId, m.tenantId), eq(properties.id, id)))
      .returning();
    await audit(tx, {
      tenantId: m.tenantId,
      actorUserId: m.userId,
      action: "property.status",
      entityType: "property",
      entityId: id,
      diff: { from: current.status, to },
    });
    return row!;
  });
}

export async function markReviewed(m: MemberContext, id: string): Promise<void> {
  await run(m.tenantId, async (tx) => {
    await loadEditable(tx, m, id);
    await tx.update(properties).set({ needsReview: false }).where(and(eq(properties.tenantId, m.tenantId), eq(properties.id, id)));
    await audit(tx, { tenantId: m.tenantId, actorUserId: m.userId, action: "property.reviewed", entityType: "property", entityId: id });
  });
}

/** Copies a property as a new draft, sharing its photos (storage objects are reference-counted on delete). */
export async function duplicate(m: MemberContext, id: string): Promise<PropertyRow> {
  return run(m.tenantId, async (tx) => {
    const src = await loadEditable(tx, m, id);
    const { id: _id, slug: _slug, status: _s, publishedAt: _p, createdAt: _c, updatedAt: _u, ...rest } = src;
    const title = `${src.title} (copia)`.slice(0, 140);
    const [copy] = await tx
      .insert(properties)
      .values({ ...rest, title, slug: await uniqueSlug(tx, m.tenantId, title), status: "draft", createdBy: m.userId, featured: false })
      .returning();
    const media = await mediaFor(tx, m.tenantId, id);
    if (media.length) {
      await tx.insert(propertyMedia).values(media.map(({ id: _mid, createdAt: _mc, ...mm }) => ({ ...mm, propertyId: copy!.id })));
    }
    await audit(tx, { tenantId: m.tenantId, actorUserId: m.userId, action: "property.duplicate", entityType: "property", entityId: copy!.id, diff: { from: id } });
    return copy!;
  });
}

/** Permanent delete is only allowed for drafts; published listings are archived instead. */
export async function deleteDraft(m: MemberContext, id: string): Promise<void> {
  const keys = await run(m.tenantId, async (tx) => {
    const current = await loadEditable(tx, m, id);
    if (current.status !== "draft") throw new AppError("invalid", "Solo se pueden eliminar borradores. Archiva las propiedades publicadas.");
    const media = await mediaFor(tx, m.tenantId, id);
    await tx.delete(properties).where(and(eq(properties.tenantId, m.tenantId), eq(properties.id, id)));
    await audit(tx, { tenantId: m.tenantId, actorUserId: m.userId, action: "property.delete", entityType: "property", entityId: id });
    return orphanKeys(tx, m.tenantId, media.map((x) => x.storageKey));
  });
  await getStorage().remove(keys).catch(() => undefined);
}

async function orphanKeys(tx: Tx, tenantId: string, baseKeys: string[]): Promise<string[]> {
  if (!baseKeys.length) return [];
  const stillUsed = await tx
    .select({ k: propertyMedia.storageKey })
    .from(propertyMedia)
    .where(and(eq(propertyMedia.tenantId, tenantId), inArray(propertyMedia.storageKey, baseKeys)));
  const used = new Set(stillUsed.map((r) => r.k));
  return baseKeys.filter((k) => !used.has(k)).flatMap((k) => MEDIA_WIDTHS.map((w) => `${k}-${w}.webp`));
}

/* ───────────── media ───────────── */

export async function addPhoto(m: MemberContext, propertyId: string, input: Buffer, alt?: string): Promise<MediaRow> {
  await run(m.tenantId, (tx) => loadEditable(tx, m, propertyId));
  const processed = await processImage(input);
  const baseKey = `tenants/${m.tenantId}/properties/${propertyId}/${crypto.randomUUID()}`;
  const storage = getStorage();
  await Promise.all(processed.variants.map((v, i) => storage.put(`${baseKey}-${MEDIA_WIDTHS[i]}.webp`, v.body, "image/webp")));
  return run(m.tenantId, async (tx) => {
    const existing = await mediaFor(tx, m.tenantId, propertyId);
    const [row] = await tx
      .insert(propertyMedia)
      .values({
        tenantId: m.tenantId,
        propertyId,
        storageKey: baseKey,
        width: processed.width,
        height: processed.height,
        bytes: processed.variants.reduce((s, v) => s + v.body.byteLength, 0),
        blurDataUrl: processed.blurDataUrl,
        variants: processed.variants.map((v, i) => ({ width: v.width, height: v.height, key: `${baseKey}-${MEDIA_WIDTHS[i]}.webp`, format: "webp" as const })),
        alt: alt?.slice(0, 200) ?? null,
        position: existing.length ? Math.max(...existing.map((e) => e.position)) + 1 : 0,
        isCover: existing.length === 0,
      })
      .returning();
    return row!;
  });
}

export async function reorderPhotos(m: MemberContext, propertyId: string, orderedIds: string[]): Promise<void> {
  await run(m.tenantId, async (tx) => {
    await loadEditable(tx, m, propertyId);
    const media = await mediaFor(tx, m.tenantId, propertyId);
    const known = new Set(media.map((x) => x.id));
    if (orderedIds.length !== media.length || !orderedIds.every((i) => known.has(i))) {
      throw new AppError("invalid", "El orden enviado no coincide con las fotos actuales");
    }
    for (const [position, id] of orderedIds.entries()) {
      await tx
        .update(propertyMedia)
        .set({ position })
        .where(and(eq(propertyMedia.tenantId, m.tenantId), eq(propertyMedia.id, id)));
    }
  });
}

export async function setCover(m: MemberContext, propertyId: string, mediaId: string): Promise<void> {
  await run(m.tenantId, async (tx) => {
    await loadEditable(tx, m, propertyId);
    const scope = and(eq(propertyMedia.tenantId, m.tenantId), eq(propertyMedia.propertyId, propertyId));
    const [target] = await tx.select({ id: propertyMedia.id }).from(propertyMedia).where(and(scope, eq(propertyMedia.id, mediaId)));
    if (!target) throw notFound("Foto");
    await tx.update(propertyMedia).set({ isCover: false }).where(scope);
    await tx.update(propertyMedia).set({ isCover: true }).where(and(scope, eq(propertyMedia.id, mediaId)));
  });
}

export async function removePhoto(m: MemberContext, propertyId: string, mediaId: string): Promise<void> {
  const keys = await run(m.tenantId, async (tx) => {
    const current = await loadEditable(tx, m, propertyId);
    const existing = await mediaFor(tx, m.tenantId, propertyId);
    if (!existing.some((x) => x.id === mediaId)) throw notFound("Foto");
    assertLiveStillPublishable(current, publishCheck(current, existing.length - 1));
    const scope = and(eq(propertyMedia.tenantId, m.tenantId), eq(propertyMedia.propertyId, propertyId));
    const [removed] = await tx.delete(propertyMedia).where(and(scope, eq(propertyMedia.id, mediaId))).returning();
    if (!removed) throw notFound("Foto");
    if (removed.isCover) {
      const [next] = await tx.select({ id: propertyMedia.id }).from(propertyMedia).where(scope).orderBy(asc(propertyMedia.position)).limit(1);
      if (next) await tx.update(propertyMedia).set({ isCover: true }).where(eq(propertyMedia.id, next.id));
    }
    return orphanKeys(tx, m.tenantId, [removed.storageKey]);
  });
  await getStorage().remove(keys).catch(() => undefined);
}

/* ───────────── public site ───────────── */

export type PublicImage = { src: string; alt: string; width: number; height: number; blurDataUrl: string | null };

export type PublicListing = Omit<PropertyRow, "address" | "lat" | "lng" | "fieldConfidence" | "reviewNotes" | "createdBy" | "sourceImportId" | "needsReview"> & {
  address: string | null;
  map: { lat: number; lng: number; radiusMeters: number | null } | null;
  cover: PublicImage | null;
  images: PublicImage[];
};

function toPublicImage(m: MediaRow, title: string, i: number): PublicImage {
  return { src: mediaSrc(m), alt: m.alt || `${title} — foto ${i + 1}`, width: m.width, height: m.height, blurDataUrl: m.blurDataUrl };
}

/** Strips private fields and applies the location privacy setting. */
export function toPublic(p: PropertyRow, media: MediaRow[]): PublicListing {
  const { address, lat, lng, fieldConfidence: _f, reviewNotes: _r, createdBy: _c, sourceImportId: _s, needsReview: _n, ...rest } = p;
  let map: PublicListing["map"] = null;
  if (lat !== null && lng !== null && p.locationPrivacy !== "hidden") {
    map = p.locationPrivacy === "exact" ? { lat, lng, radiusMeters: null } : approximateLocation(lat, lng);
  }
  const images = media.map((mm, i) => toPublicImage(mm, p.title, i));
  const price = p.priceKind === "appraisal" ? null : p.price;
  return { ...rest, price, address: p.locationPrivacy === "exact" ? address : null, map, cover: images[0] ?? null, images };
}

function catalogWhere(tenantId: string, f: CatalogFilters): SQL {
  const where: (SQL | undefined)[] = [eq(properties.tenantId, tenantId), inArray(properties.status, [...CATALOG_STATUSES])];
  if (f.operation) where.push(eq(properties.operation, f.operation));
  if (f.type) where.push(eq(properties.propertyType, f.type));
  if (f.q) {
    where.push(
      or(
        containsIlike(properties.title, f.q),
        containsIlike(properties.city, f.q),
        containsIlike(properties.sector, f.q),
        containsIlike(properties.province, f.q),
      ),
    );
  }
  if (f.minPrice !== undefined) where.push(gte(properties.price, f.minPrice));
  if (f.maxPrice !== undefined) where.push(lte(properties.price, f.maxPrice));
  if (f.bedrooms !== undefined) where.push(gte(properties.bedrooms, f.bedrooms));
  if (f.bathrooms !== undefined) where.push(gte(properties.bathrooms, f.bathrooms));
  if (f.minArea !== undefined) where.push(sql`greatest(coalesce(${properties.builtArea}, 0), coalesce(${properties.landArea}, 0)) >= ${f.minArea}`);
  return and(...where)!;
}

async function withMedia(tx: Tx, tenantId: string, rows: PropertyRow[]): Promise<PublicListing[]> {
  if (!rows.length) return [];
  const media = await tx
    .select()
    .from(propertyMedia)
    .where(and(eq(propertyMedia.tenantId, tenantId), inArray(propertyMedia.propertyId, rows.map((r) => r.id))))
    .orderBy(desc(propertyMedia.isCover), asc(propertyMedia.position));
  const byProperty = Map.groupBy(media, (mm) => mm.propertyId);
  return rows.map((r) => toPublic(r, byProperty.get(r.id) ?? []));
}

export async function listCatalog(tenantId: string, f: CatalogFilters) {
  return run(tenantId, async (tx) => {
    const where = catalogWhere(tenantId, f);
    const page = f.page ?? 1;
    const order =
      f.sort === "price_asc"
        ? [sql`${properties.price} asc nulls last`]
        : f.sort === "price_desc"
          ? [sql`${properties.price} desc nulls last`]
          : [desc(properties.featured), desc(properties.publishedAt)];
    const [rows, [count]] = await Promise.all([
      tx.select().from(properties).where(where).orderBy(...order).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
      tx.select({ n: sql<number>`count(*)::int` }).from(properties).where(where),
    ]);
    return { items: await withMedia(tx, tenantId, rows), total: count?.n ?? 0, page, pageSize: PAGE_SIZE };
  });
}

export async function listFeatured(tenantId: string, limit = 6): Promise<PublicListing[]> {
  return run(tenantId, async (tx) => {
    const rows = await tx
      .select()
      .from(properties)
      .where(and(eq(properties.tenantId, tenantId), inArray(properties.status, [...CATALOG_STATUSES])))
      .orderBy(desc(properties.featured), desc(properties.publishedAt))
      .limit(limit);
    return withMedia(tx, tenantId, rows);
  });
}

export type PublicLookup = { kind: "ok"; listing: PublicListing } | { kind: "gone" } | { kind: "missing" };

export async function getPublicProperty(tenantId: string, slug: string): Promise<PublicLookup> {
  return run(tenantId, async (tx) => {
    const [row] = await tx
      .select()
      .from(properties)
      .where(and(eq(properties.tenantId, tenantId), eq(properties.slug, slug)))
      .limit(1);
    if (!row) return { kind: "missing" };
    if (row.status === "archived") return { kind: "gone" };
    if (!(PUBLIC_STATUSES as readonly string[]).includes(row.status)) return { kind: "missing" };
    const [listing] = await withMedia(tx, tenantId, [row]);
    return { kind: "ok", listing: listing! };
  });
}

export async function listRelated(tenantId: string, p: PublicListing, limit = 3): Promise<PublicListing[]> {
  return run(tenantId, async (tx) => {
    const rows = await tx
      .select()
      .from(properties)
      .where(and(eq(properties.tenantId, tenantId), eq(properties.status, "published"), ne(properties.id, p.id)))
      .orderBy(
        sql`(case when ${properties.propertyType} = ${p.propertyType} then 2 else 0 end) + (case when ${properties.city} = ${p.city} then 1 else 0 end) desc`,
        desc(properties.publishedAt),
      )
      .limit(limit);
    return withMedia(tx, tenantId, rows);
  });
}

export async function listPublicSlugs(tenantId: string) {
  return run(tenantId, (tx) =>
    tx
      .select({ slug: properties.slug, updatedAt: properties.updatedAt })
      .from(properties)
      .where(and(eq(properties.tenantId, tenantId), inArray(properties.status, [...PUBLIC_STATUSES]))),
  );
}

/* ───────────── panel: additions (round 2) ───────────── */

/** Updates the alt text of one photo (empty → null, the public site then falls back to a generic alt). */
export async function updatePhotoAlt(m: MemberContext, propertyId: string, mediaId: string, alt: string): Promise<void> {
  const value = alt.trim().slice(0, 200) || null;
  await run(m.tenantId, async (tx) => {
    await loadEditable(tx, m, propertyId);
    const [row] = await tx
      .update(propertyMedia)
      .set({ alt: value })
      .where(and(eq(propertyMedia.tenantId, m.tenantId), eq(propertyMedia.propertyId, propertyId), eq(propertyMedia.id, mediaId)))
      .returning({ id: propertyMedia.id });
    if (!row) throw notFound("Foto");
  });
}

export type ImportedDraftInput = {
  title: string;
  values: Omit<Partial<typeof properties.$inferInsert>, "id" | "tenantId" | "slug" | "status" | "createdBy" | "agentId" | "publishedAt">;
  fieldConfidence: Record<string, "high" | "low" | "missing">;
  reviewNotes: string | null;
  sourceImportId: string;
};

/**
 * Draft created from a PDF import. Always `needsReview: true`, so `publishProblems` blocks
 * publishing until the agent confirms the data (and an appraisal price stays unpublishable).
 */
export async function createImportedDraft(m: MemberContext, input: ImportedDraftInput): Promise<PropertyRow> {
  return run(m.tenantId, async (tx) => {
    const title = input.title.trim().slice(0, 140);
    const slug = await uniqueSlug(tx, m.tenantId, title || `borrador-${Date.now().toString(36)}`);
    const [row] = await tx
      .insert(properties)
      .values({
        ...input.values,
        tenantId: m.tenantId,
        slug,
        title,
        status: "draft",
        agentId: m.agentId,
        createdBy: m.userId,
        needsReview: true,
        fieldConfidence: input.fieldConfidence,
        reviewNotes: input.reviewNotes,
        sourceImportId: input.sourceImportId,
      })
      .returning();
    await audit(tx, {
      tenantId: m.tenantId,
      actorUserId: m.userId,
      action: "property.create",
      entityType: "property",
      entityId: row!.id,
      diff: { sourceImportId: input.sourceImportId },
    });
    return row!;
  });
}

/** Minimal fields of every non-archived property of the tenant, for duplicate detection on import. */
export async function listDedupeCandidates(m: MemberContext) {
  return run(m.tenantId, (tx) =>
    tx
      .select({
        id: properties.id,
        title: properties.title,
        address: properties.address,
        city: properties.city,
        landArea: properties.landArea,
        builtArea: properties.builtArea,
        price: properties.price,
        status: properties.status,
        sourceImportId: properties.sourceImportId,
      })
      .from(properties)
      .where(and(eq(properties.tenantId, m.tenantId), ne(properties.status, "archived"))),
  );
}

/** Drafts (or later states) created from one import, visible to this member. */
export async function listByImport(m: MemberContext, importId: string) {
  const rows = await listForPanel(m, {});
  const archived = await listForPanel(m, { status: "archived" });
  return [...rows, ...archived].filter((r) => r.sourceImportId === importId);
}
