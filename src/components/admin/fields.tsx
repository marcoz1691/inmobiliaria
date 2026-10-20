import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-sm border border-line-strong bg-white px-3 text-base text-ink placeholder:text-ink-muted/70 " +
  "aria-[invalid=true]:border-sold disabled:bg-sand";

export const selectClass = cn(inputClass, "pr-8");

export type FieldMessages = { error?: string | null; hint?: ReactNode; verify?: boolean };

/** Ids for the helper texts of a field, to wire `aria-describedby`. */
export function describedBy(id: string, msg: FieldMessages): string | undefined {
  const ids = [msg.verify ? `${id}-verify` : null, msg.hint ? `${id}-hint` : null, msg.error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

/** Label + control + hint/verify/error, with the helper texts linked through `aria-describedby`. */
export function Field({
  id,
  label,
  optional,
  children,
  className,
  ...msg
}: FieldMessages & { id: string; label: ReactNode; optional?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", msg.verify && "rounded-sm bg-reserved-bg/60 p-3 ring-1 ring-reserved/30", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {optional ? <span className="font-normal text-ink-muted"> (opcional)</span> : null}
      </label>
      {children}
      {msg.verify ? (
        <p id={`${id}-verify`} className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-reserved">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 8v5m0 3.5v.01M10.3 4.3 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
          </svg>
          Verifica este dato: se importó del PDF con dudas.
        </p>
      ) : null}
      {msg.hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-muted">
          {msg.hint}
        </p>
      ) : null}
      {msg.error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-sold">
          {msg.error}
        </p>
      ) : null}
    </div>
  );
}
