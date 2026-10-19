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

/** Property status. The text label carries the meaning; color only reinforces it. */
export function Badge({ status, className }: { status: PropertyStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xs px-2 py-1 text-xs font-medium leading-none",
        s.className,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}
