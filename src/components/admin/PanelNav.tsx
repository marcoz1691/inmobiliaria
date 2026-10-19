"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/components/ui/cn";

export type PanelNavItem = { href: string; label: string; primary?: boolean };

/** Desktop: left rail. Mobile: bottom tab bar with the primary destinations + "Más". */
export function PanelNav({ items, userName }: { items: PanelNavItem[]; userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = (href: string) => (href === "/panel" ? pathname === "/panel" : pathname.startsWith(href));
  async function signOut() {
    await authClient.signOut();
    router.replace("/panel/ingresar");
  }
  return (
    <>
      <nav aria-label="Panel" className="hidden w-60 shrink-0 flex-col border-r border-line px-4 py-6 md:flex">
        <p className="px-3 font-display text-lg text-ink">Panel</p>
        <ul className="mt-6 space-y-1">
          {items.map((i) => (
            <li key={i.href}>
              <Link href={i.href} aria-current={active(i.href) ? "page" : undefined}
                className={cn("flex min-h-11 items-center rounded px-3 text-sm", active(i.href) ? "bg-ink text-paper" : "text-ink hover:bg-ink/5")}>
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-auto border-t border-line px-3 pt-4 text-sm">
          <p className="truncate text-ink-muted">{userName}</p>
          <button type="button" onClick={signOut} className="mt-2 min-h-11 text-ink underline-offset-4 hover:underline">Cerrar sesión</button>
        </div>
      </nav>
      <nav aria-label="Panel" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid grid-cols-5">
          {items.filter((i) => i.primary).slice(0, 4).map((i) => (
            <li key={i.href}>
              <Link href={i.href} aria-current={active(i.href) ? "page" : undefined}
                className={cn("flex min-h-14 items-center justify-center px-1 text-center text-xs", active(i.href) ? "font-semibold text-ink" : "text-ink-muted")}>
                {i.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/panel/mas" aria-current={pathname === "/panel/mas" ? "page" : undefined}
              className={cn("flex min-h-14 items-center justify-center text-xs", pathname === "/panel/mas" ? "font-semibold text-ink" : "text-ink-muted")}>
              Más
            </Link>
          </li>
        </ul>
      </nav>
    </>
  );
}
