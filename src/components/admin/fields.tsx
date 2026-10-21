import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Icon } from "./ui/Icon";

/** Text control: 44 px tall, 3:1 boundary, soft focus halo plus a solid accent border. */
export const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-sm border border-line-strong bg-white px-3.5 text-base text-ink placeholder:text-ink-muted/70 " +
  "transition-[border-color,box-shadow] duration-200 ease-apple " +
  "hover:border-ink-muted focus:border-navy focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-navy)_18%,transparent)] focus-visible:outline-none " +
  "aria-[invalid=true]:border-sold aria-[invalid=true]:focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-sold)_15%,transparent)] disabled:bg-sand disabled:text-ink-muted read-only:bg-sand/60";

export const selectClass = cn(inputClass, "select-chevron");

export const labelClass = "block text-sm font-medium text-ink";

export type FieldMessages = { error?: string | null; hint?: ReactNode; verify?: boolean };

/** Ids for the helper texts of a field, to wire `aria-describedby`. */
export function describedBy(id: string, msg: FieldMessages): string | undefined {
  const ids = [msg.verify ? `${id}-verify` : null, msg.hint ? `${id}-hint` : null, msg.error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export const verifyBox = "rounded-sm bg-reserved-bg/70 p-3 ring-1 ring-reserved/25";

export function VerifyNote({ id }: { id?: string }) {
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-reserved">
      <Icon name="alert" className="size-4 shrink-0" strokeWidth={2} />
      Verifica este dato: se importó del PDF con dudas.
    </p>
  );
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
    <div className={cn("min-w-0", msg.verify && verifyBox, className)}>
      <label htmlFor={id} className={labelClass}>
        {label}
        {optional ? <span className="font-normal text-ink-muted"> (opcional)</span> : null}
      </label>
      {children}
      {msg.verify ? <VerifyNote id={`${id}-verify`} /> : null}
      {msg.hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[0.8125rem] leading-snug text-ink-muted">
          {msg.hint}
        </p>
      ) : null}
      {msg.error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-sold">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {msg.error}
        </p>
      ) : null}
    </div>
  );
}
