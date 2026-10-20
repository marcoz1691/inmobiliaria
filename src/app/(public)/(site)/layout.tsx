import { SiteFooter } from "@/components/public/SiteFooter";
import { SiteHeader, type NavItem } from "@/components/public/SiteHeader";
import type { SocialLinks } from "@/server/db/schema";
import { agentTagline, getSite } from "../_lib/site";

const SOCIAL_LABEL: Record<keyof SocialLinks, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  x: "X",
  website: "Sitio web",
};

/** Full site chrome: header with navigation and footer with the agent's real contact data. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const site = await getSite();
  const { agent } = site;
  const nav: NavItem[] = [
    { label: "Propiedades", href: "/propiedades" },
    { label: "Agenda una cita", href: site.bookingHref },
    { label: "Contacto", href: "/contacto" },
  ];
  const socials = Object.entries(agent?.socials ?? {}).map(([k, href]) => ({
    label: SOCIAL_LABEL[k as keyof SocialLinks] ?? k,
    href: href!,
  }));
  const tagline = agentTagline(agent);

  return (
    <>
      <SiteHeader name={site.name} tagline={tagline} nav={nav} ctaHref={site.bookingHref} />
      <main id="contenido" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter
        name={site.name}
        tagline={tagline}
        nav={nav}
        email={agent?.email}
        whatsapp={agent?.whatsapp}
        phone={agent?.phone}
        socials={socials}
        location={agent?.city}
        legal={agent?.affiliation ? <p>{agent.affiliation}</p> : undefined}
      />
    </>
  );
}
