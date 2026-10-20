"use client";
import { useId, useState } from "react";
import { OPERATIONS, OPERATION_LABEL, PROPERTY_TYPES, TYPE_LABEL } from "@/modules/properties/domain";
import { Field, describedBy, inputClass, selectClass } from "../fields";
import { cn } from "@/components/ui/cn";
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
    <div className="grid gap-5 sm:grid-cols-2">
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
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {OPERATIONS.map((o) => (
            <label
              key={o}
              className="flex min-h-11 cursor-pointer items-center justify-center rounded-sm border border-line-strong bg-white px-3 text-base text-ink has-checked:border-navy has-checked:bg-navy has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-navy"
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
    <div className="grid gap-8">
      <Field {...desc.field} label="Descripción" optional>
        <textarea {...desc.control} rows={7} maxLength={6000} className={cn(inputClass, "py-2 leading-relaxed")} value={form.description} onChange={(e) => set("description", e.target.value)} />
      </Field>

      <fieldset>
        <legend className="font-display text-xl text-ink">Medidas y espacios</legend>
        <p className="mt-1 text-sm text-ink-muted">Deja vacío lo que no aplique o no sepas con certeza.</p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="font-display text-xl text-ink">Ubicación</legend>
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
      <div className="mt-2 grid gap-2">
        {PRIVACY.map((p) => (
          <label
            key={p.v}
            className="flex cursor-pointer gap-3 rounded-sm border border-line-strong bg-white p-3 has-checked:border-navy has-checked:ring-1 has-checked:ring-navy"
          >
            <input type="radio" name="locationPrivacy" value={p.v} checked={value === p.v} onChange={() => onChange(p.v)} className="mt-1 size-5 shrink-0 accent-navy" aria-describedby={`priv-${p.v}`} />
            <span>
              <span className="block text-base text-ink">{p.label}</span>
              <span id={`priv-${p.v}`} className="block text-sm text-ink-muted">
                {p.help}
              </span>
            </span>
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
    <fieldset className={cn(verify && "rounded-sm bg-reserved-bg/60 p-3 ring-1 ring-reserved/30")} aria-describedby={`${id}-help`}>
      <legend className="font-display text-xl text-ink">{legend}</legend>
      <p id={`${id}-help`} className="mt-1 text-sm text-ink-muted">
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
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm text-paper hover:bg-ink/85"
              >
                {v}
                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="m6 6 8 8M14 6l-8 8" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {remaining.length ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-ink-muted uppercase">Sugerencias</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {remaining.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => add(s)}
                  aria-label={`Agregar ${s}`}
                  className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line-strong bg-white px-4 text-sm text-ink hover:border-ink"
                >
                  <span aria-hidden="true">+</span> {s}
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
          className="min-h-11 shrink-0 rounded-full border border-ink/80 px-4 text-sm font-medium text-ink hover:bg-ink hover:text-paper"
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
    <fieldset className={cn(verify && "rounded-sm bg-reserved-bg/60 p-3 ring-1 ring-reserved/30")} aria-describedby={`${id}-help`}>
      <legend className="font-display text-xl text-ink">{legend}</legend>
      <p id={`${id}-help`} className="mt-1 text-sm text-ink-muted">
        {help}
        {verify ? <span className="block font-medium text-reserved">Verifica este dato: se importó del PDF con dudas.</span> : null}
      </p>
      {values.length ? (
        <ol className="mt-3 divide-y divide-line border-y border-line">
          {values.map((v, i) => (
            <li key={v} className="flex items-center gap-2 py-1">
              <span className="flex-1 text-base text-ink">{v}</span>
              <button
                type="button"
                className="grid size-11 place-items-center rounded-full text-ink hover:bg-ink/5"
                aria-label={`Quitar «${v}»`}
                onClick={() => onChange(values.filter((_, j) => j !== i))}
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="m5 5 10 10M15 5 5 15" />
                </svg>
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
        <button type="button" onClick={add} className="min-h-11 shrink-0 rounded-full border border-ink/80 px-4 text-sm font-medium text-ink hover:bg-ink hover:text-paper">
          Agregar
        </button>
      </div>
    </fieldset>
  );
}
