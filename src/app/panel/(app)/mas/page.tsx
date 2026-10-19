import Link from "next/link";
import { PANEL_NAV } from "@/components/admin/nav-items";

export default function MorePage() {
  return (
    <div>
      <h1 className="font-display text-display-md text-ink">Más</h1>
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {PANEL_NAV.filter((i) => !i.primary).map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="flex min-h-14 items-center text-base text-ink">{i.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
