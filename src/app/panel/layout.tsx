import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel" },
  robots: { index: false, follow: false },
};

/** Grouped background (white cards sit on it), like iOS Settings. */
export default function PanelRoot({ children }: LayoutProps<"/panel">) {
  return <div className="flex min-h-full flex-1 flex-col bg-sand text-ink [-webkit-tap-highlight-color:transparent]">{children}</div>;
}
