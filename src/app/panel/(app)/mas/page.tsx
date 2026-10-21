import type { Metadata } from "next";
import { requireMember } from "@/server/session";
import { NAV_SECTIONS, PANEL_NAV } from "@/components/admin/nav-items";
import { PageHeader } from "@/components/admin/PageHeader";
import { SignOutRow } from "@/components/admin/PanelNav";
import { IconTile, ListGroup, ListItem, ListRow, type TileTone } from "@/components/admin/ui/ListGroup";

export const metadata: Metadata = { title: "Más" };

const TONE: Record<string, TileTone> = {
  "/panel/importar": "amber",
  "/panel/embudos": "clay",
  "/panel/perfil": "navy",
  "/panel/integraciones": "gray",
};

const DETAIL: Record<string, string> = {
  "/panel/importar": "Convierte fichas en borradores",
  "/panel/embudos": "Califica y agenda desde tus anuncios",
  "/panel/perfil": "Lo que muestra tu sitio",
  "/panel/integraciones": "Correo, WhatsApp, Meta, Google",
};

export default async function MorePage() {
  const m = await requireMember();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Más" />
      <div className="grid gap-7">
        {NAV_SECTIONS.filter((s) => s.key !== "general").map((s) => (
          <ListGroup key={s.key} title={s.label} titleId={`mas-${s.key}`}>
            {PANEL_NAV.filter((i) => !i.primary && i.section === s.key).map((i) => (
              <ListRow key={i.href} href={i.href} leading={<IconTile name={i.icon} tone={TONE[i.href]} />} title={i.label} subtitle={DETAIL[i.href]} />
            ))}
          </ListGroup>
        ))}
        <ListGroup footer={`Sesión iniciada como ${m.userName}.`} aria-label="Sesión">
          <ListItem>
            <SignOutRow />
          </ListItem>
        </ListGroup>
      </div>
    </div>
  );
}
