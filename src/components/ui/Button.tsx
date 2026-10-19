import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";
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
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap " +
  "transition-colors duration-150 ease-out select-none " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-navy text-white hover:bg-navy-hover active:bg-ink",
  secondary: "border border-ink/80 text-ink hover:bg-ink hover:text-paper",
  ghost: "text-ink underline-offset-4 hover:bg-ink/5 hover:underline",
};

const sizes: Record<ButtonSize, string> = {
  md: "px-5 text-sm",
  lg: "min-h-12 px-6 text-base",
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
