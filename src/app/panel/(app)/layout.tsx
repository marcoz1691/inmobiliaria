import { requireMember } from "@/server/session";
import { dashboardCounts } from "@/modules/crm/service";
import { PanelNav } from "@/components/admin/PanelNav";
import { PANEL_NAV } from "@/components/admin/nav-items";
import { ToastProvider } from "@/components/admin/ui/Toast";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  const counts = await dashboardCounts(member);
  const newLeads = counts.deals.new ?? 0;
  return (
    <ToastProvider>
      <div className="flex min-h-full flex-1">
        <a
          href="#contenido"
          className="sr-only z-50 rounded-full bg-navy px-4 py-3 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Saltar al contenido
        </a>
        <PanelNav items={PANEL_NAV} userName={member.userName} badges={{ "/panel/prospectos": { n: newLeads, label: newLeads === 1 ? "nuevo" : "nuevos" } }} />
        <main
          id="contenido"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(env(safe-area-inset-bottom)+6.5rem)] focus:outline-none sm:px-6 md:px-10 md:pt-10 md:pb-16 xl:px-14"
        >
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
