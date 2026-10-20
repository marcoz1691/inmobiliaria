import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/server/session";
import { listImports } from "@/modules/imports/service";
import { PageHeader } from "@/components/admin/PageHeader";
import { PdfImporter } from "@/components/admin/PdfImporter";

export const metadata: Metadata = { title: "Importar PDF" };

const STATUS: Record<string, string> = { pending: "Procesando", parsed: "Leído, sin borradores", failed: "No se pudo leer", converted: "Borradores creados" };
const date = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });

export default async function ImportPage() {
  const m = await requireMember();
  const rows = await listImports(m);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Propiedades" title="Importar PDF" description="Convierte fichas técnicas y catálogos en borradores. Revisas y publicas tú." />
      <div className="mt-6">
        <PdfImporter />
      </div>
      <section aria-labelledby="history" className="mt-10">
        <h2 id="history" className="font-display text-2xl text-ink">
          Importaciones anteriores
        </h2>
        {rows.length ? (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/panel/importar/${r.id}`} className="group flex min-h-16 flex-col justify-center py-3">
                  <span className="truncate text-base font-medium text-ink group-hover:underline group-hover:underline-offset-4">{r.fileName}</span>
                  <span className="text-sm text-ink-muted">
                    {STATUS[r.status] ?? r.status} · {date.format(r.createdAt)}
                    {r.pageCount ? ` · ${r.pageCount} pág.` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-base text-ink-muted">Aún no has importado ningún PDF.</p>
        )}
      </section>
    </div>
  );
}
