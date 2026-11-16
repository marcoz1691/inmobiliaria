import type { Metadata } from "next";
import { LandingPage, landingMetadata } from "../../_catalog/landing-page";

// /venta, /venta/casas, /venta/casas/quito, /venta/propiedades/quito
export async function generateMetadata({ params, searchParams }: PageProps<"/venta/[[...filtro]]">): Promise<Metadata> {
  return landingMetadata("sale", (await params).filtro, await searchParams);
}

export default async function Page({ params, searchParams }: PageProps<"/venta/[[...filtro]]">) {
  return <LandingPage operation="sale" segments={(await params).filtro} search={await searchParams} />;
}
