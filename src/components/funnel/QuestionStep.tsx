"use client";

import { inputClass } from "@/components/public/fields";
import { cn } from "@/components/ui/cn";
import type { PublicQuestion } from "./types";

type Props = {
  question: PublicQuestion;
  value: string | string[] | number | undefined;
  error?: string;
  onChange: (value: string | string[]) => void;
  /** Called after a pointer selection on single-choice questions, to move on with one tap. */
  onPick: () => void;
};

// Selected: 2px blue edge (border + inset ring, so nothing shifts) on a faint blue wash.
const optionClass =
  "flex min-h-16 cursor-pointer items-center gap-4 rounded-sm border border-line-strong bg-white px-5 py-4 text-[1.0625rem] text-ink " +
  "transition-[border-color,background-color,box-shadow] duration-300 ease-apple hover:border-ink/70 " +
  "has-[:checked]:border-navy has-[:checked]:bg-navy/[0.05] has-[:checked]:shadow-[inset_0_0_0_1px_var(--color-navy)] " +
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-navy";

export function QuestionStep({ question: q, value, error, onChange, onPick }: Props) {
  const errorId = `${q.id}-error`;
  const helpId = q.help ? `${q.id}-help` : undefined;
  const describedBy = [helpId, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  if (q.type === "text" || q.type === "number") {
    return (
      <div>
        <label htmlFor={`q-${q.id}`} className="sr-only">
          {q.label}
        </label>
        {q.help ? (
          <p id={helpId} className="mb-2 text-sm text-ink-muted">
            {q.help}
          </p>
        ) : null}
        <input
          id={`q-${q.id}`}
          type={q.type === "number" ? "number" : "text"}
          inputMode={q.type === "number" ? "numeric" : undefined}
          maxLength={q.type === "text" ? 300 : undefined}
          value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={inputClass}
        />
        {!q.required ? <p className="mt-2 text-sm text-ink-muted">Opcional: puedes dejarlo en blanco.</p> : null}
        {error ? (
          <p id={errorId} className="mt-2 text-sm font-medium text-sold">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const multi = q.type === "multi";
  const selected = new Set(Array.isArray(value) ? value : typeof value === "string" ? [value] : []);

  return (
    <div role={multi ? "group" : "radiogroup"} aria-labelledby={`${q.id}-title`} aria-describedby={describedBy} aria-required={q.required}>
      {q.help ? (
        <p id={helpId} className="mb-3 text-sm text-ink-muted">
          {q.help}
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {q.options?.map((o) => (
          <li key={o.value}>
            <label className={optionClass}>
              <input
                type={multi ? "checkbox" : "radio"}
                name={`q-${q.id}`}
                value={o.value}
                checked={selected.has(o.value)}
                onChange={(e) => {
                  if (!multi) return onChange(o.value);
                  const next = new Set(selected);
                  if (e.target.checked) next.add(o.value);
                  else next.delete(o.value);
                  onChange([...next]);
                }}
                onClick={(e) => {
                  // detail > 0 means a real pointer click; arrow-key selection must not advance.
                  if (!multi && e.detail > 0) onPick();
                }}
                className={cn("size-5 shrink-0 accent-navy", multi && "rounded-xs")}
              />
              <span>{o.label}</span>
            </label>
          </li>
        ))}
      </ul>
      {error ? (
        <p id={errorId} className="mt-3 text-sm font-medium text-sold">
          {error}
        </p>
      ) : null}
    </div>
  );
}
