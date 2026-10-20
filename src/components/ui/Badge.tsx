import type { PropertyStatus } from "@/components/public/types";
import { cn } from "./cn";

const STATUS: Record<PropertyStatus, { label: string; className: string; dot: string }> = {
  available: { label: "Disponible", className: "bg-available-bg text-available", dot: "bg-available" },
  reserved: { label: "Reservada", className: "bg-reserved-bg text-reserved", dot: "bg-reserved" },
  sold: { label: "Vendida", className: "bg-sold-bg text-sold", dot: "bg-sold" },
  rented: { label: "Alquilada", className: "bg-rented-bg text-rented", dot: "bg-rented" },
};

export function statusLabel(status: PropertyStatus): string {
  return STATUS[status].label;
}

/**
 * Property status. The text label carries the meaning; color only reinforces it.
 * `overlay` is a frosted pill for use on top of photos (ink text, colored dot).
 */
export function Badge({ status, className, overlay = false }: { status: PropertyStatus; className?: string; overlay?: boolean }) {
  const s = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none tracking-normal",
        overlay ? "bg-white/90 text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)] backdrop-blur-md" : s.className,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}
