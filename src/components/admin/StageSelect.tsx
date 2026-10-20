"use client";
import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveDealAction } from "@/app/panel/(app)/prospectos/actions";
import { Button } from "@/components/ui/Button";
import { inputClass, selectClass } from "./fields";

export type StageOption = { value: string; label: string };

/** Stage picker (accessible alternative to kanban drag). "Perdido" asks for the reason first. */
export function StageSelect({ dealId, stage, stages, contactName, compact }: { dealId: string; stage: string; stages: StageOption[]; contactName: string; compact?: boolean }) {
  const label = (v: string) => stages.find((s) => s.value === v)?.label ?? v;
  const id = useId();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(stage);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();

  function commit(next: string, lostReason?: string) {
    start(async () => {
      const r = await moveDealAction(dealId, { stage: next, lostReason });
      if (r.ok) {
        setValue(next);
        setMsg({ text: `Movido a «${label(next)}».` });
        dialog.current?.close();
        router.refresh();
      } else setMsg({ text: r.error, error: true });
    });
  }

  return (
    <div>
      <label htmlFor={id} className={compact ? "sr-only" : "block text-sm font-medium text-ink"}>
        Etapa de {contactName}
      </label>
      <select
        id={id}
        value={value}
        disabled={pending}
        className={compact ? `${selectClass} mt-0 min-h-11 text-sm` : selectClass}
        onChange={(e) => {
          const next = e.target.value;
          if (next === "lost") {
            setReason("");
            dialog.current?.showModal();
            return;
          }
          commit(next);
        }}
      >
        {stages.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <p role="status" className={msg?.error ? "mt-1 text-sm text-sold" : "mt-1 text-sm text-ink-muted empty:hidden"}>
        {msg?.text}
      </p>
      <dialog ref={dialog} aria-labelledby={`${id}-t`} className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-md border border-line bg-paper p-0 text-ink backdrop:bg-ink/50">
        <form
          className="p-6"
          onSubmit={(e) => {
            e.preventDefault();
            commit("lost", reason.trim());
          }}
        >
          <h2 id={`${id}-t`} className="font-display text-2xl">
            ¿Por qué se perdió?
          </h2>
          <label htmlFor={`${id}-r`} className="mt-3 block text-sm font-medium">
            Motivo
          </label>
          <input id={`${id}-r`} required value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="Ej.: compró con otro agente" />
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => dialog.current?.close()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !reason.trim()}>
              Marcar como perdido
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
