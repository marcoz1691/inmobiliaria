"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createPropertyAction } from "@/app/panel/(app)/propiedades/actions";
import { BasicsFields } from "./FormSteps";
import { fieldToPatch, STEPS, type FieldName, type FormState } from "./model";

const EMPTY: FormState = {
  title: "",
  propertyType: "",
  operation: "",
  price: "",
  priceNote: "",
  city: "",
  sector: "",
  province: "",
  description: "",
  builtArea: "",
  landArea: "",
  bedrooms: "",
  bathrooms: "",
  parking: "",
  amenities: [],
  highlights: [],
  address: "",
  lat: "",
  lng: "",
  locationPrivacy: "approximate",
};

const BASICS: FieldName[] = ["title", "propertyType", "operation", "price", "city", "sector", "province"];

/** Step 1 before the draft exists: nothing is created until the agent continues. */
export function NewPropertyForm() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends FieldName>(field: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
    const r = fieldToPatch(field, value);
    setErrors((e) => {
      const next = { ...e };
      if (r.ok) delete next[field];
      else next[field] = r.error;
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {};
    const errs: Partial<Record<FieldName, string>> = {};
    for (const f of BASICS) {
      const r = fieldToPatch(f, form[f]);
      if (r.ok) payload[f] = r.value;
      else errs[f] = r.error;
    }
    if (!form.title.trim()) errs.title = "Escribe un título para identificarla.";
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) {
      document.getElementById(`f-${first}`)?.focus();
      return;
    }
    if (payload.operation) payload.priceKind = payload.operation === "rent" ? "rent" : "sale";
    setPending(true);
    setError(null);
    try {
      const r = await createPropertyAction(payload);
      // On success the action redirects; we only get here on failure.
      if (r && !r.ok) setError(r.error);
    } catch (err) {
      if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw err;
      setError("Sin conexión. Revisa tu señal e inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6">
      <p className="text-sm text-ink-muted">
        Paso 1 de {STEPS.length}: {STEPS[0].label}. Después agregas fotos y detalles; todo se guarda solo.
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-sand" aria-hidden="true">
        <div className="h-full w-1/4 bg-navy" />
      </div>
      <div className="mt-6">
        <BasicsFields form={form} set={set} errors={errors} verify={() => false} />
      </div>
      {error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-sold">
          {error}
        </p>
      ) : null}
      <div className="mt-8 flex justify-end border-t border-line pt-6">
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Creando borrador…" : "Siguiente: Fotos"}
        </Button>
      </div>
    </form>
  );
}
