"use client";
import { useId, useState } from "react";
import { OPERATIONS, OPERATION_LABEL, PROPERTY_TYPES, TYPE_LABEL } from "@/modules/properties/domain";
import { Field, describedBy, inputClass, selectClass } from "../fields";
import { cn } from "@/components/ui/cn";
import { Icon } from "../ui/Icon";
import { card } from "../ui/ListGroup";
import { ease, press, tap } from "../ui/motion";
import { AMENITY_SUGGESTIONS, type FieldName, type FormState } from "./model";

export type StepFieldsProps = {
  form: FormState;
  set: <K extends FieldName>(field: K, value: FormState[K]) => void;
  errors: Partial<Record<FieldName, string>>;
  verify: (field: FieldName) => boolean;
  /** Imported appraisal price that still needs the real asking price. */
  appraisal?: boolean;
};

function useFieldProps({ errors, verify }: Pick<StepFieldsProps, "errors" | "verify">) {
  return (field: FieldName, hint?: React.ReactNode) => {
    const id = `f-${field}`;
    const msg = { error: errors[field], verify: verify(field), hint };
    return {
      field: { id, ...msg },
      control: { id, name: field, "aria-invalid": errors[field] ? true : undefined, "aria-describedby": describedBy(id, msg) } as const,
    };
  };
}

export function BasicsFields(props: StepFieldsProps) {
  const { form, set, appraisal } = props;
  const fp = useFieldProps(props);
  const title = fp("title", "Corto y concreto: tipo, zona y lo que la distingue. Mínimo 8 caracteres.");
  const type = fp("propertyType");
  const op = fp("operation");
  const price = fp(
    "price",
    appraisal ? "El valor importado es un avalúo. Escribe el precio de venta o alquiler que quieres publicar." : form.operation === "rent" ? "Valor mensual en dólares." : "En dólares, sin puntos ni símbolos.",
  );
  const city = fp("city");
  const sector = fp("sector");
  const province = fp("province");
  return (
    <div className={cn(card, "grid gap-5 p-4 sm:grid-cols-2 sm:p-6")}>
      <Field {...title.field} label="Título" className="sm:col-span-2">
        <input {...title.control} className={inputClass} value={form.title} maxLength={140} autoComplete="off" onChange={(e) => set("title", e.target.value)} />
      </Field>
      <Field {...type.field} label="Tipo de propiedad">
        <select {...type.control} className={selectClass} value={form.propertyType} onChange={(e) => set("propertyType", e.target.value as FormState["propertyType"])}>
          <option value="">Elige el tipo</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className={cn("min-w-0", op.field.verify && "rounded-sm bg-reserved-bg/60 p-3 ring-1 ring-reserved/30")} aria-describedby={op.control["aria-describedby"]}>
        <legend className="text-sm font-medium text-ink">Operación</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-sm bg-ink/[0.06] p-[3px]">
          {OPERATIONS.map((o) => (
            <label
              key={o}
              className={cn("flex min-h-11 cursor-pointer items-center justify-center rounded-[0.6875rem] px-3 text-base font-medium text-ink-muted hover:text-ink has-checked:bg-white has-checked:text-ink has-checked:shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-navy", tap)}
            >
              <input type="radio" name="operation" value={o} checked={form.operation === o} onChange={() => set("operation", o)} className="sr-only" />
              {OPERATION_LABEL[o]}
            </label>
          ))}
        </div>
        {op.field.verify ? (
          <p id={`${op.field.id}-verify`} className="mt-1.5 text-sm font-medium text-reserved">
            Verifica este dato: se importó del PDF con dudas.
          </p>
        ) : null}
        {op.field.error ? (
          <p id={`${op.field.id}-error`} className="mt-1.5 text-sm font-medium text-sold">
            {op.field.error}
          </p>
        ) : null}
      </fieldset>
      <Field {...price.field} label={form.operation === "rent" ? "Precio mensual (US$)" : "Precio (US$)"}>
        <input {...price.control} className={inputClass} inputMode="decimal" autoComplete="off" value={form.price} onChange={(e) => set("price", e.target.value)} />
      </Field>
      <Field {...city.field} label="Ciudad">
        <input {...city.control} className={inputClass} value={form.city} autoComplete="address-level2" onChange={(e) => set("city", e.target.value)} />
      </Field>
      <Field {...sector.field} label="Sector o barrio" optional>
        <input {...sector.control} className={inputClass} value={form.sector} onChange={(e) => set("sector", e.target.value)} />
      </Field>
      <Field {...province.field} label="Provincia" optional>
        <input {...province.control} className={inputClass} value={form.province} autoComplete="address-level1" onChange={(e) => set("province", e.target.value)} />
      </Field>
    </div>
  );
}

