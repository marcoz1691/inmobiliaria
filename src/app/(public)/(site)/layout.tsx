import Image from "next/image";
import { SiteFooter } from "@/components/public/SiteFooter";
import { whatsappHref } from "@/components/public/WhatsAppButton";
import { ChatWidget } from "@/components/chat";
import { SiteHeader, type NavItem } from "@/components/public/SiteHeader";
import type { SocialLinks } from "@/server/db/schema";
import { topCategories } from "@/modules/properties/landing";
import { env } from "@/env";
import { agentTagline, getFacets, getSite, isPortal } from "../_lib/site";

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
  if (await isPortal()) return <PortalLayout>{children}</PortalLayout>;
  const [site, facets] = await Promise.all([getSite(), getFacets()]);
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
        categories={topCategories(facets, 6).map((c) => ({ label: c.label, href: c.href }))}
        email={agent?.email}
        whatsapp={agent?.whatsapp}
        phone={agent?.phone}
        socials={socials}
        location={agent?.city}
        legal={agent?.affiliation ? <p>{agent.affiliation}</p> : undefined}
      />
      <ChatWidget whatsappHref={agent?.whatsapp ? whatsappHref(agent.whatsapp, "Hola, vi tu sitio y quisiera más información.") : null} />
    </>
  );
}

/** Portal chrome: search-first navigation, and the way in for agents. No assistant (it answers for one agent). */
async function PortalLayout({ children }: { children: React.ReactNode }) {
  const facets = await getFacets();
  const nav: NavItem[] = [
    { label: "Propiedades", href: "/propiedades" },
    { label: "En venta", href: "/venta" },
    { label: "En alquiler", href: "/alquiler" },
    { label: "Agentes", href: "/agentes" },
    { label: "Ingresar", href: "/panel/ingresar" },
  ];
  return (
    <>
      <SiteHeader name={env.PORTAL_NAME} nav={nav} ctaHref="/panel/registro" ctaLabel="Publica tu propiedad" logo={<PortalLogo name={env.PORTAL_NAME} />} />
      <main id="contenido" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter
        name={env.PORTAL_NAME}
        tagline="Propiedades en venta y alquiler en todo Ecuador"
        nav={[...nav.slice(0, 4), { label: "Publica tu propiedad", href: "/panel/registro" }, { label: "Ingresar como agente", href: "/panel/ingresar" }]}
        categories={topCategories(facets, 6).map((c) => ({ label: c.label, href: c.href }))}
        legal={
          <p>
            {env.PORTAL_NAME} es un producto de{" "}
            <a href="https://www.marcsintelligence.app" target="_blank" rel="noopener" className="font-semibold text-ink underline-offset-4 hover:underline">
              MarcsIntelligence<span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
          </p>
        }
      />
    </>
  );
}

/** Portal mark: the icon plus the wordmark ("nest" + "andes" in brand green); plain name for other portal names. */
function PortalLogo({ name }: { name: string }) {
  const nestandes = name.toLowerCase() === "nestandes";
  return (
    <span className="flex items-center gap-2.5">
      <Image src="/brand/nestandes-icon.svg" alt="" width={28} height={28} unoptimized priority className="size-7 shrink-0" />
      <span className="truncate text-[1.1875rem] font-bold tracking-[-0.03em] text-ink">
        {nestandes ? (
          <>
            nest<span className="text-[#2F855A]">andes</span>
          </>
        ) : (
          name
        )}
      </span>
    </span>
  );
}
