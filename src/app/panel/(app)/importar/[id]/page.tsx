import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/server/session";
import { getImport } from "@/modules/imports/service";
import { AppError } from "@/lib/errors";
import { formatUsd } from "@/components/ui/Price";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusTag } from "@/components/admin/StatusTag";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Revisión de importación" };

export default async function ImportReviewPage({ params }: PageProps<"/panel/importar/[id]">) {
  const m = await requireMember();
  const { id } = await params;
  let data;
  try {
    data = await getImport(m, id);
  } catch (err) {
    if (err instanceof AppError) notFound();
    throw err;
  }
  const { import: imp, listings, drafts, needsOcr } = data;
  const byId = new Map(drafts.map((d) => [d.id, d]));
  const warnings = !needsOcr && imp.error ? imp.error.split("\n").filter(Boolean) : [];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/panel/importar" className="inline-flex min-h-11 items-center text-sm text-ink underline-offset-4 hover:underline">
        <span aria-hidden="true">←&nbsp;</span>Importar PDF
      </Link>
      <PageHeader
        eyebrow="Revisión de importación"
        title={imp.fileName}
        description={imp.pageCount ? `${imp.pageCount} páginas` : undefined}
        actions={
          imp.storageKey ? (
            <Button href={`/api/panel/imports/${imp.id}/pdf`} variant="secondary" target="_blank" rel="noopener">
              Abrir PDF original<span className="sr-only"> (se abre en una pestaña nueva)</span>
            </Button>
          ) : null
        }
      />

      {needsOcr ? (
        <EmptyState className="mt-6" headingLevel={2} tone="error" title="PDF escaneado" description={imp.error} />
      ) : imp.status === "failed" ? (
        <EmptyState className="mt-6" headingLevel={2} tone="error" title="No pudimos leer este PDF" description={imp.error ?? "Puede estar dañado o protegido."} />
      ) : null}

      {warnings.length ? (
        <section aria-labelledby="warnings" className="mt-6 border-t-2 border-reserved pt-4">
          <h2 id="warnings" className="font-display text-xl text-ink">
            Avisos del documento
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {listings.length ? (
        <section aria-labelledby="listings" className="mt-8">
          <h2 id="listings" className="font-display text-2xl text-ink">
            {listings.length === 1 ? "Propiedad encontrada" : `${listings.length} propiedades encontradas`}
          </h2>
          <ol className="mt-4 space-y-6">
            {listings.map((l, i) => {
              const draft = l.outcome?.propertyId ? byId.get(l.outcome.propertyId) : undefined;
              return (
                <li key={i} className="border-t border-ink pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-xl text-ink">{draft?.title || l.title || "Sin título"}</h3>
                      <p className="text-sm text-ink-muted">
                        {[l.city, l.price !== null ? (l.priceKind === "appraisal" ? `Avalúo ${formatUsd(l.price)}` : formatUsd(l.price)) : "Sin precio", l.sourcePages.length ? `pág. ${l.sourcePages.join(", ")}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {draft ? <StatusTag status={draft.status} /> : null}
                  </div>
                  {draft ? (
                    <p className="mt-2 text-sm text-ink">
                      {draft.photoCount === 1 ? "1 foto adjunta" : `${draft.photoCount} fotos adjuntas`}
                      {draft.needsReview ? " · Revisión pendiente" : " · Revisada"}
                    </p>
                  ) : l.outcome?.skippedReason ? (
                    <p className="mt-2 text-sm font-medium text-reserved">No se creó borrador. {l.outcome.skippedReason}</p>
                  ) : l.outcome?.propertyId ? (
                    <p className="mt-2 text-sm text-ink-muted">El borrador ya no existe (se eliminó).</p>
                  ) : null}
                  {l.warnings.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
                      {l.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                  {l.outcome?.duplicates.length ? (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-ink">Posibles duplicados</p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {l.outcome.duplicates.map((d) => (
                          <li key={d.id}>
                            <Link href={`/panel/propiedades/${d.id}`} className="text-navy underline underline-offset-4">
                              {d.title || "Sin título"}
                            </Link>{" "}
                            <span className="text-ink-muted">({Math.round(d.score * 100)} %: {d.reasons.join(", ")})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {draft ? (
                    <Button href={`/panel/propiedades/${draft.id}`} className="mt-4">
                      Revisar y editar<span className="sr-only"> {draft.title}</span>
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : !needsOcr && imp.status !== "failed" ? (
        <EmptyState className="mt-6" headingLevel={2} title="No se encontraron propiedades" description="El documento no parece una ficha o un catálogo. Puedes crear la propiedad a mano." action={<Button href="/panel/propiedades/nueva">Publicar propiedad</Button>} />
      ) : null}
    </div>
  );
}
