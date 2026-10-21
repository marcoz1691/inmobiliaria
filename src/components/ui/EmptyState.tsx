import type { ReactNode } from "react";
import { cn } from "./cn";

export type EmptyStateTone = "empty" | "error" | "success";

type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  /** Usually one `<Button>`; keep a single clear next step. */
  action?: ReactNode;
  tone?: EmptyStateTone;
  /** Heading level, so the state fits the surrounding outline. */
  headingLevel?: 2 | 3 | 4;
  /** Panel color: `white` when the state sits on a sand section. */
  surface?: "sand" | "white";
  className?: string;
};

/** Each tone has its own icon shape, so the state never depends on color alone. */
const TONE: Record<EmptyStateTone, { disc: string; icon: ReactNode; role: "status" | "alert" }> = {
  empty: {
    disc: "bg-mist text-ink",
    role: "status",
    icon: <path d="M4 11.5 12 5l8 6.5M6.5 9.5V19h11V9.5M10 19v-5h4v5" />,
  },
  error: {
    disc: "bg-sold-bg text-sold",
    role: "alert",
    icon: <path d="M12 8v5m0 3.5v.01M10.3 4.3 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />,
  },
  success: {
    disc: "bg-available-bg text-available",
    role: "status",
    icon: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  },
};

/** Empty, error and confirmation states: say what happened and offer one next step. */
export function EmptyState({
  title,
  description,
  action,
  tone = "empty",
  headingLevel = 3,
  surface = "sand",
  className,
}: EmptyStateProps) {
  const t = TONE[tone];
  const Heading = `h${headingLevel}` as const;
  return (
    <div role={t.role} className={cn("rounded-md p-6 sm:p-8", surface === "white" ? "bg-white" : "bg-sand", className)}>
      <span aria-hidden="true" className={cn("inline-flex size-12 items-center justify-center rounded-full", t.disc)}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-6"
        >
          {t.icon}
        </svg>
      </span>
      <Heading className="mt-4 font-display text-headline text-ink">{title}</Heading>
      {description ? <div className="mt-2 max-w-prose text-base text-ink-muted">{description}</div> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
