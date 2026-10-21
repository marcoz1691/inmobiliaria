import { STATUS_LABEL, type PropertyStatus } from "@/modules/properties/domain";
import { cn } from "@/components/ui/cn";

const TONE: Record<PropertyStatus, { pill: string; dot: string }> = {
  draft: { pill: "bg-ink/[0.06] text-ink-muted", dot: "bg-ink-muted/70" },
  published: { pill: "bg-available-bg text-available", dot: "bg-available" },
  paused: { pill: "bg-ink/[0.06] text-ink", dot: "bg-reserved" },
  reserved: { pill: "bg-reserved-bg text-reserved", dot: "bg-reserved" },
  sold: { pill: "bg-sold-bg text-sold", dot: "bg-sold" },
  rented: { pill: "bg-rented-bg text-rented", dot: "bg-rented" },
  archived: { pill: "bg-white text-ink-muted ring-1 ring-inset ring-line", dot: "bg-line-strong" },
};

/** Panel status capsule: covers internal states (draft, paused, archived). The text carries the meaning. */
export function StatusTag({ status, className }: { status: PropertyStatus; className?: string }) {
  const t = TONE[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-[0.3125rem] text-xs leading-none font-semibold", t.pill, className)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", t.dot)} />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Same capsule for other small labels (review pending, funnel status…). */
export function Pill({ tone = "gray", children, className }: { tone?: "gray" | "green" | "amber" | "red" | "blue"; children: React.ReactNode; className?: string }) {
  const TONES = {
    gray: { pill: "bg-ink/[0.06] text-ink-muted", dot: "bg-ink-muted/70" },
    green: { pill: "bg-available-bg text-available", dot: "bg-available" },
    amber: { pill: "bg-reserved-bg text-reserved", dot: "bg-reserved" },
    red: { pill: "bg-sold-bg text-sold", dot: "bg-sold" },
    blue: { pill: "bg-rented-bg text-rented", dot: "bg-rented" },
  } as const;
  const t = TONES[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-[0.3125rem] text-xs leading-none font-semibold", t.pill, className)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", t.dot)} />
      {children}
    </span>
  );
}
