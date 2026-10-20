/** Re-mounted on every navigation: content settles in with a short fade and lift. */
export default function PanelTemplate({ children }: { children: React.ReactNode }) {
  return <div className="transition-[opacity,translate] duration-500 ease-[cubic-bezier(0.28,0.11,0.32,1)] starting:translate-y-2 starting:opacity-0">{children}</div>;
}
