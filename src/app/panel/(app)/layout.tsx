import { requireMember } from "@/server/session";
import { PanelNav } from "@/components/admin/PanelNav";
import { PANEL_NAV } from "@/components/admin/nav-items";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  return (
    <div className="flex min-h-full flex-1">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-full bg-navy px-4 py-3 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <PanelNav items={PANEL_NAV} userName={member.userName} />
      <main id="contenido" tabIndex={-1} className="focus:outline-none min-w-0 flex-1 px-5 pt-6 pb-24 md:px-10 md:pb-10">{children}</main>
    </div>
  );
}
