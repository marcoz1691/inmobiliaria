import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Icon, type IconName } from "./Icon";

type Props = {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  /** A single clear next step. */
  action?: ReactNode;
  tone?: "empty" | "error" | "success";
  headingLevel?: 2 | 3;
  /** Without the white card (when already inside one). */
  bare?: boolean;
  className?: string;
};

const TONE = {
  empty: { icon: "tray" as IconName, ring: "bg-ink/[0.05] text-ink-muted", role: "status" as const },
  error: { icon: "alert" as IconName, ring: "bg-sold-bg text-sold", role: "alert" as const },
  success: { icon: "checkCircle" as IconName, ring: "bg-available-bg text-available", role: "status" as const },
};

/** What happened and what to do next, centered like an iOS empty view. */
export function EmptyState({ icon, title, description, action, tone = "empty", headingLevel = 2, bare, className }: Props) {
  const t = TONE[tone];
  const H = `h${headingLevel}` as const;
  return (
    <div role={t.role} className={cn("flex flex-col items-center px-6 py-10 text-center sm:py-14", !bare && "rounded-sm bg-white ring-1 ring-ink/[0.04]", className)}>
      <span aria-hidden="true" className={cn("grid size-14 place-items-center rounded-full", t.ring)}>
        <Icon name={icon ?? t.icon} className="size-7" strokeWidth={1.6} />
      </span>
      <H className="mt-4 text-[1.1875rem] leading-snug font-semibold tracking-[-0.015em] text-ink text-balance">{title}</H>
      {description ? <div className="mt-1.5 max-w-sm text-[0.9375rem] leading-relaxed text-ink-muted">{description}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
