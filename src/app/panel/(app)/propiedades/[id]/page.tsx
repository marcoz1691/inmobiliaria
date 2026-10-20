import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireMember } from "@/server/session";
import { getForEdit, mediaSrc } from "@/modules/properties/service";
import { AppError } from "@/lib/errors";
import { PropertyWizard } from "@/components/admin/wizard/PropertyWizard";
import { toFormState } from "@/components/admin/wizard/model";

export const metadata: Metadata = { title: "Editar propiedad" };

export default async function EditPropertyPage({ params }: PageProps<"/panel/propiedades/[id]">) {
  const m = await requireMember();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let data;
  try {
    data = await getForEdit(m, id);
  } catch (err) {
    if (err instanceof AppError) notFound();
    throw err;
  }
  const { property: p, media } = data;
  return (
    <PropertyWizard
      key={p.id}
      property={{
        id: p.id,
        slug: p.slug,
        status: p.status,
        priceKind: p.priceKind,
        needsReview: p.needsReview,
        reviewNotes: p.reviewNotes,
        fieldConfidence: p.fieldConfidence,
        imported: Boolean(p.sourceImportId),
      }}
      initialForm={toFormState(p)}
      photos={media.map((x) => ({ id: x.id, src: mediaSrc(x), alt: x.alt, isCover: x.isCover }))}
    />
  );
}
