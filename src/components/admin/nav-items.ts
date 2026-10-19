import type { PanelNavItem } from "./PanelNav";

/** Single source for panel navigation. `primary` items appear in the mobile tab bar. */
export const PANEL_NAV: PanelNavItem[] = [
  { href: "/panel", label: "Inicio", primary: true },
  { href: "/panel/propiedades", label: "Propiedades", primary: true },
  { href: "/panel/prospectos", label: "Prospectos", primary: true },
  { href: "/panel/agenda", label: "Agenda", primary: true },
  { href: "/panel/importar", label: "Importar PDF" },
  { href: "/panel/embudos", label: "Embudos" },
  { href: "/panel/perfil", label: "Perfil y marca" },
  { href: "/panel/integraciones", label: "Integraciones" },
];
