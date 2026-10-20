"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import type { NavItem } from "./SiteHeader";

type MobileNavProps = { nav: NavItem[]; ctaHref: string; ctaLabel: string };

/**
 * Full-screen disclosure navigation for small screens: Escape closes and returns focus to the
 * toggle, page scroll is locked while open, links rise in one after another.
 */
export function MobileNav({ nav, ctaHref, ctaLabel }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !toggleRef.current?.contains(target)) setOpen(false);
    };
    // Back to the desktop layout: the panel no longer exists, so don't keep the page locked.
    const desktop = window.matchMedia("(min-width: 768px)");
    const onResize = () => desktop.matches && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    desktop.addEventListener("change", onResize);
    return () => {
      root.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      desktop.removeEventListener("change", onResize);
    };
  }, [open]);

  const rise = (i: number): CSSProperties => ({ animationDelay: `${60 + i * 50}ms` });

  return (
    <div className="md:hidden">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="-mr-3 inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-ink/5"
      >
        <span className="sr-only">{open ? "Cerrar menú" : "Abrir menú"}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          {open ? <path d="m5 5 10 10M15 5 5 15" /> : <path d="M3 7.5h14M3 12.5h14" />}
        </svg>
      </button>

      <div
        ref={panelRef}
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full h-[calc(100dvh-3.25rem)] overflow-y-auto bg-paper px-6 pt-6 pb-10 sm:px-8"
      >
        <nav aria-label="Principal (móvil)">
          <ul className="flex flex-col">
            {nav.map((item, i) => (
              <li key={item.href} className="animate-rise" style={rise(i)}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-14 items-center text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-8 animate-rise" style={rise(nav.length)}>
          <Button href={ctaHref} size="lg" className="w-full" onClick={() => setOpen(false)}>
            {ctaLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
