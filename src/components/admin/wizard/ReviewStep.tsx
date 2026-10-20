"use client";
import { useState } from "react";
import { PropertyCard } from "@/components/public/PropertyCard";
import { PropertyFacts } from "@/components/public/PropertyFacts";
import type { PublicProperty } from "@/components/public/types";
import { TYPE_LABEL, type PropertyStatus } from "@/modules/properties/domain";
import { Button } from "@/components/ui/Button";
import { changeStatusAction } from "@/app/panel/(app)/propiedades/actions";
import { fieldToPatch, stepForProblem, STEPS, type FormState, type StepKey } from "./model";
import type { Photo } from "./PhotoManager";

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#EDE8DF"/></svg>');

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
    <div className="grid gap-10">
      {justPublished || isPublic ? (
        <div role="status" className="border-t-2 border-available pt-5">
          <h2 className="font-display text-2xl text-ink">{justPublished ? "¡Publicada! Ya está en tu sitio." : "Esta propiedad está en tu sitio."}</h2>
          <p className="mt-1 text-base text-ink-muted">Compártela o revísala como la verá un visitante.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button href={`/propiedades/${slug}`} variant="secondary">
              Ver en el sitio
            </Button>
            <Button href="/panel/propiedades" variant="ghost">
              Volver a propiedades
            </Button>
          </div>
        </div>
      ) : null}

      {!isPublic ? (
        <section aria-labelledby="problems-title">
          <h2 id="problems-title" className="font-display text-2xl text-ink">
            {problems.length ? "Antes de publicar" : "Todo listo para publicar"}
          </h2>
          {problems.length ? (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {problems.map((p) => {
                const step = stepForProblem(p);
                return (
                  <li key={p} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-base text-ink">{p}</span>
                    {step !== "revisar" ? (
                      <button type="button" onClick={() => goto(step)} className="min-h-11 rounded-full px-3 text-sm font-medium text-navy underline underline-offset-4 hover:bg-ink/5">
                        Ir a {STEPS.find((s) => s.key === step)!.label}
                      </button>
                    ) : (
                      <a href="#review-banner" className="min-h-11 content-center rounded-full px-3 text-sm font-medium text-navy underline underline-offset-4">
                        Ver aviso de revisión
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-base text-ink-muted">Revisa la vista previa. Al publicar, aparece de inmediato en tu sitio.</p>
          )}
          {error ? (
            <p role="alert" className="mt-3 text-sm font-medium text-sold">
              {error}
            </p>
          ) : null}
          <Button size="lg" className="mt-5 w-full sm:w-auto" disabled={!canPublish || pending} onClick={() => void publish()}>
            {pending ? "Publicando…" : "Publicar"}
          </Button>
        </section>
      ) : null}

      <section aria-labelledby="preview-title">
        <h2 id="preview-title" className="text-eyebrow text-clay uppercase">
          Vista previa
        </h2>
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
