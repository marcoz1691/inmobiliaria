"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { canTransition, type PropertyStatus } from "@/modules/properties/domain";
import { changeStatusAction, deleteDraftAction, duplicateAction } from "@/app/panel/(app)/propiedades/actions";
import { cn } from "@/components/ui/cn";
import { ConfirmDialog } from "./ConfirmDialog";
import { Icon, type IconName } from "./ui/Icon";
import { ease, press, tap } from "./ui/motion";
import { useToast } from "./ui/Toast";

type Props = { id: string; title: string; status: PropertyStatus; slug: string };

const itemClass = cn(
  "flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-[0.9375rem] text-ink hover:bg-ink/[0.05] active:bg-ink/[0.08] focus-visible:-outline-offset-2 disabled:opacity-40",
  tap,
);
const sep = "border-t border-line/70";

function Item({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <>
      <span>{children}</span>
      <Icon name={icon} className="size-[1.125rem] shrink-0 opacity-80" />
    </>
  );
}

/** Row actions in a context menu. Destructive ones (archive, delete, duplicate) ask in a sheet. */
export function PropertyActions({ id, title, status, slug }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const name = title || "Propiedad sin título";
  const menu = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => {
    if (menu.current) menu.current.open = false;
  };

  function move(to: PropertyStatus, done: string) {
    start(async () => {
      const r = await changeStatusAction(id, to);
      closeMenu();
      if (r.ok) {
        setError(null);
        toast.success(done);
        router.refresh();
      } else setError(r.error);
    });
  }

  const quick: { to: PropertyStatus; label: string; done: string; icon: IconName }[] = [
    { to: "published", label: status === "draft" ? "Publicar" : "Volver a publicar", done: "Publicada.", icon: "globe" },
    { to: "paused", label: "Pausar", done: "Pausada: ya no aparece en el sitio.", icon: "eye" },
    { to: "reserved", label: "Marcar reservada", done: "Marcada como reservada.", icon: "clock" },
    { to: "sold", label: "Marcar vendida", done: "Marcada como vendida.", icon: "checkCircle" },
    { to: "rented", label: "Marcar alquilada", done: "Marcada como alquilada.", icon: "checkCircle" },
  ];
  const available = quick.filter((q) => canTransition(status, q.to));
  const isPublic = ["published", "reserved", "sold", "rented"].includes(status);
  const pillClass = cn("inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[0.9375rem] font-medium", tap, press);

  return (
    <div className="flex flex-wrap items-start gap-2">
      <Link href={`/panel/propiedades/${id}`} className={cn(pillClass, "bg-navy/10 font-semibold text-navy hover:bg-navy/15")}>
        <Icon name="pencil" className="size-4" strokeWidth={2} />
        Editar<span className="sr-only"> {name}</span>
      </Link>
      <details ref={menu} className="group relative max-sm:flex-1">
        <summary className={cn(pillClass, "cursor-pointer list-none bg-ink/[0.06] text-ink hover:bg-ink/10 [&::-webkit-details-marker]:hidden")}>
          Más acciones<span className="sr-only"> para {name}</span>
          <Icon name="chevronDown" className={cn("size-4 transition-transform duration-300 group-open:rotate-180", ease)} strokeWidth={2.2} />
        </summary>
        <div
          className={cn(
            "mt-2 w-full overflow-hidden rounded-sm bg-white/95 py-1 ring-1 ring-ink/[0.06] backdrop-blur-xl sm:absolute sm:right-0 sm:z-20 sm:w-64",
            "shadow-[0_18px_50px_-12px_rgba(0,0,0,0.25)]",
            "origin-top-right transition-[opacity,scale] duration-300",
            ease,
            "starting:scale-95 starting:opacity-0",
          )}
        >
          {available.map((q) => (
            <button key={q.to} type="button" className={itemClass} disabled={pending} onClick={() => move(q.to, q.done)}>
              <Item icon={q.icon}>{q.label}</Item>
            </button>
          ))}
          {isPublic ? (
            <a href={`/propiedades/${slug}`} target="_blank" rel="noopener noreferrer" className={itemClass}>
              <Item icon="external">
                Ver en el sitio<span className="sr-only"> (se abre en una pestaña nueva)</span>
              </Item>
            </a>
          ) : null}
          <div className={sep}>
            <ConfirmDialog
              title="¿Duplicar esta propiedad?"
              description={<>Se creará un borrador con los mismos datos y fotos de «{name}» y se abrirá para que lo edites. La original no cambia.</>}
              confirmLabel="Duplicar"
              onConfirm={async () => {
                const r = await duplicateAction(id);
                if (!r.ok) return r.error;
                toast.success("Copia creada como borrador.");
                closeMenu();
                router.push(`/panel/propiedades/${r.data.id}`);
              }}
              trigger={(open) => (
                <button type="button" className={itemClass} onClick={open}>
                  <Item icon="copy">Duplicar</Item>
                </button>
              )}
            />
            {status === "archived" ? (
              <button type="button" className={itemClass} disabled={pending} onClick={() => move("draft", "Recuperada como borrador.")}>
                <Item icon="arrowUp">Recuperar como borrador</Item>
              </button>
            ) : null}
          </div>
          {canTransition(status, "archived") || status === "draft" ? (
            <div className={sep}>
              {canTransition(status, "archived") ? (
                <ConfirmDialog
                  destructive
                  title="¿Archivar esta propiedad?"
                  description={<>«{name}» dejará de verse en el sitio y su enlace mostrará que ya no está disponible. Puedes recuperarla como borrador después.</>}
                  confirmLabel="Archivar"
                  onConfirm={async () => {
                    const r = await changeStatusAction(id, "archived");
                    if (!r.ok) return r.error;
                    toast.success("Archivada.");
                    closeMenu();
                    router.refresh();
                  }}
                  trigger={(open) => (
                    <button type="button" className={itemClass} onClick={open}>
                      <Item icon="tray">Archivar</Item>
                    </button>
                  )}
                />
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
                    toast.success("Borrador eliminado.");
                    closeMenu();
                    router.refresh();
                  }}
                  trigger={(open) => (
                    <button type="button" className={cn(itemClass, "text-sold")} onClick={open}>
                      <Item icon="trash">Eliminar borrador</Item>
                    </button>
                  )}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </details>
      {error ? (
        <p role="alert" className="w-full text-sm font-medium text-sold">
          {error}
          {status === "draft" ? (
            <>
              {" "}
              <Link href={`/panel/propiedades/${id}?paso=revisar`} className="underline underline-offset-4">
                Completar datos
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
