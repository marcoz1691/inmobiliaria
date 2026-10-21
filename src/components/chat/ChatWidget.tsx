"use client";

import { Fragment, useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

type Msg = { role: "user" | "assistant"; text: string };
type Availability = "unknown" | "available" | "unavailable";

export type ChatWidgetProps = {
  /** Agent's WhatsApp link (e.g. https://wa.me/593…), shown as the alternative when the assistant is unavailable. */
  whatsappHref?: string | null;
  /** Contact form. */
  contactHref?: string;
  className?: string;
};

const STORAGE_KEY = "chat-widget:v1";
const SUGGESTIONS = ["¿Qué casas tienes en venta?", "Busco departamento en alquiler", "Quiero agendar una visita"];

function load(): { token: string | null; messages: Msg[] } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const v = JSON.parse(raw) as { token?: unknown; messages?: unknown };
      if (Array.isArray(v.messages)) return { token: typeof v.token === "string" ? v.token : null, messages: v.messages.slice(-40) as Msg[] };
    }
  } catch {
    /* storage unavailable: start fresh */
  }
  return { token: null, messages: [] };
}

function save(token: string | null, messages: Msg[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, messages: messages.slice(-40) }));
  } catch {
    /* ignore */
  }
}

const URL_RE = /(https?:\/\/[^\s<>"')]+|\/(?:propiedades|agenda|contacto)[^\s<>"')]*)/g;

/** Plain text with links. Model output is never injected as HTML. */
function RichText({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const href = part.replace(/[.,;:!?]+$/, "");
        const tail = part.slice(href.length);
        let sameSite = href.startsWith("/");
        try {
          sameSite ||= new URL(href).origin === window.location.origin;
        } catch {
          /* keep as external */
        }
        return (
          <Fragment key={i}>
            <a
              href={href}
              className="break-words text-link underline underline-offset-2"
              {...(sameSite ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            >
              {href}
              {!sameSite && <span className="sr-only"> (se abre en una pestaña nueva)</span>}
            </a>
            {tail}
          </Fragment>
        );
      })}
    </>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-5" aria-hidden="true">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-5" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

const action =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[0.9375rem] font-medium transition-colors duration-300 ease-apple " +
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-navy";

/**
 * Site assistant: a discreet launcher and an accessible modal dialog (native <dialog>: focus is
 * trapped, Escape closes and focus returns to the launcher). When the assistant has no API key it
 * says so and offers WhatsApp or the contact form instead.
 */
export function ChatWidget({ whatsappHref, contactHref = "/contacto", className }: ChatWidgetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>("unknown");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const noticeId = useId();
  const errorId = useId();

  useEffect(() => {
    const s = load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from sessionStorage after mount
    setMessages(s.messages);
    setToken(s.token);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, pending]);

  const checkAvailability = useCallback(async () => {
    try {
      const res = await fetch("/api/chat", { cache: "no-store" });
      const data = (await res.json()) as { available?: boolean };
      setAvailability(data.available ? "available" : "unavailable");
    } catch {
      setAvailability("unavailable");
    }
  }, []);

  function openPanel() {
    dialogRef.current?.showModal();
    setOpen(true);
    if (availability === "unknown") void checkAvailability();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function closePanel() {
    dialogRef.current?.close();
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setError(null);
    const next = [...messages, { role: "user" as const, text: message }];
    setMessages(next);
    setDraft("");
    setPending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, token }),
      });
      const data = (await res.json()) as { status: string; reply?: string; conversationToken?: string; error?: string };
      if (data.status === "unavailable") {
        setAvailability("unavailable");
        setMessages(messages);
        setDraft(message);
        return;
      }
      if ((data.status === "ok" || data.status === "limit") && data.reply) {
        const withReply = [...next, { role: "assistant" as const, text: data.reply }];
        setMessages(withReply);
        setToken(data.conversationToken ?? token);
        save(data.conversationToken ?? token, withReply);
        return;
      }
      setError(data.error ?? "No pudimos enviar tu mensaje. Inténtalo de nuevo.");
    } catch {
      setError("Sin conexión. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const hp = new FormData(e.currentTarget).get("website");
    if (typeof hp === "string" && hp) return;
    void send(draft);
  }

  const alternatives: ReactNode = (
    <div className="flex flex-wrap gap-2">
      {whatsappHref && (
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={cn(action, "bg-navy text-white hover:bg-navy-hover")}>
          Escribir por WhatsApp<span className="sr-only"> (se abre en una pestaña nueva)</span>
        </a>
      )}
      <a href={contactHref} className={cn(action, "border border-navy text-navy hover:bg-navy hover:text-white")}>
        Ir al formulario de contacto
      </a>
    </div>
  );

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={openPanel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[0.9375rem] font-medium",
          "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-navy",
          // Sits above the mobile sticky action bar while one is shown (--sticky-cta-h).
          "glass fixed right-4 bottom-[calc(1rem+var(--sticky-cta-h))] z-40 border border-ink/10 text-ink shadow-[0_10px_30px_-10px_rgb(0_0_0/0.35)]",
          "transition-[bottom,background-color] duration-500 ease-apple hover:bg-white sm:right-6 sm:bottom-[calc(1.5rem+var(--sticky-cta-h))]",
          className,
        )}
      >
        <ChatIcon />
        Preguntar
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={noticeId}
        onClose={() => {
          setOpen(false);
          launcherRef.current?.focus();
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) closePanel();
        }}
        className={cn(
          "fixed inset-x-0 top-auto bottom-0 m-0 h-[min(88dvh,40rem)] w-full max-w-none overflow-hidden rounded-t-lg bg-paper p-0 text-ink",
          "shadow-[0_24px_60px_-12px_rgb(0_0_0/0.35)] backdrop:bg-night/30 backdrop:backdrop-blur-sm open:animate-[rise_0.45s_var(--ease-apple)_both]",
          "sm:inset-x-auto sm:right-6 sm:bottom-6 sm:h-[min(80dvh,38rem)] sm:w-[25rem] sm:rounded-lg",
        )}
      >
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-line px-5 pt-5 pb-4">
            <div>
              <h2 id={titleId} className="text-headline">
                Asistente del sitio
              </h2>
              <p id={noticeId} className="mt-1 text-sm text-ink-muted">
                Asistente automático; un agente humano puede continuar la conversación.
              </p>
            </div>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Cerrar el asistente"
              className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-navy"
            >
              <CloseIcon />
            </button>
          </header>

          <div ref={logRef} role="log" aria-live="polite" aria-busy={pending} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {availability === "unavailable" ? (
              <div className="space-y-4 rounded-md bg-sand p-4" role="status">
                <p className="text-base">El asistente automático no está disponible en este momento.</p>
                <p className="text-sm text-ink-muted">Puedes escribirle directamente al agente o dejar tu consulta en el formulario.</p>
                {alternatives}
              </div>
            ) : (
              <>
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-base">Hola. Te ayudo a encontrar propiedades publicadas en este sitio o a agendar una cita.</p>
                    <ul className="flex flex-wrap gap-2" aria-label="Sugerencias">
                      {SUGGESTIONS.map((s) => (
                        <li key={s}>
                          <button
                            type="button"
                            onClick={() => void send(s)}
                            disabled={availability !== "available" || pending}
                            className="min-h-11 rounded-full bg-sand px-4 text-left text-[0.9375rem] transition-colors duration-300 ease-apple hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-navy disabled:opacity-50"
                          >
                            {s}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <p
                      className={cn(
                        "max-w-[85%] rounded-[1.25rem] px-4 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap",
                        m.role === "user" ? "rounded-br-md bg-navy text-white" : "rounded-bl-md bg-mist text-ink",
                      )}
                    >
                      <span className="sr-only">{m.role === "user" ? "Tú: " : "Asistente: "}</span>
                      {m.role === "assistant" ? <RichText text={m.text} /> : m.text}
                    </p>
                  </div>
                ))}
                {pending && (
                  <p className="text-sm text-ink-muted">
                    <span className="animate-shimmer">Escribiendo…</span>
                  </p>
                )}
              </>
            )}
          </div>

          {availability !== "unavailable" && (
            <form onSubmit={onSubmit} className="border-t border-line px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]" noValidate>
              {error && (
                <p id={errorId} role="alert" className="mb-2 text-sm text-sold">
                  {error}
                </p>
              )}
              <div className="hidden" aria-hidden="true">
                <label>
                  No llenes este campo
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              <label htmlFor={`${titleId}-input`} className="sr-only">
                Escribe tu pregunta
              </label>
              <div className="flex items-end gap-2">
                <textarea
                  id={`${titleId}-input`}
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void send(draft);
                    }
                  }}
                  rows={1}
                  maxLength={1000}
                  placeholder="Escribe tu pregunta"
                  aria-describedby={error ? errorId : undefined}
                  disabled={availability === "unknown"}
                  className="min-h-11 flex-1 resize-none rounded-[1.375rem] border border-line-strong bg-white px-4 py-2.5 text-base placeholder:text-ink-muted focus-visible:border-navy focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy"
                />
                <button type="submit" disabled={pending || !draft.trim() || availability !== "available"} className={cn(action, "bg-navy text-white hover:bg-navy-hover disabled:opacity-50")}>
                  Enviar
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
