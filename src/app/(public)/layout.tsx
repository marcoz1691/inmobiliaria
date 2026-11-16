import type { Metadata } from "next";
import { compact, JsonLd } from "@/components/public/JsonLd";
import { env } from "@/env";
import { absoluteImage, getSite, isPortal, siteOrigin } from "./_lib/site";

export async function generateMetadata(): Promise<Metadata> {
  if (await isPortal()) {
    const origin = await siteOrigin();
    return {
      metadataBase: new URL(origin),
      title: { default: env.PORTAL_NAME, template: `%s · ${env.PORTAL_NAME}` },
      description: "Casas, departamentos, terrenos y oficinas en venta y alquiler en todo Ecuador, publicados por agentes inmobiliarios.",
      openGraph: { siteName: env.PORTAL_NAME, locale: "es_EC", type: "website" },
      icons: { icon: "/brand/nestandes-icon.svg", apple: "/brand/nestandes-icon-192.png" },
      twitter: { card: "summary_large_image" },
    };
  }
  const [site, origin] = await Promise.all([getSite(), siteOrigin()]);
  const description = site.agent?.bio?.slice(0, 160) ?? "Propiedades y acompañamiento personal para comprar, vender o alquilar.";
  return {
    metadataBase: new URL(origin),
    title: { default: site.name, template: `%s · ${site.name}` },
    description,
    openGraph: { siteName: site.name, locale: "es_EC", type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  if (await isPortal()) {
    const origin = await siteOrigin();
    return (
      <>
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: env.PORTAL_NAME,
            url: origin,
            potentialAction: {
              "@type": "SearchAction",
              target: { "@type": "EntryPoint", urlTemplate: `${origin}/propiedades?q={search_term_string}` },
              "query-input": "required name=search_term_string",
            },
          }}
        />
        {children}
      </>
    );
  }
  const [site, origin] = await Promise.all([getSite(), siteOrigin()]);
  const { agent } = site;
  const socials = Object.values(agent?.socials ?? {}).filter((v): v is string => Boolean(v));
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "RealEstateAgent",
          ...compact({
            name: site.name,
            url: origin,
            image: absoluteImage(agent?.photoUrl, origin),
            telephone: agent?.phone ?? agent?.whatsapp,
            email: agent?.email,
            areaServed: agent?.city,
            address: agent?.city ? { "@type": "PostalAddress", addressLocality: agent.city, addressCountry: "EC" } : undefined,
            sameAs: socials,
          }),
        }}
      />
      {children}
    </>
  );
}
