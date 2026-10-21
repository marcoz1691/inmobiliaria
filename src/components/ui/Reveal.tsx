"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  /** Stagger offset in ms, e.g. `index * 80` inside a grid. */
  delay?: number;
  className?: string;
};

let observer: IntersectionObserver | null = null;

function sharedObserver(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.reveal = "shown";
        observer?.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
  );
  return observer;
}

/**
 * Fades and lifts its content in the first time it scrolls into view. Content is server-rendered
 * visible; it is hidden only after hydration and only when it starts below the fold, so there is
 * no flash, no layout shift and no delay to first paint. Reduced motion leaves it untouched.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.dataset.reveal = "hidden";
    const io = sharedObserver();
    io.observe(el);
    return () => io.unobserve(el);
  }, []);

  return (
    <div ref={ref} className={className} style={delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined}>
      {children}
    </div>
  );
}
