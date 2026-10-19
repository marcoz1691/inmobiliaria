import type { PriceKind } from "@/components/public/types";
import { cn } from "./cn";

const number = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 });
const numberWithCents = new Intl.NumberFormat("es-EC", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "US$110.000" — es-EC grouping with an explicit USD prefix (Ecuador uses the dollar). */
export function formatUsd(amount: number): string {
  const fmt = Number.isInteger(amount) ? number : numberWithCents;
  return `US$${fmt.format(amount)}`;
}

type PriceProps = {
  amount: number | null;
  priceKind: PriceKind;
  currency?: "USD";
  className?: string;
  /** Text shown when there is no public price. */
  fallback?: string;
};

/**
 * Public price. `rent` adds "/mes". `appraisal` is an internal valuation and is never
 * rendered publicly; neither is a missing amount — both show the fallback instead.
 */
export function Price({ amount, priceKind, className, fallback = "Precio a consultar" }: PriceProps) {
  if (amount === null || priceKind === "appraisal") {
    return <span className={cn("text-ink-muted", className)}>{fallback}</span>;
  }
  return (
    <span className={className}>
      {formatUsd(amount)}
      {priceKind === "rent" ? (
        <span className="font-normal text-ink-muted">
          <span aria-hidden="true">/mes</span>
          <span className="sr-only"> al mes</span>
        </span>
      ) : null}
    </span>
  );
}
