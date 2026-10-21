"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import type { Schedule } from "./types";

type Props = {
  schedule: Schedule;
  pending: boolean;
  error?: string;
  onConfirm: (iso: string, label: string) => void;
};

function zoneLabel(timeZone: string): string {
  const name = new Intl.DateTimeFormat("es-EC", { timeZone, timeZoneName: "long" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName")?.value;
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : timeZone;
}

/** Day tabs + time grid in the tenant's time zone. Nothing is booked until "Confirmar". */
export function SlotPicker({ schedule, pending, error, onConfirm }: Props) {
  const [dayKey, setDayKey] = useState(schedule.days[0]?.key);
  const [slot, setSlot] = useState<string | null>(null);
  const id = useId();
  const day = schedule.days.find((d) => d.key === dayKey) ?? schedule.days[0];
  const chosen = day?.slots.find((s) => s.iso === slot);

  if (!day) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 id={`${id}-days`} className="text-sm font-medium text-ink">
          Elige el día
        </h3>
        <ul aria-labelledby={`${id}-days`} className="no-scrollbar -mx-5 mt-2 flex snap-x gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {schedule.days.map((d) => {
            const active = d.key === day.key;
            return (
              <li key={d.key} className="snap-start">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setDayKey(d.key);
                    setSlot(null);
                  }}
                  className={cn(
                    "flex min-h-16 min-w-20 flex-col items-center justify-center rounded-sm border px-3 py-2 text-center transition-colors duration-300 ease-apple",
                    active ? "border-navy bg-navy text-white" : "border-line-strong bg-white text-ink hover:border-ink/70",
                  )}
                >
                  <span className="text-xs capitalize">{d.weekday}</span>
                  <span className="text-[0.9375rem] font-semibold whitespace-nowrap">{d.date}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink">
          Horarios del <span className="capitalize">{day.weekday}</span> {day.date}
        </legend>
        <p className="mt-1 text-sm text-ink-muted">{zoneLabel(schedule.timezone)} · {schedule.durationMinutes} minutos</p>
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {day.slots.map((s) => (
            <li key={s.iso}>
              <label
                className={cn(
                  "flex min-h-12 cursor-pointer items-center justify-center rounded-full border text-base font-medium transition-colors duration-300 ease-apple",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-navy",
                  slot === s.iso ? "border-navy bg-navy text-white" : "border-line-strong bg-white text-ink hover:border-ink/70",
                )}
              >
                <input type="radio" name={`${id}-slot`} value={s.iso} checked={slot === s.iso} onChange={() => setSlot(s.iso)} className="sr-only" />
                {s.time}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {error ? (
        <p role="alert" className="rounded-sm bg-sold-bg px-4 py-3 text-sm font-medium text-sold">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        className="w-full whitespace-normal sm:w-auto"
        disabled={!chosen || pending}
        onClick={() => chosen && onConfirm(chosen.iso, `${day.weekday} ${day.date}, ${chosen.time}`)}
      >
        {pending ? "Agendando…" : chosen ? `Confirmar: ${day.weekday} ${day.date}, ${chosen.time}` : "Elige un horario"}
      </Button>
    </div>
  );
}
