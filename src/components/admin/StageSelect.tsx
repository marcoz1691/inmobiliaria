"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveDealAction } from "@/app/panel/(app)/prospectos/actions";
import { Button } from "@/components/admin/ui/Button";
import { Sheet } from "@/components/admin/ui/Sheet";
import { useToast } from "@/components/admin/ui/Toast";
import { inputClass, selectClass } from "./fields";

export type StageOption = { value: string; label: string };

/** Stage picker (accessible alternative to kanban drag). "Perdido" asks for the reason first. */
export function StageSelect({ dealId, stage, stages, contactName, compact }: { dealId: string; stage: string; stages: StageOption[]; contactName: string; compact?: boolean }) {
  const label = (v: string) => stages.find((s) => s.value === v)?.label ?? v;
  const id = useId();
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(stage);
  const [lostOpen, setLostOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();

  function commit(next: string, lostReason?: string) {
    start(async () => {
      const r = await moveDealAction(dealId, { stage: next, lostReason });
      if (r.ok) {
        setValue(next);
        setMsg({ text: `Movido a «${label(next)}».` });
        setLostOpen(false);
        toast.success(`Movido a «${label(next)}».`);
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
            setMsg(null);
            setLostOpen(true);
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
      <p role="status" className={msg?.error ? "mt-1 text-sm font-medium text-sold" : "mt-1 text-sm text-ink-muted empty:hidden"}>
        {msg?.text}
      </p>
      <Sheet
        open={lostOpen}
        onClose={() => setLostOpen(false)}
        title="¿Por qué se perdió?"
        description={`Vas a marcar a ${contactName} como perdido. El motivo queda en el historial.`}
      >
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            commit("lost", reason.trim());
          }}
        >
          <label htmlFor={`${id}-r`} className="block text-sm font-medium">
            Motivo
          </label>
          <input id={`${id}-r`} required value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="Ej.: compró con otro agente" />
          {msg?.error ? (
            <p role="alert" className="mt-2 text-sm font-medium text-sold">
              {msg.text}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="gray" size="lg" className="sm:min-h-11 sm:px-5 sm:text-[0.9375rem]" onClick={() => setLostOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" className="sm:min-h-11 sm:px-5 sm:text-[0.9375rem]" pending={pending} disabled={!reason.trim()}>
              Marcar como perdido
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
