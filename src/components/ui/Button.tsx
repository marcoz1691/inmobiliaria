import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/** `inverse` is the white pill for dark (night/ink) sections. */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse";
export type ButtonSize = "md" | "lg";

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon; rendered decoratively (aria-hidden). */
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
};

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & {
  href: string;
};
type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
  href?: undefined;
};

export type ButtonProps = CommonProps & (AnchorProps | NativeButtonProps);

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap tracking-[-0.01em] " +
  "transition-[background-color,color,border-color,transform] duration-300 ease-apple select-none active:scale-[0.97] " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-navy text-white hover:bg-navy-hover",
  secondary: "border border-navy text-navy hover:bg-navy hover:text-white",
  ghost: "text-ink underline-offset-4 hover:bg-ink/5 hover:underline",
  inverse: "bg-white text-ink hover:bg-mist",
};

const sizes: Record<ButtonSize, string> = {
  md: "px-5 text-[0.9375rem]",
  lg: "min-h-12 px-7 text-[1.0625rem]",
};

const EXTERNAL = /^(https?:|mailto:|tel:)/;

/** Action element. Renders a link when `href` is set, a `<button>` otherwise. */
export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className);
  const content = (
    <>
      {icon ? (
        <span aria-hidden="true" className="inline-flex size-5 shrink-0 items-center justify-center">
          {icon}
        </span>
      ) : null}
      {children}
    </>
  );

  if (typeof rest.href === "string") {
    const { href, ...anchor } = rest as AnchorProps;
    if (href.startsWith("http")) {
      return (
        <a href={href} className={classes} target="_blank" rel="noopener noreferrer" {...anchor}>
          {content}
          <span className="sr-only"> (se abre en una pestaña nueva)</span>
        </a>
      );
    }
    if (EXTERNAL.test(href)) {
      return (
        <a href={href} className={classes} {...anchor}>
          {content}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} {...anchor}>
        {content}
      </Link>
    );
  }

  const { type, ...button } = rest as NativeButtonProps;
  return (
    <button type={type ?? "button"} className={classes} {...button}>
      {content}
    </button>
  );
}
