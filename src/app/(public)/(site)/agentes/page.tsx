import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { listPortalAgents } from "@/modules/agents/portal";
import { isPortal } from "../../_lib/site";
import { AgentTile } from "../_portal/AgentCard";

const container = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12";

export const metadata: Metadata = {
  title: "Agentes inmobiliarios",
  description: "Agentes inmobiliarios con propiedades publicadas en venta y alquiler en Ecuador.",
  alternates: { canonical: "/agentes" },
};

/** Portal directory: agents with at least one live listing. */
export default async function AgentsPage() {
  if (!(await isPortal())) notFound();
  const agents = await listPortalAgents();
  return (
    <>
      <header className="bg-paper">
        <div className={`${container} pt-12 pb-8 lg:pt-20 lg:pb-10`}>
          <h1 className="font-display text-display-lg text-balance text-ink">
            Agentes. <span className="text-ink-muted">Habla con quien publica.</span>
          </h1>
          <p className="mt-3 text-lead text-ink-muted">
            {agents.length === 1 ? "1 agente con propiedades publicadas" : `${agents.length} agentes con propiedades publicadas`}
          </p>
        </div>
      </header>
      <div className="flex-1 bg-sand">
        <div className={`${container} py-8 lg:py-12`}>
          {agents.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {agents.map((a) => (
                <li key={a.tenantSlug}>
                  <AgentTile agent={a} href={`/agentes/${a.tenantSlug}`} listings={a.listings} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              headingLevel={2}
              surface="white"
              title="Aún no hay agentes con propiedades publicadas"
              description="¿Eres agente? Crea tu cuenta y publica tus primeras propiedades."
              action={<Button href="/panel/registro">Publica tu propiedad</Button>}
            />
          )}
        </div>
      </div>
    </>
  );
}
