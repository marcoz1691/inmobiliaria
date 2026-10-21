import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export function Bone({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block animate-shimmer rounded-[6px] bg-ink/[0.07]", className)} />;
}

/** Loading wrapper: announces once, hides the placeholder shapes from assistive tech. */
export function LoadingScreen({ label = "Cargando…", children, className }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn("mx-auto max-w-5xl", className)}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function TitleBones({ action }: { action?: boolean }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 md:mb-8">
      <div className="w-full max-w-sm">
        <Bone className="h-9 w-2/3 md:h-10" />
        <Bone className="mt-3 h-4 w-full" />
      </div>
      {action ? <Bone className="hidden h-11 w-44 rounded-full sm:block" /> : null}
    </div>
  );
}

/** Rows shaped like a `ListGroup`: optional leading tile or thumbnail, two text lines. */
export function ListBones({ rows = 4, leading = "tile", className }: { rows?: number; leading?: "tile" | "thumb" | "none"; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-sm bg-white ring-1 ring-ink/[0.04]", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-t border-line/60 px-4 py-3 first:border-t-0">
          {leading === "tile" ? <Bone className="size-[1.875rem] rounded-xs" /> : leading === "thumb" ? <Bone className="aspect-[4/3] w-20 rounded-xs sm:w-28" /> : null}
          <div className="flex-1">
            <Bone className="h-4 w-1/2" />
            <Bone className="mt-2 h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
