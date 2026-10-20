import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/server/session";
import { NewPropertyForm } from "@/components/admin/wizard/NewPropertyForm";

export const metadata: Metadata = { title: "Publicar propiedad" };

export default async function NewPropertyPage() {
  await requireMember();
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/panel/propiedades" className="inline-flex min-h-11 items-center text-sm text-ink underline-offset-4 hover:underline">
        <span aria-hidden="true">←&nbsp;</span>Propiedades
      </Link>
      <p className="mt-2 text-eyebrow text-clay uppercase">Nueva propiedad</p>
      <h1 className="mt-1 font-display text-display-md text-ink">Publicar propiedad</h1>
      <NewPropertyForm />
    </div>
  );
}
