"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { publishProblems, type PropertyStatus } from "@/modules/properties/domain";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { StatusTag } from "../StatusTag";
import { markReviewedAction, saveDraftAction } from "@/app/panel/(app)/propiedades/actions";
import { BasicsFields, DetailsFields } from "./FormSteps";
import { PhotoManager, type Photo } from "./PhotoManager";
import { ReviewStep } from "./ReviewStep";
import { SaveStatus, useAutosave } from "./useAutosave";
import { STEPS, fieldToPatch, parseStep, type FieldName, type FormState, type StepKey } from "./model";

export type WizardProperty = {
  id: string;
  slug: string;
  status: PropertyStatus;
  priceKind: "sale" | "rent" | "appraisal";
  needsReview: boolean;
  reviewNotes: string | null;
  fieldConfidence: Record<string, "high" | "low" | "missing">;
  imported: boolean;
};

type Props = { property: WizardProperty; initialForm: FormState; photos: Photo[] };

export function PropertyWizard({ property, initialForm, photos: initialPhotos }: Props) {
  const searchParams = useSearchParams();
  const step = parseStep(searchParams.get("paso"));
  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [priceKind, setPriceKind] = useState(property.priceKind);
  const [status, setStatus] = useState(property.status);
  const [slug, setSlug] = useState(property.slug);
  const [needsReview, setNeedsReview] = useState(property.needsReview);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [touched, setTouched] = useState<Set<FieldName>>(new Set());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const save = useCallback(
    async (patch: Record<string, unknown>) => {
      const r = await saveDraftAction(property.id, patch);
      if (r.ok) {
        setSlug(r.data.slug);
        setPriceKind(r.data.priceKind);
      }
      return r;
    },
    [property.id],
  );
  const autosave = useAutosave(property.id, save);
  const { queue, discard, flush } = autosave;

  // Recover edits that never reached the server (tab closed while offline).
  useEffect(() => {
    const backup = autosave.readBackup();
    if (!backup) return;
    // Arrays and strings can be restored as-is; numbers are shown as text.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage, unavailable during SSR
    setForm((f) => {
      const next = { ...f } as Record<string, unknown>;
      for (const [k, v] of Object.entries(backup)) next[k] = typeof v === "number" ? String(v) : v === null ? "" : v;
      return next as FormState;
    });
    queue(backup);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  const set = useCallback(
    <K extends FieldName>(field: K, value: FormState[K]) => {
      setForm((f) => ({ ...f, [field]: value }));
      setTouched((t) => (t.has(field) ? t : new Set(t).add(field)));
      const r = fieldToPatch(field, value);
      setErrors((e) => {
        if (r.ok ? !e[field] : e[field] === r.error) return e;
        const next = { ...e };
        if (r.ok) delete next[field];
        else next[field] = r.error;
        return next;
      });
      if (!r.ok) {
        discard(field);
        return;
      }
      const patch: Record<string, unknown> = { [field]: r.value };
      if (field === "operation" && value && priceKind !== "appraisal") patch.priceKind = value === "rent" ? "rent" : "sale";
      queue(patch);
    },
    [discard, queue, priceKind],
  );

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const goto = useCallback(
    (key: StepKey) => {
      void flush();
      const url = new URL(window.location.href);
      url.searchParams.set("paso", key);
      window.history.pushState(null, "", url);
      window.scrollTo({ top: 0 });
    },
    [flush],
  );

  // A field is flagged until the agent edits it or completes the review.
  const verify = useCallback(
    (field: FieldName) => needsReview && !touched.has(field) && (property.fieldConfidence[field] === "low" || property.fieldConfidence[field] === "missing"),
    [needsReview, touched, property.fieldConfidence],
  );

  const problems = useMemo(() => {
    const price = fieldToPatch("price", form.price);
    return publishProblems({
      title: form.title,
      operation: form.operation || null,
      propertyType: form.propertyType || null,
      price: price.ok ? (price.value as number | null) : null,
      priceKind,
      city: form.city.trim() || null,
      needsReview,
      photoCount: photos.length,
    });
  }, [form, priceKind, needsReview, photos.length]);

  async function completeReview() {
    await flush();
    const r = await markReviewedAction(property.id);
    if (r.ok) {
      setNeedsReview(false);
      setReviewMsg("Revisión completa. Ya puedes publicar cuando todo esté listo.");
    } else setReviewMsg(r.error);
  }

  const fieldsProps = { form, set, errors, verify, appraisal: priceKind === "appraisal" };
  const current = STEPS[stepIndex]!;
  const isLive = ["published", "reserved"].includes(status);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/panel/propiedades" className="inline-flex min-h-11 items-center text-sm text-ink underline-offset-4 hover:underline">
          <span aria-hidden="true">←&nbsp;</span>Propiedades
        </Link>
        <SaveStatus state={autosave.state} error={autosave.error} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusTag status={status} />
        {isLive ? <span className="text-sm text-ink-muted">Los cambios se ven en el sitio apenas se guardan.</span> : null}
      </div>
      <p className="mt-2 truncate font-display text-lg text-ink-muted">{form.title || "Propiedad sin título"}</p>

      <nav aria-label="Pasos" className="mt-4">
        <p className="text-sm text-ink-muted">
          Paso {stepIndex + 1} de {STEPS.length}
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-sand" aria-hidden="true">
          <div className="h-full bg-navy transition-[width] duration-300" style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
        </div>
        <ol className="mt-3 grid grid-cols-4 gap-1">
          {STEPS.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => goto(s.key)}
                aria-current={s.key === step ? "step" : undefined}
                className={cn(
                  "flex min-h-11 w-full flex-col items-start justify-center rounded-sm px-2 text-left text-xs leading-tight sm:text-sm",
                  s.key === step ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
                )}
              >
                <span className="sr-only">Paso {i + 1}: </span>
                {s.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {needsReview ? (
        <section aria-labelledby="review-banner" className="mt-6 border-t-2 border-reserved bg-reserved-bg/60 p-4">
          <h2 id="review-banner" className="font-display text-xl text-ink">
            Revisa los datos importados
          </h2>
          <p className="mt-1 text-sm text-ink">
            Este borrador se creó a partir de un PDF. Los campos marcados con «Verifica este dato» se leyeron con dudas o faltan. No se puede publicar hasta que marques la revisión como completa.
          </p>
          {property.reviewNotes ? (
            <details className="mt-2 text-sm text-ink">
              <summary className="min-h-11 cursor-pointer py-2 font-medium">Avisos de la importación</summary>
              <p className="whitespace-pre-line text-ink-muted">{property.reviewNotes}</p>
            </details>
          ) : null}
          <Button variant="secondary" className="mt-3" onClick={() => void completeReview()}>
            Marcar revisión completa
          </Button>
        </section>
      ) : null}
      {reviewMsg ? (
        <p role="status" className="mt-3 text-sm font-medium text-available">
          {reviewMsg}
        </p>
      ) : null}

      <section aria-labelledby="step-title" className="mt-8">
        <h1 id="step-title" ref={headingRef} tabIndex={-1} className="font-display text-display-md text-ink focus:outline-none">
          {current.label}
        </h1>
        <div className="mt-6">
          {step === "basicos" ? <BasicsFields {...fieldsProps} /> : null}
          {/* Kept mounted so uploads in progress survive a step change. */}
          <div hidden={step !== "fotos"}>
            <PhotoManager propertyId={property.id} initial={initialPhotos} onChange={setPhotos} />
          </div>
          {step === "detalles" ? <DetailsFields {...fieldsProps} /> : null}
          {step === "revisar" ? (
            <ReviewStep
              propertyId={property.id}
              form={form}
              photos={photos}
              priceKind={priceKind}
              problems={problems}
              status={status}
              slug={slug}
              flush={flush}
              goto={goto}
              onStatus={setStatus}
            />
          ) : null}
        </div>
      </section>

      <div className="mt-10 flex items-center justify-between gap-3 border-t border-line pt-6">
        {stepIndex > 0 ? (
          <Button variant="ghost" onClick={() => goto(STEPS[stepIndex - 1]!.key)}>
            <span aria-hidden="true">←</span> {STEPS[stepIndex - 1]!.label}
          </Button>
        ) : (
          <span />
        )}
        {stepIndex < STEPS.length - 1 ? (
          <Button size="lg" onClick={() => goto(STEPS[stepIndex + 1]!.key)}>
            Siguiente: {STEPS[stepIndex + 1]!.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
