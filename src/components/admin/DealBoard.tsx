"use client";
import { useState } from "react";
import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { ListGroup, card } from "@/components/admin/ui/ListGroup";
import { SegmentedTabs } from "@/components/admin/ui/Segmented";
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
    <article className={cn(card, "p-3.5")}>
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
  const byStage = (s: string) => deals.filter((d) => d.stage === s);

  return (
    <>
      <div className="md:hidden">
        <SegmentedTabs
          scroll
          label="Etapas"
          idBase="etapas"
          value={tab}
          onChange={setTab}
          options={stages.map((s) => ({ value: s.value, label: s.label, badge: byStage(s.value).length }))}
        />
        {stages
          .filter((s) => s.value === tab)
          .map((s) => {
            const list = byStage(s.value);
            return (
              <div key={s.value} role="tabpanel" id={`etapas-panel-${s.value}`} aria-labelledby={`etapas-tab-${s.value}`} tabIndex={0} className="mt-4 grid gap-3">
                {list.length ? (
                  list.map((d) => <Card key={d.id} d={d} stages={stages} />)
                ) : (
                  <EmptyState bare icon="people" title="No hay prospectos en esta etapa." headingLevel={3} className="py-8" />
                )}
              </div>
            );
          })}
      </div>

      <div className="hidden gap-3 overflow-x-auto pb-4 md:flex">
        {stages.map((s) => {
          const list = byStage(s.value);
          return (
            <ListGroup key={s.value} as="div" className="w-[17.5rem] shrink-0" title={s.label} titleId={`col-${s.value}`} action={<span className="pr-1 text-sm font-semibold text-ink-muted tabular-nums">{list.length}</span>}>
              <div className="grid gap-2 p-2">
                {list.length ? list.map((d) => <Card key={d.id} d={d} stages={stages} />) : <p className="px-3 py-4 text-sm text-ink-muted">Vacío</p>}
              </div>
            </ListGroup>
          );
        })}
      </div>
    </>
  );
}
