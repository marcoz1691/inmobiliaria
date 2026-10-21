import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { MobileNav } from "./MobileNav";

export type NavItem = { label: string; href: string };

type SiteHeaderProps = {
  /** Agent's name, used as the wordmark. */
  name: string;
  /** Short descriptor next to the name on wide screens, e.g. "Asesor inmobiliario · Quito". */
  tagline?: string;
  homeHref?: string;
  nav: NavItem[];
  ctaHref: string;
  ctaLabel?: string;
  /** id of the page's main element, target of the skip link. */
  mainId?: string;
};

/** Sticky translucent bar: content scrolls underneath, blurred, like a native toolbar. */
export function SiteHeader({
  name,
  tagline,
  homeHref = "/",
  nav,
  ctaHref,
  ctaLabel = "Agenda una cita",
  mainId = "contenido",
}: SiteHeaderProps) {
  // The call to action already has its own pill; don't repeat it as a plain link.
  const links = nav.filter((item) => item.href !== ctaHref);
  return (
    <header className="glass sticky top-0 z-40 border-b border-ink/10">
      <a
        href={`#${mainId}`}
        className="sr-only rounded-full bg-navy px-4 py-3 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        Saltar al contenido
      </a>
      <div className="mx-auto flex h-13 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
        <Link href={homeHref} className="flex min-h-11 min-w-0 items-center gap-3 rounded-xs">
          <span className="truncate text-[1.0625rem] font-semibold tracking-[-0.02em] text-ink">{name}</span>
          {tagline ? (
            <span className="hidden border-l border-line pl-3 text-xs text-ink-muted xl:inline">{tagline}</span>
          ) : null}
        </Link>

        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center">
            {links.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-full px-3.5 text-sm text-ink/80 transition-colors duration-300 ease-apple hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden md:block">
          <Button href={ctaHref} className="px-4 text-sm">
            {ctaLabel}
          </Button>
        </div>

        <MobileNav nav={links} ctaHref={ctaHref} ctaLabel={ctaLabel} />
      </div>
    </header>
  );
}
