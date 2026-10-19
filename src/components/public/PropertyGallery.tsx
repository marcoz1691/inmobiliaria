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
 * Desktop: editorial grid (one lead photo + up to four). Mobile: scroll-snap carousel.
 * Any photo opens a modal lightbox (native <dialog>: focus is trapped, Escape closes),
 * with arrow-key and button navigation.
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
    if (!el || el.clientWidth === 0) return;
    setSlide(Math.round(el.scrollLeft / el.clientWidth));
  }

  if (count === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-sm bg-sand text-sm text-ink-muted">
        Fotos próximamente
      </div>
    );
  }

  const label = (i: number) => `Ampliar foto ${i + 1} de ${count}: ${images[i]?.alt ?? ""}`;
  const grid = images.slice(0, count >= GRID_MAX ? GRID_MAX : count >= 3 ? 3 : count);
  const current = active === null ? null : images[active];

  return (
    <section aria-label={`Fotos de ${title}`}>
      {/* Mobile carousel */}
      <div className="relative -mx-5 sm:-mx-8 lg:hidden">
        <ul
          ref={trackRef}
          onScroll={onTrackScroll}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        >
          {images.map((img, i) => (
            <li key={img.src + i} className="w-full shrink-0 snap-center">
              <button
                type="button"
                aria-label={label(i)}
                onClick={(e) => open(i, e.currentTarget)}
                className="relative block aspect-[4/3] w-full bg-sand focus-visible:-outline-offset-4 focus-visible:outline-white"
              >
                <Image src={img.src} unoptimized={isUnsizedSource(img.src)} alt="" fill sizes="100vw" preload={i === 0} className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
        <p
          aria-hidden="true"
          className="pointer-events-none absolute right-4 bottom-4 rounded-full bg-ink/80 px-3 py-1 text-xs font-medium text-white tabular-nums"
        >
          {Math.min(slide + 1, count)} / {count}
        </p>
      </div>

      {/* Desktop editorial grid */}
      <ul
        className={cn(
          "hidden gap-2 lg:grid",
          grid.length === GRID_MAX
            ? "aspect-[2/1] grid-cols-4 grid-rows-2"
            : grid.length === 3
              ? "aspect-[2/1] grid-cols-3 grid-rows-2"
              : grid.length === 2
                ? "aspect-[2/1] grid-cols-2"
                : "aspect-[16/9] grid-cols-1",
        )}
      >
        {grid.map((img, i) => (
          <li
            key={img.src + i}
            className={cn("relative", i === 0 && grid.length >= 3 && "col-span-2 row-span-2")}
          >
            <button
              type="button"
              aria-label={
                i === grid.length - 1 && count > grid.length ? `Ver las ${count} fotos. ${label(i)}` : label(i)
              }
              onClick={(e) => open(i, e.currentTarget)}
              className="group absolute inset-0 overflow-hidden rounded-sm bg-sand"
            >
              <Image
                src={img.src}
                unoptimized={isUnsizedSource(img.src)}
                alt=""
                fill
                preload={i === 0}
                sizes={i === 0 ? "(min-width: 1280px) 640px, 50vw" : "(min-width: 1280px) 320px, 25vw"}
                className="object-cover transition-transform duration-500 ease-out-quart group-hover:scale-[1.02]"
              />
              {i === grid.length - 1 && count > grid.length ? (
                <span className="absolute right-3 bottom-3 rounded-full bg-paper px-3 py-1.5 text-sm font-medium text-ink">
                  Ver las {count} fotos
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-label={`Fotos de ${title}`}
        onClose={onDialogClose}
        onKeyDown={onDialogKey}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-ink p-0 text-white backdrop:bg-ink"
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
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline-white"
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
                  className="object-contain"
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
      className="inline-flex size-12 items-center justify-center rounded-full border border-white/40 text-white hover:bg-white/10 focus-visible:outline-white"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d={prev ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"} />
      </svg>
    </button>
  );
}
