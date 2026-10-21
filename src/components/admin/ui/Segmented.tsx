"use client";
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { ease } from "./motion";

export type SegmentOption = { value: string; label: ReactNode; /** Extra text for screen readers. */ srLabel?: string; badge?: number };

/** Sliding white thumb under the active segment; measured so labels can have any width. */
function useThumb(active: string) {
  const track = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const el = track.current?.querySelector<HTMLElement>(`[data-segment="${CSS.escape(active)}"]`);
    if (!el) return;
    const measure = () => setBox({ x: el.offsetLeft, w: el.offsetWidth });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [active]);
  return { track, box };
}

const trackClass = "relative inline-flex max-w-full rounded-[11px] bg-ink/[0.06] p-[3px]";
const segmentClass = cn(
  "relative z-10 inline-flex min-h-[2.375rem] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xs px-3.5 text-sm font-medium whitespace-nowrap text-ink",
  "transition-colors duration-200 focus-visible:-outline-offset-1",
  ease,
);

function Thumb({ box }: { box: { x: number; w: number } | null }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute top-[3px] bottom-[3px] left-0 rounded-xs bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)]",
        "transition-[translate,width] duration-300",
        ease,
        !box && "opacity-0",
      )}
      style={box ? { width: box.w, translate: `${box.x}px 0` } : undefined}
    />
  );
}

function Badge({ n, active }: { n?: number; active: boolean }) {
  if (n === undefined) return null;
  return <span className={cn("text-[0.8125rem] tabular-nums", active ? "text-ink-muted" : "text-ink-muted/80")}>{n}</span>;
}

/**
 * Segmented control as an ARIA tablist (arrow keys move and select, Home/End jump).
 * Pair each option with a `role="tabpanel"` whose id is `${idBase}-panel-${value}`.
 */
export function SegmentedTabs({
  options,
  value,
  onChange,
  label,
  idBase,
  className,
  /** Horizontal scroll when labels do not fit (e.g. CRM stages). */
  scroll,
}: {
  options: SegmentOption[];
  value: string;
  onChange: (v: string) => void;
  label: string;
  idBase: string;
  className?: string;
  scroll?: boolean;
}) {
  const { track, box } = useThumb(value);
  function onKey(e: KeyboardEvent, i: number) {
    const last = options.length - 1;
    const next = e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    onChange(options[next]!.value);
    track.current?.querySelector<HTMLElement>(`[data-segment="${CSS.escape(options[next]!.value)}"]`)?.focus();
  }
  const list = (
    <div ref={track} role="tablist" aria-label={label} className={cn(trackClass, scroll && "max-w-none", className)}>
      <Thumb box={box} />
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          data-segment={o.value}
          id={`${idBase}-tab-${o.value}`}
          aria-selected={o.value === value}
          aria-controls={`${idBase}-panel-${o.value}`}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => onKey(e, i)}
          className={cn(segmentClass, scroll && "flex-none")}
        >
          {o.label}
          {o.srLabel ? <span className="sr-only">{o.srLabel}</span> : null}
          <Badge n={o.badge} active={o.value === value} />
        </button>
      ))}
    </div>
  );
  return scroll ? <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">{list}</div> : list;
}

/**
 * Segmented control whose segments are links (filters in the URL). The thumb moves on tap,
 * before the navigation completes, so the control feels immediate.
 */
export function SegmentedLinks({ options, value, label, className }: { options: (SegmentOption & { href: string })[]; value: string; label: string; className?: string }) {
  const [optimistic, setOptimistic] = useState<{ from: string; to: string } | null>(null);
  const current = optimistic && optimistic.from === value ? optimistic.to : value;
  const { track, box } = useThumb(current);
  return (
    <nav aria-label={label} className={cn("no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
      <div ref={track} className={trackClass}>
        <Thumb box={box} />
        {options.map((o) => (
          <Link
            key={o.value}
            href={o.href}
            data-segment={o.value}
            aria-current={o.value === value ? "page" : undefined}
            onClick={() => setOptimistic({ from: value, to: o.value })}
            className={cn(segmentClass, "flex-none")}
            scroll={false}
          >
            {o.label}
            {o.srLabel ? <span className="sr-only">{o.srLabel}</span> : null}
            <Badge n={o.badge} active={o.value === current} />
          </Link>
        ))}
      </div>
    </nav>
  );
}
