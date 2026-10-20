import { STATUS_LABEL, type PropertyStatus } from "@/modules/properties/domain";
import { cn } from "@/components/ui/cn";

const TONE: Record<PropertyStatus, string> = {
  draft: "bg-sand text-ink-muted ring-1 ring-inset ring-line-strong/50",
  published: "bg-available-bg text-available",
  paused: "bg-sand text-ink",
  reserved: "bg-reserved-bg text-reserved",
  sold: "bg-sold-bg text-sold",
  rented: "bg-rented-bg text-rented",
  archived: "bg-white text-ink-muted ring-1 ring-inset ring-line",
};

/** Panel status label: covers internal states (draft, paused, archived). Text carries the meaning. */
export function StatusTag({ status, className }: { status: PropertyStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-xs px-2 py-1 text-xs font-medium leading-none", TONE[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}
