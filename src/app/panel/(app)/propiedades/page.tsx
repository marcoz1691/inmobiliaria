import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireMember } from "@/server/session";
import { listForPanel } from "@/modules/properties/service";
import { STATUSES, STATUS_LABEL, TYPE_LABEL, type PropertyStatus } from "@/modules/properties/domain";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatUsd } from "@/components/ui/Price";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusTag } from "@/components/admin/StatusTag";
import { PropertyActions } from "@/components/admin/PropertyActions";
import { inputClass, selectClass } from "@/components/admin/fields";

export const metadata: Metadata = { title: "Propiedades" };

const FILTERS = [{ value: "", label: "Todas (sin archivadas)" }, { value: "active", label: "En el sitio o pausadas" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))];

export default async function PropertiesPage({ searchParams }: PageProps<"/panel/propiedades">) {
  const m = await requireMember();
  const sp = await searchParams;
  const rawStatus = typeof sp.estado === "string" ? sp.estado : "";
  const status = rawStatus === "active" || (STATUSES as readonly string[]).includes(rawStatus) ? (rawStatus as PropertyStatus | "active") : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const rows = await listForPanel(m, { status, q: q || undefined });
  const filtered = Boolean(status || q);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Inventario"
        title="Propiedades"
        actions={
          <Button href="/panel/propiedades/nueva" size="lg">
            Publicar propiedad
          </Button>
        }
      />

      <form role="search" aria-label="Filtrar propiedades" className="mt-6 grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
        <div>
          <label htmlFor="q" className="block text-sm font-medium text-ink">
            Buscar por título o ciudad
          </label>
          <input id="q" name="q" type="search" defaultValue={q} className={inputClass} enterKeyHint="search" />
        </div>
        <div>
          <label htmlFor="estado" className="block text-sm font-medium text-ink">
            Estado
          </label>
          <select id="estado" name="estado" defaultValue={rawStatus} className={selectClass}>
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-muted" aria-live="polite">
        {rows.length === 1 ? "1 propiedad" : `${rows.length} propiedades`}
        {filtered ? (
          <>
            {" · "}
            <Link href="/panel/propiedades" className="underline underline-offset-4">
              Quitar filtros
            </Link>
          </>
        ) : null}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          className="mt-6"
          headingLevel={2}
          title={filtered ? "Ninguna propiedad coincide" : "Aún no tienes propiedades"}
          description={filtered ? "Prueba con otro estado o con menos palabras." : "Publica la primera desde tu teléfono en pocos minutos, o importa un PDF."}
          action={filtered ? undefined : <Button href="/panel/propiedades/nueva">Publicar propiedad</Button>}
        />
      ) : (
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {rows.map((p) => (
            <li key={p.id} className="grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-3 py-4 sm:grid-cols-[7rem_1fr_auto] sm:items-center">
              <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-sand">
                {p.coverSrc ? (
                  <Image src={p.coverSrc} alt="" fill sizes="112px" className="object-cover" />
                ) : (
                  <span className="absolute inset-0 grid place-items-center text-xs text-ink-muted">Sin foto</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusTag status={p.status} />
                  {p.needsReview ? (
                    <span className="rounded-xs bg-reserved-bg px-2 py-1 text-xs font-medium leading-none text-reserved">Revisión pendiente</span>
                  ) : null}
                </div>
                <h2 className="mt-1.5 truncate font-display text-xl leading-snug text-ink">
                  <Link href={`/panel/propiedades/${p.id}`} className="underline-offset-4 hover:underline">
                    {p.title || "Propiedad sin título"}
                  </Link>
                </h2>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {[p.propertyType ? TYPE_LABEL[p.propertyType] : null, p.city].filter(Boolean).join(" · ") || "Faltan tipo y ciudad"}
                </p>
                <p className="mt-1 text-sm text-ink">
                  <span className="font-semibold">
                    {p.price === null ? "Sin precio" : p.priceKind === "appraisal" ? `Avalúo ${formatUsd(p.price)}` : formatUsd(p.price)}
                    {p.priceKind === "rent" && p.price !== null ? "/mes" : ""}
                  </span>
                  <span className="text-ink-muted"> · {p.photoCount === 1 ? "1 foto" : `${p.photoCount} fotos`}</span>
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <PropertyActions id={p.id} title={p.title} status={p.status} slug={p.slug} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
