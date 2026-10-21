"use client";

import Image from "next/image";
import { isUnsizedSource } from "@/lib/image-loader";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import type { PublicImage } from "./types";

type PropertyGalleryProps = {
  images: PublicImage[];
  /** Property title, used to label the gallery and the dialog. */
  title: string;
};

const GRID_MAX = 5;

/**
 * One list of photos, two layouts: a swipeable carousel with the next photo peeking (mobile) and
 * a rounded mosaic of up to five (desktop). A single image tree means the lead photo is fetched
 * once, eagerly, as the LCP. Any photo opens a modal lightbox (native <dialog>: focus is trapped,
 * Escape closes) with arrow-key and button navigation.
 */
export function PropertyGallery({ images, title }: PropertyGalleryProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [slide, setSlide] = useState(0);
  const count = images.length;

  const open = useCallback((index: number, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setActive(index);
    dialogRef.current?.showModal();
  }, []);

  const close = useCallback(() => dialogRef.current?.close(), []);
  const step = useCallback(
    (delta: number) => setActive((i) => (i === null ? i : (i + delta + count) % count)),
    [count],
  );

  // Lock page scroll while the lightbox is open.
  useEffect(() => {
    if (active === null) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev;
    };
  }, [active]);

  function onDialogClose() {
    setActive(null);
    triggerRef.current?.focus();
  }

  function onDialogKey(e: React.KeyboardEvent<HTMLDialogElement>) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  }

  function onTrackScroll() {
    const el = trackRef.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first || first.offsetWidth === 0) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    setSlide(Math.round(el.scrollLeft / (first.offsetWidth + gap)));
  }

  if (count === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-md bg-sand text-sm text-ink-muted">
        Fotos próximamente
      </div>
    );
  }

  const label = (i: number) => `Ampliar foto ${i + 1} de ${count}: ${images[i]?.alt ?? ""}`;
  const gridCount = count >= GRID_MAX ? GRID_MAX : count >= 3 ? 3 : count;
  const current = active === null ? null : images[active];

  return (
    <section aria-label={`Fotos de ${title}`} className="relative">
      <ul
        ref={trackRef}
        onScroll={onTrackScroll}
        className={cn(
          "no-scrollbar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto overscroll-x-contain px-5 sm:-mx-8 sm:scroll-px-8 sm:px-8",
          "lg:mx-0 lg:grid lg:overflow-visible lg:px-0",
          gridCount === GRID_MAX
            ? "lg:aspect-[2/1] lg:grid-cols-4 lg:grid-rows-2"
            : gridCount === 3
              ? "lg:aspect-[2/1] lg:grid-cols-3 lg:grid-rows-2"
              : gridCount === 2
                ? "lg:aspect-[2/1] lg:grid-cols-2"
                : "lg:aspect-[16/9] lg:grid-cols-1",
        )}
      >
        {images.map((img, i) => {
          const lead = i === 0;
          const lastTile = i === gridCount - 1 && count > gridCount;
          return (
            <li
              key={img.src + i}
              className={cn(
                "relative aspect-[4/3] shrink-0 snap-center lg:aspect-auto",
                count > 1 ? "w-[88%] sm:w-[70%] lg:w-auto" : "w-full",
                lead && gridCount >= 3 && "lg:col-span-2 lg:row-span-2",
                i >= gridCount && "lg:hidden",
              )}
            >
              <button
                type="button"
                aria-label={lastTile ? `Ver las ${count} fotos. ${label(i)}` : label(i)}
                onClick={(e) => open(i, e.currentTarget)}
                className="group absolute inset-0 overflow-hidden rounded-md bg-sand lg:rounded-sm"
              >
                <Image
                  src={img.src}
                  unoptimized={isUnsizedSource(img.src)}
                  alt=""
                  fill
                  loading={lead ? "eager" : "lazy"}
                  fetchPriority={lead ? "high" : undefined}
                  placeholder={img.blurDataUrl ? "blur" : "empty"}
                  blurDataURL={img.blurDataUrl}
                  sizes={lead ? "(min-width: 1280px) 640px, (min-width: 1024px) 50vw, 88vw" : "(min-width: 1280px) 320px, (min-width: 1024px) 25vw, 88vw"}
                  className="object-cover transition-transform duration-[1200ms] ease-apple group-hover:scale-[1.04]"
                />
                {lastTile ? (
                  <span className="absolute right-4 bottom-4 hidden rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-ink shadow-[0_1px_4px_rgb(0_0_0/0.12)] backdrop-blur-md lg:inline-flex">
                    Ver las {count} fotos
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {count > 1 ? (
        <p
          aria-hidden="true"
          className="pointer-events-none absolute right-4 bottom-4 rounded-full bg-ink/70 px-3 py-1 text-xs font-medium text-white tabular-nums backdrop-blur-md sm:right-6 lg:hidden"
        >
          {Math.min(slide + 1, count)} / {count}
        </p>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-label={`Fotos de ${title}`}
        onClose={onDialogClose}
        onKeyDown={onDialogKey}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-night p-0 text-white backdrop:bg-night open:animate-fade"
      >
        {current && active !== null ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <p aria-live="polite" className="text-sm text-paper-muted tabular-nums">
                Foto {active + 1} de {count}
              </p>
              <button
                type="button"
                onClick={close}
                autoFocus
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-white"
              >
                Cerrar
                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="m5 5 10 10M15 5 5 15" />
                </svg>
              </button>
            </div>

            <figure className="relative flex min-h-0 flex-1 flex-col">
              <div className="relative min-h-0 flex-1">
                <Image
                  key={current.src + active}
                  src={current.src}
                  unoptimized={isUnsizedSource(current.src)}
                  alt={current.alt}
                  fill
                  sizes="100vw"
                  className="animate-fade object-contain"
                />
              </div>
              <figcaption className="px-4 py-3 text-center text-sm text-paper-muted sm:px-6">{current.alt}</figcaption>
            </figure>

            {count > 1 ? (
              <div className="flex items-center justify-center gap-3 px-4 pb-6">
                <LightboxNav direction="prev" onClick={() => step(-1)} />
                <LightboxNav direction="next" onClick={() => step(1)} />
              </div>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </section>
  );
}

function LightboxNav({ direction, onClick }: { direction: "prev" | "next"; onClick: () => void }) {
  const prev = direction === "prev";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={prev ? "Foto anterior" : "Foto siguiente"}
      className="inline-flex size-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-white"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12.5 4.5 7 10l5.5 5.5" transform={prev ? undefined : "rotate(180 10 10)"} />
      </svg>
    </button>
  );
}
