"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/admin/ui/Button";
import { ListGroup, ListItem } from "@/components/admin/ui/ListGroup";
import { useToast } from "@/components/admin/ui/Toast";
import { addNoteAction, addTaskAction, toggleTaskAction } from "@/app/panel/(app)/prospectos/actions";
import { inputClass } from "./fields";

export function NoteForm({ dealId }: { dealId: string }) {
  const id = useId();
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addNoteAction(dealId, body);
          if (r.ok) {
            setBody("");
            setError(null);
            toast.success("Nota guardada.");
            router.refresh();
          } else setError(r.error);
        });
      }}
    >
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        Nueva nota
      </label>
      <textarea
        id={id}
        rows={3}
        value={body}
        maxLength={4000}
        onChange={(e) => setBody(e.target.value)}
        className={`${inputClass} py-2`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-e` : undefined}
      />
      {error ? (
        <p id={`${id}-e`} className="mt-1 text-sm font-medium text-sold">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="tinted" className="mt-3 w-full sm:w-auto" pending={pending} disabled={!body.trim()}>
        {pending ? "Guardando…" : "Guardar nota"}
      </Button>
    </form>
  );
}

export type TaskItem = { id: string; title: string; dueAt: string | null; doneAt: string | null };
const fmt = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });

export function Tasks({ dealId, tasks }: { dealId: string; tasks: TaskItem[] }) {
  const id = useId();
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      {tasks.length ? (
        <ListGroup className="mb-4" aria-label="Tareas del prospecto">
          {tasks.map((t) => (
            <ListItem key={t.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2">
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-navy"
                  checked={Boolean(t.doneAt)}
                  onChange={() =>
                    start(async () => {
                      const r = await toggleTaskAction(dealId, t.id);
                      if (r.ok) {
                        toast.success(t.doneAt ? "Tarea reabierta." : "Tarea marcada como hecha.");
                        router.refresh();
                      } else setError(r.error);
                    })
                  }
                />
                <span className={t.doneAt ? "text-ink-muted line-through" : "text-ink"}>
                  {t.title}
                  {t.dueAt ? <span className="block text-sm text-ink-muted no-underline">Vence: {fmt.format(new Date(t.dueAt))}</span> : null}
                </span>
              </label>
            </ListItem>
          ))}
        </ListGroup>
      ) : (
        <p className="mb-4 text-sm text-ink-muted">Sin tareas.</p>
      )}
      <form
        className="grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addTaskAction(dealId, { title, dueAt: due || undefined });
            if (r.ok) {
              setTitle("");
              setDue("");
              setError(null);
              toast.success("Tarea agregada.");
              router.refresh();
            } else setError(r.error);
          });
        }}
      >
        <div>
          <label htmlFor={`${id}-t`} className="block text-sm font-medium text-ink">
            Nueva tarea
          </label>
          <input id={`${id}-t`} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Ej.: Enviar fotos adicionales" />
        </div>
        <div>
          <label htmlFor={`${id}-d`} className="block text-sm font-medium text-ink">
            Vence <span className="font-normal text-ink-muted">(opcional)</span>
          </label>
          <input id={`${id}-d`} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} />
        </div>
        <Button type="submit" variant="tinted" className="w-full sm:w-auto" pending={pending} disabled={title.trim().length < 2}>
          Agregar
        </Button>
      </form>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-sold">
          {error}
        </p>
      ) : null}
    </div>
  );
}
