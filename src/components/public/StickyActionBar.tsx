"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

type StickyActionBarProps = {
  /** id of the in-page block with the same actions; the bar shows once it has scrolled past. */
  watchId: string;
  children: ReactNode;
};

/**
 * Mobile bottom bar that slides up when the page's main action block leaves the viewport
 * upwards, so the primary action stays within thumb reach without repeating it on first view.
 * While shown it sets `data-sticky-cta`, which reserves space at the end of the page and lifts
 * the chat launcher (see globals.css).
 */
export function StickyActionBar({ watchId, children }: StickyActionBarProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const target = document.getElementById(watchId);
    if (!target) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry) setShown(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    io.observe(target);
    return () => io.disconnect();
  }, [watchId]);

  return (
    <div
      data-sticky-cta={shown ? "" : undefined}
      inert={!shown}
      className={cn(
        "glass fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 pb-[env(safe-area-inset-bottom)] transition-transform duration-500 ease-apple lg:hidden",
        shown ? "translate-y-0" : "translate-y-full",
      )}
    >
      {children}
    </div>
  );
}
