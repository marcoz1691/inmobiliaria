"use client";

import { useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

type ShareButtonsProps = { url: string; title: string };

const linkClass =
  "inline-flex min-h-11 items-center rounded-full bg-sand px-5 text-[0.9375rem] font-medium text-ink transition-colors duration-300 ease-apple hover:bg-ink hover:text-white";

/** Native share sheet when available, copy-link fallback, plus plain share links (no SDKs). */
export function ShareButtons({ url, title }: ShareButtonsProps) {
  // Feature detection runs in the browser; the server (and the first paint) render the fallback.
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const [status, setStatus] = useState("");

  async function share() {
    try {
      await navigator.share({ title, url });
    } catch {
      /* dismissed by the user */
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Enlace copiado");
    } catch {
      setStatus("No se pudo copiar. Copia la dirección desde el navegador.");
    }
  }

  const enc = encodeURIComponent;
  const links = [
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${title} ${url}`)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: "X", href: `https://x.com/intent/post?text=${enc(title)}&url=${enc(url)}` },
  ];

  return (
    <div>
      <h2 className="text-eyebrow text-ink">Compartir</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        <li>
          {canShare ? (
            <button type="button" onClick={share} className={linkClass}>
              Compartir
            </button>
          ) : (
            <button type="button" onClick={copy} className={linkClass}>
              Copiar enlace
            </button>
          )}
        </li>
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {l.label}
              <span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
          </li>
        ))}
      </ul>
      <p role="status" className="mt-2 min-h-5 text-sm text-ink-muted">
        {status}
      </p>
    </div>
  );
}
