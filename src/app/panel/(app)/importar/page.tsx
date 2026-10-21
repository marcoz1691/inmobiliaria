import type { Metadata } from "next";
import { requireMember } from "@/server/session";
import { listImports } from "@/modules/imports/service";
import { PageHeader } from "@/components/admin/PageHeader";
import { PdfImporter } from "@/components/admin/PdfImporter";
import { Pill } from "@/components/admin/StatusTag";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { IconTile, ListGroup, ListRow } from "@/components/admin/ui/ListGroup";

export const metadata: Metadata = { title: "Importar PDF" };

const STATUS: Record<string, { label: string; tone: "gray" | "green" | "amber" | "red" | "blue" }> = {
  pending: { label: "Procesando", tone: "blue" },
  parsed: { label: "Leído, sin borradores", tone: "gray" },
  failed: { label: "No se pudo leer", tone: "red" },
  converted: { label: "Borradores creados", tone: "green" },
};
const date = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });

export default async function ImportPage() {
  const m = await requireMember();
  const rows = await listImports(m);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Propiedades" title="Importar PDF" description="Convierte fichas técnicas y catálogos en borradores. Revisas y publicas tú." />
      <PdfImporter />
      <div className="mt-10">
        {rows.length ? (
          <ListGroup title="Importaciones anteriores" titleId="history">
            {rows.map((r) => {
              const st = STATUS[r.status] ?? { label: r.status, tone: "gray" as const };
              return (
                <ListRow
                  key={r.id}
                  href={`/panel/importar/${r.id}`}
                  leading={<IconTile name="docImport" tone={r.status === "failed" ? "red" : r.status === "converted" ? "green" : "gray"} />}
                  title={<span className="block truncate font-medium">{r.fileName}</span>}
                  subtitle={
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Pill tone={st.tone}>{st.label}</Pill>
                      <span>
                        {date.format(r.createdAt)}
                        {r.pageCount ? ` · ${r.pageCount} pág.` : ""}
                      </span>
                    </span>
                  }
                />
              );
            })}
          </ListGroup>
        ) : (
          <section aria-labelledby="history">
            <h2 id="history" className="mb-1 flex min-h-11 items-center px-1 text-[1.25rem] leading-tight font-bold tracking-[-0.02em] text-ink">
              Importaciones anteriores
            </h2>
            <EmptyState icon="tray" title="Aún no has importado ningún PDF" description="Cuando subas uno, aquí verás su estado y los borradores que se crearon." />
          </section>
        )}
      </div>
    </div>
  );
}
