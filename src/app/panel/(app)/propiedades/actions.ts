"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { act, isUuid } from "@/app/panel/_server/act";
import * as properties from "@/modules/properties/service";
import { STATUSES, type PropertyStatus } from "@/modules/properties/domain";
import { notFound } from "@/lib/errors";
import type { ActionResult } from "@/lib/errors";

const id = (v: string) => {
  if (!isUuid(v)) throw notFound("Propiedad");
  return v;
};

/** Step 1 of the wizard: creates the draft with the basics and continues to photos. */
export async function createPropertyAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const result = await act("property.create", async (m) => {
    const draft = await properties.createDraft(m, typeof (input as { title?: unknown })?.title === "string" ? (input as { title: string }).title.slice(0, 140) : "");
    await properties.updateDraft(m, draft.id, input);
    return { id: draft.id };
  });
  if (result.ok) redirect(`/panel/propiedades/${result.data.id}?paso=fotos`);
  return result;
}

/** Autosave. Returns the fresh `updatedAt` so the client can show "Guardado". */
export async function saveDraftAction(propertyId: string, patch: unknown) {
  return act("property.autosave", async (m) => {
    const row = await properties.updateDraft(m, id(propertyId), patch);
    return { updatedAt: row.updatedAt.toISOString(), slug: row.slug, priceKind: row.priceKind };
  });
}

export async function changeStatusAction(propertyId: string, to: PropertyStatus) {
  const result = await act("property.status", async (m) => {
    if (!z.enum(STATUSES).safeParse(to).success) throw notFound("Estado");
    const row = await properties.changeStatus(m, id(propertyId), to);
    return { status: row.status, slug: row.slug };
  });
  if (result.ok) revalidatePath("/panel/propiedades");
  return result;
}

export async function duplicateAction(propertyId: string) {
  const result = await act("property.duplicate", async (m) => ({ id: (await properties.duplicate(m, id(propertyId))).id }));
  if (result.ok) revalidatePath("/panel/propiedades");
  return result;
}

export async function deleteDraftAction(propertyId: string) {
  const result = await act("property.delete", (m) => properties.deleteDraft(m, id(propertyId)));
  if (result.ok) revalidatePath("/panel/propiedades");
  return result;
}

export async function markReviewedAction(propertyId: string) {
  return act("property.reviewed", (m) => properties.markReviewed(m, id(propertyId)));
}

export async function reorderPhotosAction(propertyId: string, orderedIds: string[]) {
  return act("photos.reorder", (m) => properties.reorderPhotos(m, id(propertyId), z.array(z.uuid()).max(200).parse(orderedIds)));
}

export async function setCoverAction(propertyId: string, mediaId: string) {
  return act("photos.cover", (m) => properties.setCover(m, id(propertyId), id(mediaId)));
}

export async function removePhotoAction(propertyId: string, mediaId: string) {
  return act("photos.remove", (m) => properties.removePhoto(m, id(propertyId), id(mediaId)));
}

export async function updatePhotoAltAction(propertyId: string, mediaId: string, alt: string) {
  return act("photos.alt", (m) => properties.updatePhotoAlt(m, id(propertyId), id(mediaId), String(alt ?? "")));
}
