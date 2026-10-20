import type { Metadata } from "next";
import { requireMember } from "@/server/session";
import { DEAL_STAGES, STAGE_LABEL, listDeals } from "@/modules/crm/service";
import { PageHeader } from "@/components/admin/PageHeader";
import { DealBoard } from "@/components/admin/DealBoard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Prospectos" };

export default async function DealsPage() {
  const m = await requireMember();
  const rows = await listDeals(m);
  const stages = DEAL_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }));
  const deals = rows.map((r) => ({
    id: r.deal.id,
    stage: r.deal.stage,
    name: r.contact.name || r.contact.email || r.contact.phone || "Sin nombre",
    propertyTitle: r.propertyTitle,
    source: r.deal.source,
    score: r.deal.score,
    createdAt: r.deal.createdAt.toISOString(),
  }));
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow="CRM" title="Prospectos" description="Cambia la etapa con el selector de cada tarjeta. Abre un prospecto para ver sus respuestas, notas y tareas." />
      <div className="mt-6">
        {deals.length ? (
          <DealBoard deals={deals} stages={stages} />
        ) : (
          <EmptyState
            headingLevel={2}
            title="Aún no tienes prospectos"
            description="Llegan desde los formularios de tus propiedades y de tus embudos. Activa un embudo y compártelo en tus anuncios."
            action={<Button href="/panel/embudos">Ir a embudos</Button>}
          />
        )}
      </div>
    </div>
  );
}
