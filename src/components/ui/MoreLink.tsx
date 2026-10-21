import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

type MoreLinkProps = {
  href: string;
  children: ReactNode;
  /** `dark` for night/ink sections. */
  tone?: "light" | "dark";
  size?: "md" | "lg";
  className?: string;
};

/** Secondary text action with a trailing chevron: "Ver todas ›". */
export function MoreLink({ href, children, tone = "light", size = "md", className }: MoreLinkProps) {
  const classes = cn(
    "group/more inline-flex min-h-11 items-center gap-1 rounded-xs underline-offset-4 hover:underline",
    tone === "dark" ? "text-link-dark" : "text-link",
    size === "lg" ? "text-[1.0625rem] sm:text-lg" : "text-[0.9375rem] sm:text-[1.0625rem]",
    className,
  );
  const content = (
    <>
      {children}
      <span aria-hidden="true" className="inline-block transition-transform duration-300 ease-apple group-hover/more:translate-x-0.5">
        ›
      </span>
    </>
  );
  if (href.startsWith("http")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {content}
        <span className="sr-only"> (se abre en una pestaña nueva)</span>
      </a>
    );
  }
  if (/^(mailto:|tel:|#)/.test(href)) {
    return (
      <a href={href} className={classes}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}
