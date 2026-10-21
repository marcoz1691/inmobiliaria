import Link from "next/link";
import { getSite } from "../_lib/site";

const linkClass = "inline-flex min-h-11 items-center underline-offset-4 hover:text-ink hover:underline";

/**
 * Focused chrome for the booking funnel and appointment pages: the agent's name and nothing
 * else to click away to, so an ad visitor goes straight from questions to the calendar.
 */
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  const site = await getSite();
  return (
    <>
      <header className="glass sticky top-0 z-40 border-b border-ink/10">
        <a
          href="#contenido"
          className="sr-only rounded-full bg-navy px-4 py-3 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
        >
          Saltar al contenido
        </a>
        <div className="mx-auto flex h-13 max-w-2xl items-center px-5 sm:px-8">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-xs text-[1.0625rem] font-semibold tracking-[-0.02em] text-ink">
            {site.name}
          </Link>
        </div>
      </header>
      <main id="contenido" className="flex flex-1 flex-col">
        {children}
      </main>
      <footer className="bg-sand">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-5 text-xs text-ink-muted sm:px-8">
          <p>
            © {new Date().getFullYear()} {site.name}
          </p>
          <div className="flex gap-x-5">
            <Link href="/privacidad" className={linkClass}>
              Privacidad
            </Link>
            <Link href="/propiedades" className={linkClass}>
              Ver propiedades
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
