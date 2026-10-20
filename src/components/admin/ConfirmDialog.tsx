"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

type Props = {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  /** Returns an error message to keep the dialog open, or nothing on success. */
  onConfirm: () => Promise<string | void> | string | void;
  trigger: (open: () => void) => ReactNode;
  destructive?: boolean;
  children?: ReactNode;
};

/**
 * Confirmation with the native `<dialog>`: modal, focus moved inside and trapped, Escape closes
 * and focus returns to the trigger.
 */
export function ConfirmDialog({ title, description, confirmLabel, onConfirm, trigger, destructive, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (isOpen && !d.open) d.showModal();
    if (!isOpen && d.open) d.close();
  }, [isOpen]);

  function open() {
    setError(null);
    setOpen(true);
  }
  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await onConfirm();
    setPending(false);
    if (typeof result === "string") setError(result);
    else setOpen(false);
  }

  return (
    <>
      {trigger(open)}
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        aria-labelledby={`${id}-t`}
        aria-describedby={description ? `${id}-d` : undefined}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-md border border-line bg-paper p-0 text-ink backdrop:bg-ink/50"
      >
        <form onSubmit={confirm} className="p-6">
          <h2 id={`${id}-t`} className="font-display text-2xl leading-tight">
            {title}
          </h2>
          {description ? (
            <div id={`${id}-d`} className="mt-2 text-base text-ink-muted">
              {description}
            </div>
          ) : null}
          {children}
          {error ? (
            <p role="alert" className="mt-4 text-sm font-medium text-sold">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)} autoFocus>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending} className={cn(destructive && "bg-sold hover:bg-sold/90 active:bg-sold")}>
              {pending ? "Un momento…" : confirmLabel}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
