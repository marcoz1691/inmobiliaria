"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { ease } from "./motion";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons row; stacked full-width on phones, right-aligned on larger screens. */
  footer?: ReactNode;
  className?: string;
};

/**
 * Modal sheet on the native `<dialog>`: focus moves inside and is trapped, Escape and a tap on
 * the backdrop close it, focus returns to the trigger. Bottom sheet on phones, centered card
 * from `sm` up. Enter/exit animate with `@starting-style`; browsers without it simply appear.
 */
export function Sheet({ open, onClose, title, description, children, footer, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby={`${id}-t`}
      aria-describedby={description ? `${id}-d` : undefined}
      className={cn(
        "m-auto max-h-[calc(100dvh-2rem)] w-[min(30rem,calc(100vw-2rem))] max-w-none overflow-y-auto overscroll-contain bg-white p-0 text-ink",
        "rounded-md shadow-[0_30px_90px_-20px_rgba(0,0,0,0.45),0_0_0_0.5px_rgba(0,0,0,0.06)]",
        "max-sm:mb-0 max-sm:max-h-[calc(100dvh-3rem)] max-sm:w-full max-sm:rounded-b-none",
        "backdrop:bg-ink/35",
        // Motion: fade + lift (phone) or fade + scale (desktop).
        "transition-[opacity,translate,scale,overlay,display] transition-discrete duration-[380ms]",
        ease,
        "opacity-0 open:opacity-100 starting:open:opacity-0",
        "max-sm:translate-y-full max-sm:open:translate-y-0 max-sm:starting:open:translate-y-full",
        "sm:scale-[0.96] sm:open:scale-100 sm:starting:open:scale-[0.96]",
        "backdrop:opacity-0 backdrop:transition-[opacity,overlay,display] backdrop:transition-discrete backdrop:duration-[380ms] open:backdrop:opacity-100 starting:open:backdrop:opacity-0",
        className,
      )}
    >
      <div className="px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
        <span aria-hidden="true" className="mx-auto mb-4 block h-[5px] w-9 rounded-full bg-ink/15 sm:hidden" />
        <h2 id={`${id}-t`} className="text-[1.375rem] leading-tight font-bold tracking-[-0.02em] text-balance">
          {title}
        </h2>
        {description ? (
          <div id={`${id}-d`} className="mt-2 text-base leading-relaxed text-ink-muted">
            {description}
          </div>
        ) : null}
        {children}
        {footer ? <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div> : null}
      </div>
    </dialog>
  );
}
