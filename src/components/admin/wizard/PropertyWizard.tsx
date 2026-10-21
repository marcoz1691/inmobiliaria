"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { publishProblems, type PropertyStatus } from "@/modules/properties/domain";
import { BackLink } from "../PageHeader";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { ease, press } from "../ui/motion";
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
  const [reviewMsg, setReviewMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [reviewPending, setReviewPending] = useState(false);
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
    setReviewPending(true);
    setReviewMsg(null);
    try {
      await flush();
      const r = await markReviewedAction(property.id);
      if (r.ok) {
        setNeedsReview(false);
        setReviewMsg({ text: "Revisión completa. Ya puedes publicar cuando todo esté listo." });
      } else setReviewMsg({ text: r.error, error: true });
    } catch {
      setReviewMsg({ text: "Sin conexión. Revisa tu señal e inténtalo de nuevo.", error: true });
    } finally {
      setReviewPending(false);
    }
  }

  const fieldsProps = { form, set, errors, verify, appraisal: priceKind === "appraisal" };
  const current = STEPS[stepIndex]!;
  const isLive = ["published", "reserved"].includes(status);
  const prev = stepIndex > 0 ? STEPS[stepIndex - 1]! : null;
  const next = stepIndex < STEPS.length - 1 ? STEPS[stepIndex + 1]! : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <BackLink href="/panel/propiedades" label="Propiedades" />
        <SaveStatus state={autosave.state} error={autosave.error} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusTag status={status} />
        {isLive ? <span className="text-sm text-ink-muted">Los cambios se ven en el sitio apenas se guardan.</span> : null}
      </div>
      <p className="mt-2 truncate text-[1.0625rem] font-medium text-ink-muted">{form.title || "Propiedad sin título"}</p>

      <nav aria-label="Pasos" className="mt-5">
        <p className="sr-only">
          Paso {stepIndex + 1} de {STEPS.length}
        </p>
        <ol className="grid grid-cols-4 gap-1 rounded-[0.75rem] bg-ink/[0.06] p-[3px]">
          {STEPS.map((s, i) => {
            const on = s.key === step;
            const done = i < stepIndex;
            return (
              <li key={s.key} className="min-w-0">
                <button
                  type="button"
                  onClick={() => goto(s.key)}
                  aria-current={on ? "step" : undefined}
                  aria-label={`Paso ${i + 1}: ${s.label}`}
                  className={cn(
                    "flex min-h-11 w-full min-w-0 items-center justify-center gap-1.5 rounded-[0.5625rem] px-1.5 text-[0.8125rem] font-medium sm:text-sm",
                    "transition-[background-color,box-shadow,color] duration-300 focus-visible:-outline-offset-1",
                    ease,
                    on ? "bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)]" : "text-ink-muted hover:text-ink",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full text-[0.6875rem] font-semibold tabular-nums max-sm:hidden",
                      on ? "bg-navy text-white" : done ? "bg-available text-white" : "bg-ink/10 text-ink-muted",
                    )}
                  >
                    {done ? <Icon name="check" className="size-3" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="truncate">{s.key === "revisar" ? <><span className="sm:hidden">Publicar</span><span className="max-sm:hidden">{s.label}</span></> : s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {needsReview ? (
        <section aria-labelledby="review-banner" className="mt-6 rounded-md bg-reserved-bg p-4 ring-1 ring-reserved/20 sm:p-5">
          <div className="flex gap-3">
            <Icon name="alert" className="mt-0.5 size-5 shrink-0 text-reserved" strokeWidth={2} />
            <div className="min-w-0">
              <h2 id="review-banner" className="text-[1.0625rem] font-semibold text-ink">
                Revisa los datos importados
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-ink">
                Este borrador se creó a partir de un PDF. Los campos marcados con «Verifica este dato» se leyeron con dudas o faltan. No se puede publicar hasta que marques la revisión como completa.
              </p>
              {property.reviewNotes ? (
                <details className="group mt-1 text-sm text-ink">
                  <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 font-medium text-reserved [&::-webkit-details-marker]:hidden">
                    Avisos de la importación
                    <Icon name="chevronDown" className={cn("size-4 transition-transform duration-300 group-open:rotate-180", ease)} strokeWidth={2.2} />
                  </summary>
                  <p className="pb-2 whitespace-pre-line text-ink-muted">{property.reviewNotes}</p>
                </details>
              ) : null}
              <Button variant="filled" className="mt-2" onClick={() => void completeReview()} pending={reviewPending}>
                {reviewPending ? "Guardando…" : "Marcar revisión completa"}
              </Button>
            </div>
          </div>
        </section>
      ) : null}
      {reviewMsg ? (
        <p role={reviewMsg.error ? "alert" : "status"} className={cn("mt-3 flex items-center gap-1.5 text-sm font-medium", reviewMsg.error ? "text-sold" : "text-available")}>
          <Icon name={reviewMsg.error ? "alert" : "checkCircle"} className="size-4 shrink-0" strokeWidth={2} />
          {reviewMsg.text}
        </p>
      ) : null}

      <section aria-labelledby="step-title" className="mt-8">
        <h1 id="step-title" ref={headingRef} tabIndex={-1} className="font-display text-display-md font-bold text-ink focus:outline-none">
          {current.label}
        </h1>
        <div className="mt-5">
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

      {prev || next ? (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-30 -mx-4 mt-10 px-4 pb-2 md:bottom-4 md:mx-0 md:px-0">
          <div className="glass flex items-center justify-between gap-2 rounded-full p-1.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)] ring-1 ring-ink/[0.06]">
            {prev ? (
              <Button variant="plain" icon="chevronLeft" onClick={() => goto(prev.key)} className="pl-3">
                {prev.label}
              </Button>
            ) : (
              <span />
            )}
            {next ? (
              <Button onClick={() => goto(next.key)} className={cn("ml-auto", press)}>
                Siguiente: {next.label}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
