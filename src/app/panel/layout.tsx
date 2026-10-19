import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel" },
  robots: { index: false, follow: false },
};

export default function PanelRoot({ children }: LayoutProps<"/panel">) {
  return <div className="flex min-h-full flex-1 flex-col bg-paper">{children}</div>;
}
