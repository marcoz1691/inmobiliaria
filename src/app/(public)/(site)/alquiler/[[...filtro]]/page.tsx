import type { Metadata } from "next";
import { LandingPage, landingMetadata } from "../../_catalog/landing-page";

// /alquiler, /alquiler/casas, /alquiler/casas/quito, /alquiler/propiedades/quito
export async function generateMetadata({ params, searchParams }: PageProps<"/alquiler/[[...filtro]]">): Promise<Metadata> {
  return landingMetadata("rent", (await params).filtro, await searchParams);
}

export default async function Page({ params, searchParams }: PageProps<"/alquiler/[[...filtro]]">) {
  return <LandingPage operation="rent" segments={(await params).filtro} search={await searchParams} />;
}
