import Link from "next/link";
import { cn } from "@/components/ui/cn";

export type QuickFilterOption = { label: string; href: string; active: boolean };

/**
 * Segmented control made of links: each option is a plain GET URL, so it works without
 * JavaScript and keeps the rest of the filters. The current option has `aria-current`.
 */
export function SegmentedLinks({ label, options, className }: { label: string; options: QuickFilterOption[]; className?: string }) {
  return (
    <ul aria-label={label} className={cn("inline-flex rounded-full bg-mist p-1", className)}>
      {options.map((o) => (
        <li key={o.href}>
          <Link
            href={o.href}
            scroll={false}
            aria-current={o.active ? "true" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full px-5 text-[0.9375rem] font-medium transition-[background-color,color,box-shadow] duration-300 ease-apple",
              o.active ? "bg-white text-ink shadow-[0_1px_4px_rgb(0_0_0/0.12)]" : "text-ink-muted hover:text-ink",
            )}
          >
            {o.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Horizontally scrolling chips (wrap on wide screens). Same link semantics as `SegmentedLinks`. */
export function ChipLinks({ label, options, className }: { label: string; options: QuickFilterOption[]; className?: string }) {
  return (
    <ul aria-label={label} className={cn("no-scrollbar flex gap-2 overflow-x-auto lg:flex-wrap lg:overflow-visible", className)}>
      {options.map((o) => (
        <li key={o.href} className="shrink-0">
          <Link
            href={o.href}
            scroll={false}
            aria-current={o.active ? "true" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors duration-300 ease-apple",
              o.active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-line-strong",
            )}
          >
            {o.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
