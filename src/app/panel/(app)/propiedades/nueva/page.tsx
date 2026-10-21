import type { Metadata } from "next";
import { requireMember } from "@/server/session";
import { PageHeader } from "@/components/admin/PageHeader";
import { NewPropertyForm } from "@/components/admin/wizard/NewPropertyForm";

export const metadata: Metadata = { title: "Publicar propiedad" };

export default async function NewPropertyPage() {
  await requireMember();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ href: "/panel/propiedades", label: "Propiedades" }} eyebrow="Nueva propiedad" title="Publicar propiedad" className="mb-4 md:mb-5" />
      <NewPropertyForm />
    </div>
  );
}
