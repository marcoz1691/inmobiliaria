import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/server/session";
import { getImport } from "@/modules/imports/service";
import { AppError } from "@/lib/errors";
import { cn } from "@/components/ui/cn";
import { formatUsd } from "@/components/ui/Price";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pill, StatusTag } from "@/components/admin/StatusTag";
import { Button } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Icon } from "@/components/admin/ui/Icon";
import { card } from "@/components/admin/ui/ListGroup";

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
      <PageHeader
        back={{ href: "/panel/importar", label: "Importar PDF" }}
        eyebrow="Revisión de importación"
        title={<span className="break-words">{imp.fileName}</span>}
        description={imp.pageCount ? `${imp.pageCount} páginas` : undefined}
        actions={
          imp.storageKey ? (
            <Button href={`/api/panel/imports/${imp.id}/pdf`} variant="gray" icon="external" target="_blank" rel="noopener">
              Abrir PDF original<span className="sr-only"> (se abre en una pestaña nueva)</span>
            </Button>
          ) : null
        }
      />

      {needsOcr ? (
        <EmptyState className="mb-6" headingLevel={2} tone="error" title="PDF escaneado" description={imp.error} />
      ) : imp.status === "failed" ? (
        <EmptyState className="mb-6" headingLevel={2} tone="error" title="No pudimos leer este PDF" description={imp.error ?? "Puede estar dañado o protegido."} />
      ) : null}

      {warnings.length ? (
        <section aria-labelledby="warnings" className="mb-8 rounded-md bg-reserved-bg p-4 ring-1 ring-reserved/20 sm:p-5">
          <h2 id="warnings" className="flex items-center gap-2 text-[1.0625rem] font-semibold text-ink">
            <Icon name="alert" className="size-5 shrink-0 text-reserved" strokeWidth={2} />
            Avisos del documento
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-12 text-sm text-ink">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {listings.length ? (
        <section aria-labelledby="listings">
          <h2 id="listings" className="px-1 text-[1.25rem] leading-tight font-bold tracking-[-0.02em] text-ink">
            {listings.length === 1 ? "Propiedad encontrada" : `${listings.length} propiedades encontradas`}
          </h2>
          <ol className="mt-3 grid gap-4">
            {listings.map((l, i) => {
              const draft = l.outcome?.propertyId ? byId.get(l.outcome.propertyId) : undefined;
              return (
                <li key={i} className={cn(card, "p-4 sm:p-5")}>
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-ink/[0.06] text-sm font-semibold text-ink-muted tabular-nums">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                        <h3 className="min-w-0 text-[1.0625rem] leading-snug font-semibold text-ink">{draft?.title || l.title || "Sin título"}</h3>
                        {draft ? <StatusTag status={draft.status} /> : null}
                      </div>
                      <p className="mt-0.5 text-sm text-ink-muted">
                        {[l.city, l.price !== null ? (l.priceKind === "appraisal" ? `Avalúo ${formatUsd(l.price)}` : formatUsd(l.price)) : "Sin precio", l.sourcePages.length ? `pág. ${l.sourcePages.join(", ")}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {draft ? (
                        <p className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-ink">
                          <span className="inline-flex items-center gap-1.5">
                            <Icon name="photo" className="size-4 text-ink-muted" />
                            {draft.photoCount === 1 ? "1 foto adjunta" : `${draft.photoCount} fotos adjuntas`}
                          </span>
                          {draft.needsReview ? <Pill tone="amber">Revisión pendiente</Pill> : <Pill tone="green">Revisada</Pill>}
                        </p>
                      ) : l.outcome?.skippedReason ? (
                        <p className="mt-2.5 text-sm font-medium text-reserved">No se creó borrador. {l.outcome.skippedReason}</p>
                      ) : l.outcome?.propertyId ? (
                        <p className="mt-2.5 text-sm text-ink-muted">El borrador ya no existe (se eliminó).</p>
                      ) : null}
                      {l.warnings.length ? (
                        <ul className="mt-2.5 list-disc space-y-1 pl-5 text-sm text-ink-muted">
                          {l.warnings.map((w) => (
                            <li key={w}>{w}</li>
                          ))}
                        </ul>
                      ) : null}
                      {l.outcome?.duplicates.length ? (
                        <div className="mt-3 rounded-sm bg-sand/80 p-3">
                          <p className="text-sm font-semibold text-ink">Posibles duplicados</p>
                          <ul className="mt-1 space-y-1 text-sm">
                            {l.outcome.duplicates.map((d) => (
                              <li key={d.id}>
                                <Link href={`/panel/propiedades/${d.id}`} className="font-medium text-link underline-offset-4 hover:underline">
                                  {d.title || "Sin título"}
                                </Link>{" "}
                                <span className="text-ink-muted">
                                  ({Math.round(d.score * 100)} %: {d.reasons.join(", ")})
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {draft ? (
                        <Button href={`/panel/propiedades/${draft.id}`} variant={draft.needsReview ? "filled" : "tinted"} size="sm" className="mt-4">
                          Revisar y editar<span className="sr-only"> {draft.title}</span>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : !needsOcr && imp.status !== "failed" ? (
        <EmptyState
          headingLevel={2}
          title="No se encontraron propiedades"
          description="El documento no parece una ficha o un catálogo. Puedes crear la propiedad a mano."
          action={
            <Button href="/panel/propiedades/nueva" icon="plus">
              Publicar propiedad
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
