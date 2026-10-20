import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Icon, type IconName } from "./Icon";
import { tap } from "./motion";

/** Settings-style tile colors. Glyphs are white; every pair meets 4.5:1. */
export type TileTone = "navy" | "clay" | "green" | "blue" | "amber" | "red" | "gray";
const TILE: Record<TileTone, string> = {
  navy: "bg-navy",
  clay: "bg-clay",
  green: "bg-available",
  blue: "bg-rented",
  amber: "bg-reserved",
  red: "bg-sold",
  gray: "bg-ink-muted",
};

export function IconTile({ name, tone = "navy", size = "md", className }: { name: IconName; tone?: TileTone; size?: "md" | "lg"; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("grid shrink-0 place-items-center text-white", size === "lg" ? "size-10 rounded-[10px]" : "size-[1.875rem] rounded-[8px]", TILE[tone], className)}>
      <Icon name={name} className={size === "lg" ? "size-[1.375rem]" : "size-[1.125rem]"} strokeWidth={1.9} />
    </span>
  );
}

type GroupProps = {
  /** Section title above the group. Rendered as `h2` unless `headingLevel` says otherwise. */
  title?: ReactNode;
  titleId?: string;
  headingLevel?: 2 | 3;
  /** Right side of the header, e.g. a "Ver todo" link. */
  action?: ReactNode;
  /** Small print under the group, like iOS Settings footers. */
  footer?: ReactNode;
  className?: string;
  /** Use `div` when the content is not a list (forms, free content). */
  as?: "ul" | "ol" | "div";
  children: ReactNode;
  "aria-label"?: string;
};

/** "Inset grouped" list: white rounded card on the grouped background with inset separators. */
export function ListGroup({ title, titleId, headingLevel = 2, action, footer, className, as: As = "ul", children, ...aria }: GroupProps) {
  const H = `h${headingLevel}` as const;
  return (
    <section aria-labelledby={title ? titleId : undefined} className={cn("min-w-0", className)}>
      {title || action ? (
        <div className="mb-1 flex min-h-11 items-center justify-between gap-3 px-1">
          {title ? (
            <H id={titleId} className="text-[1.25rem] leading-tight font-bold tracking-[-0.02em] text-ink">
              {title}
            </H>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      <As className="overflow-hidden rounded-sm bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-ink/[0.04]" aria-label={aria["aria-label"]}>
        {children}
      </As>
      {footer ? <div className="mt-2 px-4 text-[0.8125rem] leading-snug text-ink-muted">{footer}</div> : null}
    </section>
  );
}

type Inset = "none" | "text" | "icon" | "thumb";
const SEPARATOR: Record<Inset, string> = {
  none: "",
  text: "not-first:before:left-4",
  icon: "not-first:before:left-[3.75rem]",
  thumb: "not-first:before:left-[6.5rem] sm:not-first:before:left-[8rem]",
};
const separatorBase = "relative not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:h-px not-first:before:bg-line/80 not-first:before:content-['']";

/** A `li` with the inset hairline separator. Use it to wrap custom row content. */
export function ListItem({ inset = "text", className, children, ...rest }: { inset?: Inset; className?: string; children: ReactNode } & React.LiHTMLAttributes<HTMLLIElement>) {
  return (
    <li className={cn(separatorBase, SEPARATOR[inset], className)} {...rest}>
      {children}
    </li>
  );
}

/** Interactive surface for a row: subtle highlight on hover and press, inset focus ring. */
export const rowInteractive = cn("hover:bg-ink/[0.025] active:bg-ink/[0.06] focus-visible:rounded-sm focus-visible:-outline-offset-2", tap);

type RowProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Leading visual: an `IconTile`, a thumbnail or an avatar. */
  leading?: ReactNode;
  /** Trailing value or badge (e.g. a count or status). */
  value?: ReactNode;
  href?: string;
  /** Opens in a new tab with the accessible notice. */
  external?: boolean;
  inset?: Inset;
  className?: string;
  /** Row text for assistive tech when the visible title is not enough. */
  srSuffix?: string;
};

/** Standard row: leading visual, title + subtitle, trailing value and a chevron when it navigates. */
export function ListRow({ title, subtitle, leading, value, href, external, inset, className, srSuffix }: RowProps) {
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1 py-0.5">
        <span className="block text-base leading-snug text-ink">
          {title}
          {srSuffix ? <span className="sr-only">{srSuffix}</span> : null}
        </span>
        {subtitle ? <span className="mt-0.5 block text-sm leading-snug text-ink-muted">{subtitle}</span> : null}
      </span>
      {value !== undefined && value !== null ? <span className="shrink-0 text-base text-ink-muted tabular-nums">{value}</span> : null}
      {href ? <Icon name={external ? "external" : "chevronRight"} className="-mr-1 size-[1.125rem] shrink-0 text-ink-muted/60" strokeWidth={2.2} /> : null}
    </>
  );
  const cls = cn("flex min-h-12 items-center gap-3 px-4 py-2.5", className);
  return (
    <ListItem inset={inset ?? (leading ? "icon" : "text")}>
      {href ? (
        external ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={cn(cls, rowInteractive)}>
            {body}
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
          </a>
        ) : (
          <Link href={href} className={cn(cls, rowInteractive)}>
            {body}
          </Link>
        )
      ) : (
        <div className={cls}>{body}</div>
      )}
    </ListItem>
  );
}

/** Content block inside a group (forms, free text) with the standard padding. */
export function GroupBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-4 sm:p-5", className)}>{children}</div>;
}
