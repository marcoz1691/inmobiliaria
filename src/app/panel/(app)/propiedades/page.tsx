import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireMember } from "@/server/session";
import { listForPanel } from "@/modules/properties/service";
import { STATUSES, TYPE_LABEL, type PropertyStatus } from "@/modules/properties/domain";
import { formatUsd } from "@/components/ui/Price";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pill, StatusTag } from "@/components/admin/StatusTag";
import { PropertyActions } from "@/components/admin/PropertyActions";
import { Button } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Icon } from "@/components/admin/ui/Icon";
import { ListItem } from "@/components/admin/ui/ListGroup";
import { SegmentedLinks } from "@/components/admin/ui/Segmented";

export const metadata: Metadata = { title: "Propiedades" };

const FILTER_LABEL: Record<"" | "active" | PropertyStatus, string> = {
  "": "Todas",
  active: "Activas",
  draft: "Borradores",
  published: "Publicadas",
  paused: "Pausadas",
  reserved: "Reservadas",
  sold: "Vendidas",
  rented: "Alquiladas",
  archived: "Archivadas",
};
const FILTER_SR: Partial<Record<string, string>> = { "": " (sin archivadas)", active: " (en el sitio o pausadas)" };
const FILTERS = (["", "active", "draft", "published", "paused", "reserved", "sold", "rented", "archived"] as const).map((value) => ({ value, label: FILTER_LABEL[value], srLabel: FILTER_SR[value] }));

export default async function PropertiesPage({ searchParams }: PageProps<"/panel/propiedades">) {
  const m = await requireMember();
  const sp = await searchParams;
  const rawStatus = typeof sp.estado === "string" ? sp.estado : "";
  const status = rawStatus === "active" || (STATUSES as readonly string[]).includes(rawStatus) ? (rawStatus as PropertyStatus | "active") : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const rows = await listForPanel(m, { status, q: q || undefined });
  const filtered = Boolean(status || q);
  const href = (estado: string) => {
    const p = new URLSearchParams();
    if (estado) p.set("estado", estado);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/panel/propiedades?${s}` : "/panel/propiedades";
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Propiedades"
        actions={
          <>
            <Button href="/panel/importar" variant="gray" icon="docImport" className="max-sm:flex-1">
              Importar PDF
            </Button>
            <Button href="/panel/propiedades/nueva" icon="plus" className="max-sm:flex-1">
              Publicar propiedad
            </Button>
          </>
        }
      />

      <div className="grid gap-3">
        <form role="search" aria-label="Buscar propiedades" className="relative">
          <label htmlFor="q" className="sr-only">
            Buscar por título o ciudad
          </label>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-[1.125rem] -translate-y-1/2 text-ink-muted" strokeWidth={2} />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Buscar por título o ciudad"
            enterKeyHint="search"
            className="block min-h-11 w-full rounded-[10px] bg-ink/[0.06] pr-3 pl-10 text-base text-ink placeholder:text-ink-muted focus:bg-white focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-navy)_18%,transparent)] focus:ring-1 focus:ring-navy focus-visible:outline-none"
          />
          {rawStatus ? <input type="hidden" name="estado" value={rawStatus} /> : null}
          <button type="submit" className="sr-only">
            Buscar
          </button>
        </form>
        <SegmentedLinks label="Filtrar por estado" value={status ?? ""} options={FILTERS.map((f) => ({ ...f, href: href(f.value) }))} />
      </div>

      <p className="mt-5 mb-2 px-1 text-[0.8125rem] font-medium text-ink-muted" aria-live="polite">
        {rows.length === 1 ? "1 propiedad" : `${rows.length} propiedades`}
        {q ? <> que coinciden con «{q}»</> : null}
        {filtered ? (
          <>
            {" · "}
            <Link href="/panel/propiedades" className="text-navy hover:underline hover:underline-offset-4">
              Quitar filtros
            </Link>
          </>
        ) : null}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          icon={filtered ? "search" : "building"}
          title={filtered ? "Ninguna propiedad coincide" : "Aún no tienes propiedades"}
          description={filtered ? "Prueba con otro estado o con menos palabras." : "Publica la primera desde tu teléfono en pocos minutos, o importa una ficha en PDF."}
          action={
            filtered ? (
              <Button href="/panel/propiedades" variant="tinted">
                Ver todas
              </Button>
            ) : (
              <Button href="/panel/propiedades/nueva" icon="plus">
                Publicar propiedad
              </Button>
            )
          }
        />
      ) : (
        <ul className="rounded-sm bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-ink/[0.04]">
          {rows.map((p) => {
            const price = p.price === null ? "Sin precio" : p.priceKind === "appraisal" ? `Avalúo ${formatUsd(p.price)}` : formatUsd(p.price);
            return (
              <ListItem key={p.id} inset="thumb" className="grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-3 p-4 sm:grid-cols-[7rem_1fr_auto] sm:items-center">
                <Link href={`/panel/propiedades/${p.id}`} tabIndex={-1} aria-hidden="true" className="group relative aspect-[4/3] overflow-hidden rounded-[10px] bg-sand">
                  {p.coverSrc ? (
                    <Image src={p.coverSrc} alt="" fill sizes="112px" className="object-cover transition-[scale] duration-500 ease-[cubic-bezier(0.28,0.11,0.32,1)] group-hover:scale-[1.04]" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-ink-muted/70">
                      <Icon name="photo" className="size-6" />
                    </span>
                  )}
                </Link>
                <div className="min-w-0">
                  <h2 className="truncate text-[1.0625rem] leading-snug font-semibold tracking-[-0.01em] text-ink">
                    <Link href={`/panel/propiedades/${p.id}`} className="hover:text-navy">
                      {p.title || "Propiedad sin título"}
                    </Link>
                  </h2>
                  <p className="mt-0.5 truncate text-sm text-ink-muted">
                    {[p.propertyType ? TYPE_LABEL[p.propertyType] : null, p.city].filter(Boolean).join(" · ") || "Faltan tipo y ciudad"}
                  </p>
                  <p className="mt-1 text-sm text-ink">
                    <span className="font-semibold tabular-nums">
                      {price}
                      {p.priceKind === "rent" && p.price !== null ? "/mes" : ""}
                    </span>
                    <span className="text-ink-muted"> · {p.photoCount === 1 ? "1 foto" : `${p.photoCount} fotos`}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusTag status={p.status} />
                    {p.needsReview ? <Pill tone="amber">Revisión pendiente</Pill> : null}
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <PropertyActions id={p.id} title={p.title} status={p.status} slug={p.slug} />
                </div>
              </ListItem>
            );
          })}
        </ul>
      )}
    </div>
  );
}
