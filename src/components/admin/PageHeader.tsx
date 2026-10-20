import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Icon } from "./ui/Icon";
import { tap } from "./ui/motion";

/** iOS-style back link: accent chevron + the parent screen's name. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={cn("-ml-2.5 inline-flex min-h-11 items-center gap-0.5 rounded-full pr-3 pl-1 text-[1.0625rem] text-navy hover:bg-navy/[0.07]", tap)}>
      <Icon name="chevronLeft" className="size-6" strokeWidth={2.2} />
      {label}
    </Link>
  );
}

export const largeTitle = "font-display text-[2.125rem] leading-[1.08] font-bold tracking-[-0.025em] text-ink text-balance md:text-[2.5rem]";

/** Large title header. `eyebrow` is a quiet context line above the title. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
  meta,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  /** Small line under the title (status, dates). */
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 md:mb-8", className)}>
      {back ? (
        <div className="mb-1 md:mb-2">
          <BackLink {...back} />
        </div>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="mb-1 text-[0.9375rem] font-semibold text-ink-muted">{eyebrow}</p> : null}
          <h1 className={largeTitle}>{title}</h1>
          {meta ? <div className="mt-2">{meta}</div> : null}
          {description ? <div className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-muted md:text-base">{description}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
