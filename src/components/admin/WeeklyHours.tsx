"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { saveAvailabilityAction } from "@/app/panel/(app)/agenda/actions";
import { inputClass } from "./fields";

export type Rule = { weekday: number; startMinute: number; endMinute: number };
type Range = { key: string; start: string; end: string };

// Display order Monday → Sunday; weekday numbers follow JS (0 = domingo).
const DAYS = [
  { n: 1, label: "Lunes" },
  { n: 2, label: "Martes" },
  { n: 3, label: "Miércoles" },
  { n: 4, label: "Jueves" },
  { n: 5, label: "Viernes" },
  { n: 6, label: "Sábado" },
  { n: 0, label: "Domingo" },
];

const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Weekly availability editor. Starts empty: the agent defines every range, nothing is assumed. */
export function WeeklyHours({ initial }: { initial: Rule[] }) {
  const router = useRouter();
  const [days, setDays] = useState<Record<number, Range[]>>(() => {
    const out: Record<number, Range[]> = {};
    for (const d of DAYS) out[d.n] = [];
    for (const r of initial) out[r.weekday]!.push({ key: crypto.randomUUID(), start: toTime(r.startMinute), end: r.endMinute === 1440 ? "23:59" : toTime(r.endMinute) });
    return out;
  });
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();

  const update = (day: number, fn: (r: Range[]) => Range[]) => {
    setMsg(null);
    setDays((d) => ({ ...d, [day]: fn(d[day]!) }));
  };

  function save() {
    const rules: Rule[] = [];
    for (const d of DAYS)
      for (const r of days[d.n]!) {
        if (!r.start || !r.end) {
          setMsg({ text: `Completa las horas del ${d.label.toLowerCase()}.`, error: true });
          return;
        }
        const s = toMin(r.start);
        const e = r.end === "23:59" ? 1440 : toMin(r.end);
        if (e <= s) {
          setMsg({ text: `${d.label}: la hora de fin debe ser posterior a la de inicio.`, error: true });
          return;
        }
        rules.push({ weekday: d.n, startMinute: s, endMinute: e });
      }
    start(async () => {
      const r = await saveAvailabilityAction(rules);
      setMsg(r.ok ? { text: rules.length ? "Horario guardado." : "Horario vacío guardado: no se ofrecerán citas." } : { text: r.error, error: true });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div>
      <ul className="divide-y divide-line border-y border-line">
        {DAYS.map((d) => (
          <li key={d.n} className="py-3">
            <fieldset>
              <legend className="text-base font-medium text-ink">{d.label}</legend>
              {days[d.n]!.length === 0 ? <p className="mt-1 text-sm text-ink-muted">Sin atención</p> : null}
              {days[d.n]!.map((r, i) => (
                <div key={r.key} className="mt-2 flex flex-wrap items-end gap-2">
                  <div>
                    <label htmlFor={`${r.key}-s`} className="block text-xs text-ink-muted">
                      Desde <span className="sr-only">({d.label}, franja {i + 1})</span>
                    </label>
                    <input id={`${r.key}-s`} type="time" step={900} value={r.start} className={`${inputClass} mt-0.5 w-32`} onChange={(e) => update(d.n, (x) => x.map((y) => (y.key === r.key ? { ...y, start: e.target.value } : y)))} />
                  </div>
                  <div>
                    <label htmlFor={`${r.key}-e`} className="block text-xs text-ink-muted">
                      Hasta <span className="sr-only">({d.label}, franja {i + 1})</span>
                    </label>
                    <input id={`${r.key}-e`} type="time" step={900} value={r.end} className={`${inputClass} mt-0.5 w-32`} onChange={(e) => update(d.n, (x) => x.map((y) => (y.key === r.key ? { ...y, end: e.target.value } : y)))} />
                  </div>
                  <button
                    type="button"
                    className="grid size-11 place-items-center rounded-full text-ink hover:bg-ink/5"
                    aria-label={`Quitar franja ${i + 1} del ${d.label.toLowerCase()}`}
                    onClick={() => update(d.n, (x) => x.filter((y) => y.key !== r.key))}
                  >
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="m5 5 10 10M15 5 5 15" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="mt-2 min-h-11 rounded-full px-3 text-sm font-medium text-navy underline underline-offset-4 hover:bg-ink/5"
                onClick={() => update(d.n, (x) => [...x, { key: crypto.randomUUID(), start: "", end: "" }])}
              >
                Agregar franja<span className="sr-only"> al {d.label.toLowerCase()}</span>
              </button>
            </fieldset>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Guardando…" : "Guardar horario"}
        </Button>
        <p role="status" className={msg?.error ? "text-sm font-medium text-sold" : "text-sm text-available"}>
          {msg?.text}
        </p>
      </div>
    </div>
  );
}
