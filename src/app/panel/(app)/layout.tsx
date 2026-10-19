import { requireMember } from "@/server/session";
import { PanelNav } from "@/components/admin/PanelNav";
import { PANEL_NAV } from "@/components/admin/nav-items";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  return (
    <div className="flex min-h-full flex-1">
      <PanelNav items={PANEL_NAV} userName={member.userName} />
      <main id="contenido" className="min-w-0 flex-1 px-5 pt-6 pb-24 md:px-10 md:pb-10">{children}</main>
    </div>
  );
}
