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
};

const linkClass =
  "inline-flex min-h-11 items-center text-paper underline-offset-4 hover:underline focus-visible:outline-paper";

export function SiteFooter({ name, tagline, nav, email, whatsapp, phone, socials = [], location, legal }: SiteFooterProps) {
  const wa = whatsapp ? whatsappHref(whatsapp, `Hola ${name}, quisiera más información.`) : null;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-ink text-paper">
      <div className="mx-auto max-w-7xl px-5 pt-16 pb-10 sm:px-8 lg:px-12 lg:pt-20">
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-12">
          <div className="col-span-2 lg:col-span-6">
            <p className="font-display text-display-md text-paper">{name}</p>
            {tagline ? <p className="mt-2 text-sm text-paper-muted">{tagline}</p> : null}
          </div>

          <nav aria-label="Pie de página" className="lg:col-span-3">
            <h2 className="text-eyebrow text-paper-muted uppercase">Explora</h2>
            <ul className="mt-3">
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
              <h2 className="text-eyebrow text-paper-muted uppercase">Contacto</h2>
              <ul className="mt-3">
                {wa ? (
                  <li>
                    <a href={wa} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      WhatsApp<span className="sr-only"> (se abre en una pestaña nueva)</span>
                    </a>
                  </li>
                ) : null}
                {email ? (
                  <li>
                    <a href={`mailto:${email}`} className={linkClass}>
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
                {location ? <li className="py-3 text-paper-muted">{location}</li> : null}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="mt-16 flex flex-col gap-2 border-t border-paper/20 pt-6 text-xs text-paper-muted sm:flex-row sm:justify-between">
          <p>
            © {year} {name}
          </p>
          {legal ? <div>{legal}</div> : null}
        </div>
      </div>
    </footer>
  );
}
