import { cn } from "./cn";

/** Decorative loading block. Wrap groups in an element with `aria-busy` and a status label. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-shimmer rounded-sm bg-ink/[0.06]", className)} />;
}
