"use client";
import { useState } from "react";
import { PropertyCard } from "@/components/public/PropertyCard";
import { PropertyFacts } from "@/components/public/PropertyFacts";
import type { PublicProperty } from "@/components/public/types";
import { TYPE_LABEL, type PropertyStatus } from "@/modules/properties/domain";
import { cn } from "@/components/ui/cn";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { card, IconTile } from "../ui/ListGroup";
import { tap } from "../ui/motion";
import { changeStatusAction } from "@/app/panel/(app)/propiedades/actions";
import { fieldToPatch, stepForProblem, STEPS, type FormState, type StepKey } from "./model";
import type { Photo } from "./PhotoManager";

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#E8E8ED"/></svg>');

const n = (f: FormState, k: keyof FormState) => {
  const r = fieldToPatch(k, f[k]);
  return r.ok ? (r.value as number | null) : null;
};

type Props = {
  propertyId: string;
  form: FormState;
  photos: Photo[];
  priceKind: "sale" | "rent" | "appraisal";
  problems: string[];
  status: PropertyStatus;
  slug: string;
  flush: () => Promise<boolean>;
  goto: (s: StepKey) => void;
  onStatus: (s: PropertyStatus) => void;
};

/** Preview with the public components, the list of blocking problems and the publish action. */
export function ReviewStep({ propertyId, form, photos, priceKind, problems, status, slug, flush, goto, onStatus }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justPublished, setJustPublished] = useState(false);
  const cover = photos[0];
  const preview: PublicProperty = {
    slug,
    title: form.title || "Propiedad sin título",
    status: status === "reserved" ? "reserved" : status === "sold" ? "sold" : status === "rented" ? "rented" : "available",
    operation: form.operation || "sale",
    propertyType: form.propertyType ? TYPE_LABEL[form.propertyType] : "Propiedad",
    price: n(form, "price"),
    priceKind,
    currency: "USD",
    city: form.city || "Ciudad pendiente",
    sector: form.sector || null,
    landArea: n(form, "landArea"),
    builtArea: n(form, "builtArea"),
    bedrooms: n(form, "bedrooms"),
    bathrooms: n(form, "bathrooms"),
    parking: n(form, "parking"),
    amenities: form.amenities,
    highlights: form.highlights,
    cover: cover ? { src: cover.src, alt: cover.alt ?? "" } : { src: PLACEHOLDER, alt: "Sin foto todavía" },
    images: photos.map((p) => ({ src: p.src, alt: p.alt ?? "" })),
  };
  const canPublish = problems.length === 0 && (status === "draft" || status === "paused");
  const isPublic = ["published", "reserved", "sold", "rented"].includes(status);

  async function publish() {
    setPending(true);
    setError(null);
    const saved = await flush();
    if (!saved) {
      setPending(false);
      setError("Hay cambios sin guardar. Revisa tu conexión o los campos marcados e inténtalo de nuevo.");
      return;
    }
    const r = await changeStatusAction(propertyId, "published");
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onStatus(r.data.status);
    setJustPublished(true);
  }

  return (
    <div className="grid gap-6">
      {justPublished || isPublic ? (
        <div role="status" className={cn(card, "flex flex-col items-center px-5 py-8 text-center sm:py-10")}>
          <span className="grid size-14 place-items-center rounded-full bg-available-bg text-available">
            <Icon name="checkCircle" className="size-8" strokeWidth={1.8} />
          </span>
          <h2 className="mt-4 text-headline text-ink">{justPublished ? "¡Publicada! Ya está en tu sitio." : "Esta propiedad está en tu sitio."}</h2>
          <p className="mt-1 max-w-sm text-base text-ink-muted">Compártela o revísala como la verá un visitante.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button href={`/propiedades/${slug}`} icon="globe">
              Ver en el sitio
            </Button>
            <Button href="/panel/propiedades" variant="gray">
              Volver a propiedades
            </Button>
          </div>
        </div>
      ) : null}

      {!isPublic ? (
        <section aria-labelledby="problems-title" className={cn(card, "p-4 sm:p-6")}>
          <div className="flex items-center gap-3">
            <IconTile name={problems.length ? "tasks" : "checkCircle"} tone={problems.length ? "amber" : "green"} />
            <h2 id="problems-title" className="text-headline text-ink">
              {problems.length ? "Antes de publicar" : "Todo listo para publicar"}
            </h2>
          </div>
          {problems.length ? (
            <ul className="mt-4 overflow-hidden rounded-sm bg-sand/70">
              {problems.map((p) => {
                const step = stepForProblem(p);
                const action = cn("inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-full px-3 text-[0.9375rem] font-medium text-navy hover:bg-navy/[0.07]", tap);
                return (
                  <li
                    key={p}
                    className="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5 pr-1.5 pl-3.5 not-first:before:absolute not-first:before:inset-x-3.5 not-first:before:top-0 not-first:before:h-px not-first:before:bg-line"
                  >
                    <span className="flex min-w-0 items-start gap-2 py-1.5 text-base text-ink">
                      <Icon name="alert" className="mt-0.5 size-5 shrink-0 text-reserved" />
                      {p}
                    </span>
                    {step !== "revisar" ? (
                      <button type="button" onClick={() => goto(step)} className={action}>
                        Ir a {STEPS.find((s) => s.key === step)!.label}
                        <Icon name="chevronRight" className="size-4" strokeWidth={2.2} />
                      </button>
                    ) : (
                      <a href="#review-banner" className={action}>
                        Ver aviso de revisión
                        <Icon name="chevronRight" className="size-4" strokeWidth={2.2} />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-base text-ink-muted">Revisa la vista previa. Al publicar, aparece de inmediato en tu sitio.</p>
          )}
          {error ? (
            <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm font-medium text-sold">
              <Icon name="alert" className="size-4 shrink-0" strokeWidth={2} />
              {error}
            </p>
          ) : null}
          <Button size="lg" className="mt-5 w-full sm:w-auto" disabled={!canPublish} pending={pending} onClick={() => void publish()}>
            {pending ? "Publicando…" : "Publicar"}
          </Button>
        </section>
      ) : null}

      <section aria-labelledby="preview-title" className={cn(card, "p-4 sm:p-6")}>
        <h2 id="preview-title" className="text-eyebrow text-ink-muted">
          Vista previa
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted">Así la verá un visitante en tu sitio.</p>
        <div className="mt-4 max-w-sm">
          <PropertyCard property={preview} href="#preview-title" headingLevel={3} sizes="384px" />
        </div>
        <div className="mt-8">
          <PropertyFacts property={preview} headingLevel={3} />
        </div>
        {form.description ? <p className="mt-8 max-w-prose whitespace-pre-line text-base text-ink">{form.description}</p> : null}
      </section>
    </div>
  );
}
