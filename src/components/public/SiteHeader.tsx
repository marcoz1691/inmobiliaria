import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { MobileNav } from "./MobileNav";

export type NavItem = { label: string; href: string };

type SiteHeaderProps = {
  /** Agent's name, used as the wordmark. */
  name: string;
  /** Short descriptor under the name, e.g. "Asesor inmobiliario · Quito". */
  tagline?: string;
  homeHref?: string;
  nav: NavItem[];
  ctaHref: string;
  ctaLabel?: string;
  /** id of the page's main element, target of the skip link. */
  mainId?: string;
};

export function SiteHeader({
  name,
  tagline,
  homeHref = "/",
  nav,
  ctaHref,
  ctaLabel = "Agenda una cita",
  mainId = "contenido",
}: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper">
      <a
        href={`#${mainId}`}
        className="sr-only rounded-sm bg-navy px-4 py-3 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        Saltar al contenido
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8 lg:h-20 lg:px-12">
        <Link href={homeHref} className="group flex min-h-11 flex-col justify-center rounded-xs">
          <span className="font-display text-xl leading-none tracking-tight text-ink lg:text-2xl">{name}</span>
          {tagline ? (
            <span className="mt-1 text-xs leading-none text-ink-muted">{tagline}</span>
          ) : null}
        </Link>

        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-full px-4 text-sm text-ink transition-colors hover:bg-ink/5"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden md:block">
          <Button href={ctaHref}>{ctaLabel}</Button>
        </div>

        <MobileNav nav={nav} ctaHref={ctaHref} ctaLabel={ctaLabel} />
      </div>
    </header>
  );
}
