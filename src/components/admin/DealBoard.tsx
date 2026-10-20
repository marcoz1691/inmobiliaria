"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { StageSelect, type StageOption } from "./StageSelect";

export type DealCard = {
  id: string;
  stage: string;
  name: string;
  propertyTitle: string | null;
  source: string;
  score: number | null;
  createdAt: string;
};

const date = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", timeZone: "America/Guayaquil" });

function Card({ d, stages }: { d: DealCard; stages: StageOption[] }) {
  return (
    <article className="rounded-sm border border-line bg-white p-3">
      <h3 className="text-base font-medium text-ink">
        <Link href={`/panel/prospectos/${d.id}`} className="underline-offset-4 hover:underline">
          {d.name}
        </Link>
      </h3>
      <p className="mt-0.5 text-sm text-ink-muted">
        {[d.propertyTitle, d.source, date.format(new Date(d.createdAt)), d.score !== null ? `${d.score} pts` : null].filter(Boolean).join(" · ")}
      </p>
      <div className="mt-2">
        <StageSelect dealId={d.id} stage={d.stage} stages={stages} contactName={d.name} compact />
      </div>
    </article>
  );
}

/** Mobile: one tab per stage. Desktop: kanban-style columns. Stage changes use a select, not drag. */
export function DealBoard({ deals, stages }: { deals: DealCard[]; stages: StageOption[] }) {
  const firstWithDeals = stages.find((s) => deals.some((d) => d.stage === s.value))?.value ?? stages[0]!.value;
  const [tab, setTab] = useState(firstWithDeals);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const byStage = (s: string) => deals.filter((d) => d.stage === s);

  function onKey(e: React.KeyboardEvent, i: number) {
    const last = stages.length - 1;
    const next = e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    setTab(stages[next]!.value);
    tabs.current[next]?.focus();
  }

  return (
    <>
      <div className="md:hidden">
        <div role="tablist" aria-label="Etapas" className="no-scrollbar -mx-5 flex gap-1 overflow-x-auto px-5">
          {stages.map((s, i) => (
            <button
              key={s.value}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              role="tab"
              id={`tab-${s.value}`}
              aria-selected={tab === s.value}
              aria-controls={`panel-${s.value}`}
              tabIndex={tab === s.value ? 0 : -1}
              onClick={() => setTab(s.value)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn("min-h-11 shrink-0 rounded-full px-4 text-sm whitespace-nowrap", tab === s.value ? "bg-ink text-paper" : "border border-line-strong text-ink")}
            >
              {s.label} <span className={tab === s.value ? "text-paper-muted" : "text-ink-muted"}>{byStage(s.value).length}</span>
            </button>
          ))}
        </div>
        {stages
          .filter((s) => s.value === tab)
          .map((s) => (
            <div key={s.value} role="tabpanel" id={`panel-${s.value}`} aria-labelledby={`tab-${s.value}`} tabIndex={0} className="mt-4 space-y-3">
              {byStage(s.value).length ? byStage(s.value).map((d) => <Card key={d.id} d={d} stages={stages} />) : <p className="text-sm text-ink-muted">No hay prospectos en esta etapa.</p>}
            </div>
          ))}
      </div>

      <div className="hidden gap-3 overflow-x-auto pb-4 md:flex">
        {stages.map((s) => {
          const list = byStage(s.value);
          return (
            <section key={s.value} aria-labelledby={`col-${s.value}`} className="w-64 shrink-0 border-t-2 border-ink pt-3">
              <h2 id={`col-${s.value}`} className="flex items-baseline justify-between text-sm font-medium text-ink">
                {s.label} <span className="text-ink-muted">{list.length}</span>
              </h2>
              <div className="mt-3 space-y-3">{list.length ? list.map((d) => <Card key={d.id} d={d} stages={stages} />) : <p className="text-sm text-ink-muted">Vacío</p>}</div>
            </section>
          );
        })}
      </div>
    </>
  );
}
