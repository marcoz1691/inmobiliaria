import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

export const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-sm border border-line-strong bg-white px-3 text-base text-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy " +
  "aria-invalid:border-sold";

type BaseProps = { id: string; label: string; error?: string; hint?: string; optional?: boolean };

function Describe({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  return (
    <>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-sold">
          {error}
        </p>
      ) : null}
    </>
  );
}

const describedBy = (id: string, error?: string, hint?: string) =>
  [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

export function TextField({ id, label, error, hint, optional, className, ...input }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {optional ? <span className="font-normal text-ink-muted"> (opcional)</span> : null}
      </label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} className={inputClass} {...input} />
      <Describe id={id} error={error} hint={hint} />
    </div>
  );
}

export function TextArea({ id, label, error, hint, optional, className, ...input }: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {optional ? <span className="font-normal text-ink-muted"> (opcional)</span> : null}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(inputClass, "min-h-28 py-2.5")}
        {...input}
      />
      <Describe id={id} error={error} hint={hint} />
    </div>
  );
}

/** LOPDP consent: explicit, unticked by default, with the exact text that gets stored. */
export function ConsentCheckbox({ id, text, error, name = "consent", ...input }: { id: string; text: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <div className="flex gap-3">
        <input
          id={id}
          name={name}
          type="checkbox"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-6 shrink-0 accent-navy"
          {...input}
        />
        <label htmlFor={id} className="text-sm leading-relaxed text-ink-muted">
          {text}
        </label>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-sold">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Hidden from people and assistive tech; bots that fill every input reveal themselves. */
export function Honeypot({ name }: { name: string }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        No llenes este campo
        <input type="text" name={name} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
