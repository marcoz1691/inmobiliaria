"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/components/ui/cn";
import { Icon, type IconName } from "./ui/Icon";
import { ease, tap } from "./ui/motion";
import { NAV_SECTIONS } from "./nav-items";

export type PanelNavItem = { href: string; label: string; icon: IconName; section: (typeof NAV_SECTIONS)[number]["key"]; primary?: boolean };
type Badges = Partial<Record<string, { n: number; label: string }>>;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase("es"))
    .join("") || "·";

export function useSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return {
    pending,
    signOut: async () => {
      setPending(true);
      await authClient.signOut();
      router.replace("/panel/ingresar");
    },
  };
}

/** Desktop: translucent sidebar with sections. Mobile: iOS-style tab bar with the primary destinations + "Más". */
export function PanelNav({ items, userName, badges = {} }: { items: PanelNavItem[]; userName: string; badges?: Badges }) {
  const pathname = usePathname();
  const { signOut, pending } = useSignOut();
  const active = (href: string) => (href === "/panel" ? pathname === "/panel" : pathname === href || pathname.startsWith(`${href}/`));
  const primary = items.filter((i) => i.primary).slice(0, 4);
  const moreActive = pathname === "/panel/mas" || items.some((i) => !i.primary && active(i.href));

  return (
    <>
      <nav aria-label="Panel" className="sticky top-0 hidden h-dvh w-[16.5rem] shrink-0 flex-col border-r border-ink/[0.08] bg-white/55 px-3 pt-6 pb-4 backdrop-blur-2xl md:flex">
        <div className="flex items-center gap-3 px-2.5 pb-2">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-navy text-[0.9375rem] font-semibold text-white">
            {initials(userName)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.9375rem] font-semibold text-ink">{userName}</span>
            <span className="block text-[0.8125rem] text-ink-muted">Panel del agente</span>
          </span>
        </div>
        <div className="no-scrollbar mt-2 flex-1 overflow-y-auto">
          {NAV_SECTIONS.map((s) => (
            <div key={s.key} className="mt-4 first:mt-2">
              <p className="px-2.5 pb-1 text-[0.75rem] font-semibold text-ink-muted">{s.label}</p>
              <ul className="space-y-0.5">
                {items
                  .filter((i) => i.section === s.key)
                  .map((i) => {
                    const on = active(i.href);
                    const badge = badges[i.href];
                    return (
                      <li key={i.href}>
                        <Link
                          href={i.href}
                          aria-current={on ? "page" : undefined}
                          className={cn(
                            "group flex min-h-11 items-center gap-3 rounded-[10px] px-2.5 text-[0.9375rem] font-medium focus-visible:-outline-offset-2",
                            tap,
                            on ? "bg-navy text-white" : "text-ink hover:bg-ink/[0.05] active:bg-ink/[0.08]",
                          )}
                        >
                          <Icon name={i.icon} className={cn("size-5 shrink-0", on ? "text-white" : "text-navy")} strokeWidth={on ? 2 : 1.7} />
                          <span className="flex-1 truncate">{i.label}</span>
                          {badge && badge.n > 0 ? (
                            <span className={cn("text-[0.8125rem] font-semibold tabular-nums", on ? "text-white/85" : "text-ink-muted")}>
                              {badge.n}
                              <span className="sr-only"> {badge.label}</span>
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={pending}
          className={cn("mt-2 flex min-h-11 items-center gap-3 rounded-[10px] px-2.5 text-[0.9375rem] font-medium text-ink-muted hover:bg-ink/[0.05] hover:text-ink focus-visible:-outline-offset-2 disabled:opacity-50", tap)}
        >
          <Icon name="logout" className="size-5" />
          {pending ? "Cerrando sesión…" : "Cerrar sesión"}
        </button>
      </nav>

      <nav
        aria-label="Panel"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/75 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl backdrop-saturate-[1.8] md:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {[...primary, { href: "/panel/mas", label: "Más", icon: "more" as IconName }].map((i) => {
            const on = i.href === "/panel/mas" ? moreActive : active(i.href);
            const badge = badges[i.href];
            return (
              <li key={i.href}>
                <Link
                  href={i.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "group flex min-h-[3.25rem] flex-col items-center justify-center gap-[3px] pt-1.5 pb-1 text-[0.6875rem] font-medium tracking-[0.005em] focus-visible:-outline-offset-4",
                    on ? "text-navy" : "text-ink-muted",
                  )}
                >
                  <span className={cn("relative transition-[scale] duration-200 group-active:scale-90", ease)}>
                    <Icon name={i.icon} className="size-[1.625rem]" strokeWidth={on ? 2.1 : 1.6} />
                    {badge && badge.n > 0 ? (
                      <span className="absolute -top-1 -right-2.5 h-[1.125rem] min-w-[1.125rem] rounded-full bg-sold px-1 text-center text-[0.6875rem] leading-[1.125rem] font-semibold text-white tabular-nums ring-2 ring-white">
                        {badge.n > 99 ? "99+" : badge.n}
                        <span className="sr-only"> {badge.label}</span>
                      </span>
                    ) : null}
                  </span>
                  {i.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/** Sign-out row for the mobile "Más" screen (the sidebar has its own). */
export function SignOutRow() {
  const { signOut, pending } = useSignOut();
  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={pending}
      className={cn("flex min-h-12 w-full items-center justify-center px-4 text-base font-medium text-sold hover:bg-ink/[0.025] active:bg-ink/[0.06] focus-visible:rounded-sm focus-visible:-outline-offset-2 disabled:opacity-50", tap)}
    >
      {pending ? "Cerrando sesión…" : "Cerrar sesión"}
    </button>
  );
}
