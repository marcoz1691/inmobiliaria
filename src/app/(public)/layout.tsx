import type { Metadata } from "next";
import { compact, JsonLd } from "@/components/public/JsonLd";
import { absoluteImage, getSite, siteOrigin } from "./_lib/site";

export async function generateMetadata(): Promise<Metadata> {
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
