import Link from "next/link";
import type { ReactNode } from "react";
import type { NavItem } from "./SiteHeader";
import { whatsappHref } from "./WhatsAppButton";

type SiteFooterProps = {
  name: string;
  tagline?: string;
  nav: NavItem[];
  email?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  /** Social profiles the agent filled in (absolute https URLs). */
  socials?: { label: string; href: string }[];
  /** Office or coverage area; shown as given. */
  location?: string | null;
  /** Legal or licensing line supplied by the agent (never invented). */
  legal?: ReactNode;
  privacyHref?: string;
};

const linkClass = "inline-flex min-h-11 items-center text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline";
const headingClass = "text-xs font-semibold tracking-normal text-ink";

export function SiteFooter({
  name,
  tagline,
  nav,
  email,
  whatsapp,
  phone,
  socials = [],
  location,
  legal,
  privacyHref = "/privacidad",
}: SiteFooterProps) {
  const wa = whatsapp ? whatsappHref(whatsapp, `Hola ${name}, quisiera más información.`) : null;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-sand text-sm">
      <div className="mx-auto max-w-7xl px-5 pt-12 pb-8 sm:px-8 lg:px-12 lg:pt-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 border-b border-line pb-10 lg:grid-cols-12">
          <div className="col-span-2 lg:col-span-6">
            <p className="text-headline text-ink">{name}</p>
            {tagline ? <p className="mt-1 text-ink-muted">{tagline}</p> : null}
          </div>

          <nav aria-label="Pie de página" className="lg:col-span-3">
            <h2 className={headingClass}>Explora</h2>
            <ul className="mt-2">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {email || wa || phone || location || socials.length ? (
            <div className="lg:col-span-3">
              <h2 className={headingClass}>Contacto</h2>
              <ul className="mt-2">
                {wa ? (
                  <li>
                    <a href={wa} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      WhatsApp<span className="sr-only"> (se abre en una pestaña nueva)</span>
                    </a>
                  </li>
                ) : null}
                {email ? (
                  <li>
                    <a href={`mailto:${email}`} className={`${linkClass} break-all`}>
                      {email}
                    </a>
                  </li>
                ) : null}
                {phone ? (
                  <li>
                    <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={linkClass}>
                      {phone}
                    </a>
                  </li>
                ) : null}
                {socials.map((s) => (
                  <li key={s.href}>
                    <a href={s.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      {s.label}
                      <span className="sr-only"> (se abre en una pestaña nueva)</span>
                    </a>
                  </li>
                ))}
                {location ? <li className="py-3 text-ink-muted">{location}</li> : null}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-x-6 gap-y-1 pt-4 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4">
            <p>
              © {year} {name}
            </p>
            <Link href={privacyHref} className={linkClass}>
              Privacidad
            </Link>
          </div>
          {legal ? <div>{legal}</div> : null}
        </div>
      </div>
    </footer>
  );
}
