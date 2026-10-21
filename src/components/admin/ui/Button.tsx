import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Icon, type IconName } from "./Icon";
import { press, tap } from "./motion";

export type PanelButtonVariant = "filled" | "tinted" | "gray" | "plain" | "destructive";
export type PanelButtonSize = "sm" | "md" | "lg";

type CommonProps = {
  variant?: PanelButtonVariant;
  size?: PanelButtonSize;
  icon?: IconName;
  /** Shows a spinner and blocks the control while an action runs. */
  pending?: boolean;
  className?: string;
  children: ReactNode;
};
type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & { href: string };
type NativeProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { href?: undefined };
export type PanelButtonProps = CommonProps & (AnchorProps | NativeProps);

const VARIANT: Record<PanelButtonVariant, string> = {
  filled: "bg-navy text-white font-semibold hover:bg-navy-hover",
  tinted: "bg-navy/10 text-navy font-semibold hover:bg-navy/15",
  gray: "bg-ink/[0.06] text-ink font-medium hover:bg-ink/10",
  plain: "text-navy font-medium hover:bg-navy/[0.07]",
  destructive: "bg-sold text-white font-semibold hover:bg-sold/90",
};

const SIZE: Record<PanelButtonSize, string> = {
  sm: "min-h-11 px-4 text-[0.9375rem] gap-1.5",
  md: "min-h-11 px-5 text-[0.9375rem] gap-2",
  lg: "min-h-[3.25rem] px-6 text-[1.0625rem] gap-2",
};

export function Spinner({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={cn("size-4 animate-spin", className)} fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Capsule button in the Apple sense: filled for the main action, tinted/gray for the rest. */
export function Button({ variant = "filled", size = "md", icon, pending, className, children, ...rest }: PanelButtonProps) {
  const classes = cn(
    "inline-flex select-none items-center justify-center rounded-full whitespace-nowrap",
    "disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40",
    tap,
    press,
    VARIANT[variant],
    SIZE[size],
    className,
  );
  const content = (
    <>
      {pending ? <Spinner /> : icon ? <Icon name={icon} className={size === "lg" ? "size-5" : "size-[1.125rem]"} strokeWidth={2} /> : null}
      {children}
    </>
  );

  if (typeof rest.href === "string") {
    const { href, ...anchor } = rest as AnchorProps;
    if (/^(https?:|mailto:|tel:)/.test(href) || href.startsWith("/api/")) {
      const external = href.startsWith("http");
      return (
        <a href={href} className={classes} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...anchor}>
          {content}
          {external ? <span className="sr-only"> (se abre en una pestaña nueva)</span> : null}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} {...anchor}>
        {content}
      </Link>
    );
  }
  const { type, disabled, ...button } = rest as NativeProps;
  return (
    <button type={type ?? "button"} className={classes} disabled={disabled || pending} aria-busy={pending || undefined} {...button}>
      {content}
    </button>
  );
}
