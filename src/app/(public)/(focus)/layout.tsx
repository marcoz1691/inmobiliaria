import Link from "next/link";
import { getSite } from "../_lib/site";

/**
 * Focused chrome for the booking funnel and appointment pages: the agent's name and nothing
 * else to click away to, so an ad visitor goes straight from questions to the calendar.
 */
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  const site = await getSite();
  return (
    <>
      <header className="border-b border-line bg-paper">
        <a
          href="#contenido"
          className="sr-only rounded-sm bg-navy px-4 py-3 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
        >
          Saltar al contenido
        </a>
        <div className="mx-auto flex h-16 max-w-3xl items-center px-5 sm:px-8">
          <Link href="/" className="inline-flex min-h-11 items-center font-display text-xl leading-none tracking-tight text-ink">
            {site.name}
          </Link>
        </div>
      </header>
      <main id="contenido" className="flex flex-1 flex-col">
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-6 text-sm text-ink-muted sm:px-8">
          <p>
            © {new Date().getFullYear()} {site.name}
          </p>
          <Link href="/propiedades" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-ink">
            Ver propiedades
          </Link>
        </div>
      </footer>
    </>
  );
}