export function DetailsFields(props: StepFieldsProps) {
  const { form, set } = props;
  const fp = useFieldProps(props);
  const desc = fp("description", "Cuenta cómo se vive la propiedad: distribución, luz, entorno. Sin datos que no hayas confirmado.");
  const nums = [
    { f: "builtArea", label: "Área de construcción (m²)", mode: "decimal" },
    { f: "landArea", label: "Área de terreno (m²)", mode: "decimal" },
    { f: "bedrooms", label: "Dormitorios", mode: "numeric" },
    { f: "bathrooms", label: "Baños", mode: "decimal" },
    { f: "parking", label: "Parqueaderos", mode: "numeric" },
  ] as const;
  const address = fp("address", "Solo se muestra en el sitio si eliges «Ubicación exacta».");
  const lat = fp("lat");
  const lng = fp("lng");
  return (
    <div className="grid gap-5">
      <div className={cn(card, "p-4 sm:p-6")}>
        <Field {...desc.field} label="Descripción" optional>
          <textarea {...desc.control} rows={7} maxLength={6000} className={cn(inputClass, "py-2 leading-relaxed")} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
      </div>

      <fieldset className={cn(card, "min-w-0 p-4 sm:p-6")}>
        <legend className="float-left w-full text-headline text-ink">Medidas y espacios</legend>
        <p className="clear-both pt-1 text-sm text-ink-muted">Deja vacío lo que no aplique o no sepas con certeza.</p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {nums.map(({ f, label, mode }) => {
            const x = fp(f);
            return (
              <Field key={f} {...x.field} label={label}>
                <input {...x.control} className={inputClass} inputMode={mode} autoComplete="off" value={form[f]} onChange={(e) => set(f, e.target.value)} />
              </Field>
            );
          })}
        </div>
      </fieldset>

      <ChipsEditor
        legend="Amenidades"
        help="Toca una sugerencia o escribe la tuya y presiona «Agregar»."
        values={form.amenities}
        suggestions={AMENITY_SUGGESTIONS}
        max={60}
        maxLength={60}
        verify={props.verify("amenities")}
        onChange={(v) => set("amenities", v)}
      />

      <ListEditor
        legend="Lo que la distingue"
        help="Frases cortas, una por línea. Ej.: «Vista despejada a la ciudad»."
        values={form.highlights}
        max={30}
        maxLength={160}
        verify={props.verify("highlights")}
        onChange={(v) => set("highlights", v)}
      />

      <fieldset className={cn(card, "min-w-0 p-4 sm:p-6")}>
        <legend className="float-left w-full text-headline text-ink">Ubicación</legend>
        <div className="clear-both grid gap-5 pt-4 sm:grid-cols-2">
        <Field {...address.field} label="Dirección" optional className="sm:col-span-2">
          <input {...address.control} className={inputClass} value={form.address} autoComplete="street-address" onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field {...lat.field} label="Latitud" optional>
          <input {...lat.control} className={inputClass} inputMode="decimal" placeholder="-0.1807" value={form.lat} onChange={(e) => set("lat", e.target.value)} />
        </Field>
        <Field {...lng.field} label="Longitud" optional>
          <input {...lng.control} className={inputClass} inputMode="decimal" placeholder="-78.4678" value={form.lng} onChange={(e) => set("lng", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <PrivacyChoice value={form.locationPrivacy} onChange={(v) => set("locationPrivacy", v)} />
        </div>
        </div>
      </fieldset>
    </div>
  );
}

const PRIVACY = [
  { v: "approximate", label: "Aproximada (recomendado)", help: "El mapa muestra un círculo de unos 800 m y la dirección no se publica. Protege al propietario." },
  { v: "exact", label: "Ubicación exacta", help: "Se publican la dirección y el punto exacto. Úsalo solo si el propietario lo autorizó." },
  { v: "hidden", label: "Sin mapa", help: "No se muestra mapa ni dirección; solo ciudad y sector." },
] as const;

function PrivacyChoice({ value, onChange }: { value: FormState["locationPrivacy"]; onChange: (v: FormState["locationPrivacy"]) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink">Privacidad de la ubicación en el sitio</legend>
      <div className="mt-2 overflow-hidden rounded-sm ring-1 ring-line">
        {PRIVACY.map((p) => (
          <label
            key={p.v}
            className={cn("relative flex min-h-11 cursor-pointer items-start gap-3 bg-white p-3.5 not-first:border-t not-first:border-line hover:bg-ink/[0.02] has-checked:bg-navy/[0.04] has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-navy", tap)}
          >
            <input type="radio" name="locationPrivacy" value={p.v} checked={value === p.v} onChange={() => onChange(p.v)} className="peer sr-only" aria-describedby={`priv-${p.v}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-base font-medium text-ink">{p.label}</span>
              <span id={`priv-${p.v}`} className="block text-sm text-ink-muted">
                {p.help}
              </span>
            </span>
            <Icon name="check" strokeWidth={2.6} className={cn("mt-0.5 size-5 shrink-0 text-navy opacity-0 scale-50 transition-[opacity,scale] duration-300 peer-checked:scale-100 peer-checked:opacity-100", ease)} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type ChipsProps = {
  legend: string;
  help: string;
  values: string[];
  suggestions: string[];
  max: number;
  maxLength: number;
  verify?: boolean;
  onChange: (v: string[]) => void;
};

function ChipsEditor({ legend, help, values, suggestions, max, maxLength, verify, onChange }: ChipsProps) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const has = (v: string) => values.some((x) => x.toLocaleLowerCase("es") === v.toLocaleLowerCase("es"));
  const add = (v: string) => {
    const t = v.trim().slice(0, maxLength);
    if (!t || has(t) || values.length >= max) return;
    onChange([...values, t]);
  };
  const remaining = suggestions.filter((s) => !has(s));
  return (
    <fieldset className={cn(card, "min-w-0 p-4 sm:p-6", verify && "bg-reserved-bg/50 ring-reserved/30")} aria-describedby={`${id}-help`}>
      <legend className="float-left w-full text-headline text-ink">{legend}</legend>
      <p id={`${id}-help`} className="clear-both pt-1 text-sm text-ink-muted">
        {help}
        {verify ? <span className="block font-medium text-reserved">Verifica este dato: se importó del PDF con dudas.</span> : null}
      </p>
      {values.length ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={`${legend} elegidas`}>
          {values.map((v) => (
            <li key={v}>
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                aria-label={`Quitar ${v}`}
                className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-full bg-navy pr-3 pl-4 text-[0.9375rem] font-medium text-white hover:bg-navy-hover", tap, press)}
              >
                {v}
                <Icon name="x" className="size-4 opacity-80" strokeWidth={2.2} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {remaining.length ? (
        <div className="mt-3">
          <p className="text-[0.8125rem] font-semibold text-ink-muted">Sugerencias</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {remaining.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => add(s)}
                  aria-label={`Agregar ${s}`}
                  className={cn("inline-flex min-h-11 items-center gap-1 rounded-full bg-ink/[0.06] pr-4 pl-3 text-[0.9375rem] text-ink hover:bg-ink/[0.1]", tap, press)}
                >
                  <Icon name="plus" className="size-4 text-navy" strokeWidth={2.2} /> {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <label htmlFor={`${id}-new`} className="sr-only">
          Otra {legend.toLowerCase()}
        </label>
        <input
          id={`${id}-new`}
          value={draft}
          maxLength={maxLength}
          placeholder="Escribe otra"
          className={cn(inputClass, "mt-0")}
          enterKeyHint="done"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
              setDraft("");
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            add(draft);
            setDraft("");
          }}
          className={cn("min-h-11 shrink-0 rounded-full bg-navy/10 px-4 text-[0.9375rem] font-medium text-navy hover:bg-navy/15", tap, press)}
        >
          Agregar
        </button>
      </div>
    </fieldset>
  );
}

function ListEditor({ legend, help, values, max, maxLength, verify, onChange }: Omit<ChipsProps, "suggestions">) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim().slice(0, maxLength);
    if (t && values.length < max && !values.includes(t)) onChange([...values, t]);
    setDraft("");
  };
  return (
    <fieldset className={cn(card, "min-w-0 p-4 sm:p-6", verify && "bg-reserved-bg/50 ring-reserved/30")} aria-describedby={`${id}-help`}>
      <legend className="float-left w-full text-headline text-ink">{legend}</legend>
      <p id={`${id}-help`} className="clear-both pt-1 text-sm text-ink-muted">
        {help}
        {verify ? <span className="block font-medium text-reserved">Verifica este dato: se importó del PDF con dudas.</span> : null}
      </p>
      {values.length ? (
        <ol className="mt-3 overflow-hidden rounded-sm bg-sand/60">
          {values.map((v, i) => (
            <li key={v} className="relative flex items-center gap-2 py-0.5 pl-3.5 not-first:before:absolute not-first:before:inset-x-3.5 not-first:before:top-0 not-first:before:h-px not-first:before:bg-line">
              <span className="min-w-0 flex-1 text-base text-ink">{v}</span>
              <button
                type="button"
                className={cn("grid size-11 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-ink/5 hover:text-sold", tap)}
                aria-label={`Quitar «${v}»`}
                onClick={() => onChange(values.filter((_, j) => j !== i))}
              >
                <Icon name="trash" className="size-5" />
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="mt-3 flex gap-2">
        <label htmlFor={`${id}-new`} className="sr-only">
          Nueva frase para «{legend}»
        </label>
        <input
          id={`${id}-new`}
          value={draft}
          maxLength={maxLength}
          className={cn(inputClass, "mt-0")}
          enterKeyHint="done"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" onClick={add} className={cn("min-h-11 shrink-0 rounded-full bg-navy/10 px-4 text-[0.9375rem] font-medium text-navy hover:bg-navy/15", tap, press)}>
          Agregar
        </button>
      </div>
    </fieldset>
  );
}
