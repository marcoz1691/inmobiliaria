"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { canTransition, type PropertyStatus } from "@/modules/properties/domain";
import { changeStatusAction, deleteDraftAction, duplicateAction } from "@/app/panel/(app)/propiedades/actions";
import { ConfirmDialog } from "./ConfirmDialog";

type Props = { id: string; title: string; status: PropertyStatus; slug: string };

const itemClass =
  "flex min-h-11 w-full items-center px-4 text-left text-sm text-ink hover:bg-ink/5 disabled:opacity-50";

/** Row actions. Destructive ones (archive, delete, duplicate) ask for confirmation in a modal dialog. */
export function PropertyActions({ id, title, status, slug }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const name = title || "Propiedad sin título";

  function move(to: PropertyStatus, done: string) {
    start(async () => {
      const r = await changeStatusAction(id, to);
      setMessage(r.ok ? { text: done } : { text: r.error, error: true });
      if (r.ok) router.refresh();
    });
  }

  const quick: { to: PropertyStatus; label: string; done: string }[] = [
    { to: "published", label: status === "draft" ? "Publicar" : "Volver a publicar", done: "Publicada." },
    { to: "paused", label: "Pausar", done: "Pausada: ya no aparece en el sitio." },
    { to: "reserved", label: "Marcar reservada", done: "Marcada como reservada." },
    { to: "sold", label: "Marcar vendida", done: "Marcada como vendida." },
    { to: "rented", label: "Marcar alquilada", done: "Marcada como alquilada." },
  ];
  const available = quick.filter((q) => canTransition(status, q.to));
  const isPublic = ["published", "reserved", "sold", "rented"].includes(status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/panel/propiedades/${id}`}
        className="inline-flex min-h-11 items-center rounded-full border border-ink/80 px-4 text-sm font-medium text-ink hover:bg-ink hover:text-paper"
      >
        Editar<span className="sr-only"> {name}</span>
      </Link>
      <details className="group relative">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-full px-4 text-sm font-medium text-ink hover:bg-ink/5 [&::-webkit-details-marker]:hidden">
          Más acciones<span className="sr-only"> para {name}</span>
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="m5 8 5 5 5-5" />
          </svg>
        </summary>
        <div className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-sm border border-line bg-white py-1 shadow-sm">
          {available.map((q) => (
            <button key={q.to} type="button" className={itemClass} disabled={pending} onClick={() => move(q.to, q.done)}>
              {q.label}
            </button>
          ))}
          {isPublic ? (
            <a href={`/propiedades/${slug}`} target="_blank" rel="noopener noreferrer" className={itemClass}>
              Ver en el sitio<span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
          ) : null}
          <ConfirmDialog
            title="¿Duplicar esta propiedad?"
            description={<>Se creará un borrador con los mismos datos y fotos de «{name}». La original no cambia.</>}
            confirmLabel="Duplicar"
            onConfirm={async () => {
              const r = await duplicateAction(id);
              if (!r.ok) return r.error;
              setMessage({ text: "Copia creada como borrador." });
              router.refresh();
            }}
            trigger={(open) => (
              <button type="button" className={itemClass} onClick={open}>
                Duplicar
              </button>
            )}
          />
          {canTransition(status, "archived") ? (
            <ConfirmDialog
              destructive
              title="¿Archivar esta propiedad?"
              description={<>«{name}» dejará de verse en el sitio y su enlace mostrará que ya no está disponible. Puedes recuperarla como borrador después.</>}
              confirmLabel="Archivar"
              onConfirm={async () => {
                const r = await changeStatusAction(id, "archived");
                if (!r.ok) return r.error;
                setMessage({ text: "Archivada." });
                router.refresh();
              }}
              trigger={(open) => (
                <button type="button" className={itemClass} onClick={open}>
                  Archivar
                </button>
              )}
            />
          ) : null}
          {status === "archived" ? (
            <button type="button" className={itemClass} disabled={pending} onClick={() => move("draft", "Recuperada como borrador.")}>
              Recuperar como borrador
            </button>
          ) : null}
          {status === "draft" ? (
            <ConfirmDialog
              destructive
              title="¿Eliminar este borrador?"
              description={<>Se borrarán «{name}» y sus fotos. Esta acción no se puede deshacer.</>}
              confirmLabel="Eliminar borrador"
              onConfirm={async () => {
                const r = await deleteDraftAction(id);
                if (!r.ok) return r.error;
                router.refresh();
              }}
              trigger={(open) => (
                <button type="button" className={`${itemClass} text-sold`} onClick={open}>
                  Eliminar borrador
                </button>
              )}
            />
          ) : null}
        </div>
      </details>
      <p role="status" className={message?.error ? "w-full text-sm font-medium text-sold" : "w-full text-sm text-ink-muted empty:hidden"}>
        {message?.text}
        {message?.error && status === "draft" ? (
          <>
            {" "}
            <Link href={`/panel/propiedades/${id}?paso=revisar`} className="underline underline-offset-4">
              Completar datos
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
