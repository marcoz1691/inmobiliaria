"use client";
import { useCallback, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { PLANS, type PlanId } from "@/modules/billing/plans";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { Sheet } from "./ui/Sheet";

const OFFER: PlanId[] = ["agente", "pro", "inmobiliaria"];

/**
 * Shown when an action hits the plan's limit (publishing, featuring): the reason, the paid plans
 * side by side and the way to upgrade. The plan page has the full comparison and activation.
 */
export function UpgradeSheet({ open, reason, onClose }: { open: boolean; reason: string; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      className="sm:w-[min(46rem,calc(100vw-2rem))]"
      title="Publica más con un plan pagado"
      description={reason}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            Ahora no
          </Button>
          <Button href="/panel/plan">Ver planes y mejorar</Button>
        </>
      }
    >
      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {OFFER.map((id) => {
          const p = PLANS[id];
          return (
            <li key={id} className={cn("relative rounded-md p-4 ring-1 ring-ink/10", p.highlight && "ring-2 ring-navy")}>
              {p.highlight ? (
                <span className="absolute -top-2.5 left-4 rounded-full bg-navy px-2.5 py-0.5 text-[0.6875rem] font-semibold text-white">Más elegido</span>
              ) : null}
              <p className="text-[1.0625rem] font-bold text-ink">{p.name}</p>
              <p className="mt-0.5">
                <span className="text-[1.5rem] font-bold tracking-[-0.02em] text-ink">US${p.priceUsd}</span>
                <span className="text-sm text-ink-muted"> /mes + IVA</span>
              </p>
              <ul className="mt-2 grid gap-1 text-sm text-ink">
                {p.features.slice(0, 3).map((f) => (
                  <li key={f} className="flex gap-1.5">
                    <Icon name="check" className="mt-0.5 size-4 shrink-0 text-available" strokeWidth={2.4} />
                    {f}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

/**
 * Wraps an action result: a plan-limit failure opens the plans sheet, anything else is left to
 * the caller. Returns the sheet to render and a handler that says whether it took over.
 */
export function useUpgradePrompt(): { sheet: ReactNode; handled: (r: { ok: boolean; error?: string; upgrade?: boolean }) => boolean } {
  const [reason, setReason] = useState<string | null>(null);
  const handled = useCallback((r: { ok: boolean; error?: string; upgrade?: boolean }) => {
    if (r.ok || !r.upgrade) return false;
    setReason(r.error ?? "Llegaste al límite de tu plan.");
    return true;
  }, []);
  const sheet = <UpgradeSheet open={reason !== null} reason={reason ?? ""} onClose={() => setReason(null)} />;
  return { sheet, handled };
}
