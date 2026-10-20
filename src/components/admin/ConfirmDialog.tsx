"use client";
import { useState, type ReactNode } from "react";
import { Button } from "./ui/Button";
import { Sheet } from "./ui/Sheet";

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

/** Confirmation in a modal sheet (bottom sheet on phones). "Cancelar" gets the initial focus. */
export function ConfirmDialog({ title, description, confirmLabel, onConfirm, trigger, destructive, children }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setOpen] = useState(false);

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
      <Sheet open={isOpen} onClose={() => setOpen(false)} title={title} description={description}>
        <form onSubmit={confirm}>
          {children}
          {error ? (
            <p role="alert" className="mt-4 text-sm font-medium text-sold">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="gray" size="lg" className="sm:min-h-11 sm:px-5 sm:text-[0.9375rem]" onClick={() => setOpen(false)} autoFocus>
              Cancelar
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "filled"} size="lg" className="sm:min-h-11 sm:px-5 sm:text-[0.9375rem]" pending={pending}>
              {pending ? "Un momento…" : confirmLabel}
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
