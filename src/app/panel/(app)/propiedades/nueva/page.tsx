import type { Metadata } from "next";
import { requireMember } from "@/server/session";
import { PageHeader } from "@/components/admin/PageHeader";
import { PlanLimitGate } from "@/components/admin/PlanLimitGate";
import { Button } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { NewPropertyForm } from "@/components/admin/wizard/NewPropertyForm";
import { planLimitMessage } from "@/modules/billing/plans";
import { planUsage } from "@/modules/billing/service";

export const metadata: Metadata = { title: "Publicar propiedad" };

export default async function NewPropertyPage() {
  const m = await requireMember();
  // Check the plan before the agent types anything: at the limit, the plans come first.
  const { plan, live } = await planUsage(m);
  const full = live >= plan.maxListings;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ href: "/panel/propiedades", label: "Propiedades" }} eyebrow="Nueva propiedad" title="Publicar propiedad" className="mb-4 md:mb-5" />
      {full ? (
        <>
          <PlanLimitGate reason={planLimitMessage(plan, "listings")} />
          <EmptyState
            icon="star"
            title="Llegaste al límite de tu plan"
            description={`${planLimitMessage(plan, "listings")} También puedes pausar una propiedad publicada para liberar su lugar.`}
            action={<Button href="/panel/plan">Ver planes</Button>}
          />
        </>
      ) : (
        <NewPropertyForm />
      )}
    </div>
  );
}
