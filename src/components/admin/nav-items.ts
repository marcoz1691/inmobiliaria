import type { PanelNavItem } from "./PanelNav";

/** Single source for panel navigation. `primary` items appear in the mobile tab bar. */
export const PANEL_NAV: PanelNavItem[] = [
  { href: "/panel", label: "Inicio", icon: "home", section: "general", primary: true },
  { href: "/panel/propiedades", label: "Propiedades", icon: "building", section: "general", primary: true },
  { href: "/panel/prospectos", label: "Prospectos", icon: "people", section: "general", primary: true },
  { href: "/panel/agenda", label: "Agenda", icon: "calendar", section: "general", primary: true },
  { href: "/panel/importar", label: "Importar PDF", icon: "docImport", section: "capture" },
  { href: "/panel/embudos", label: "Embudos", icon: "funnel", section: "capture" },
  { href: "/panel/perfil", label: "Perfil y marca", icon: "person", section: "account" },
  { href: "/panel/integraciones", label: "Integraciones", icon: "plug", section: "account" },
];

export const NAV_SECTIONS = [
  { key: "general", label: "General" },
  { key: "capture", label: "Captación" },
  { key: "account", label: "Cuenta" },
] as const;
