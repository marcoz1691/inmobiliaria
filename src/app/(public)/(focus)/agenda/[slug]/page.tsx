import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { env } from "@/env";
import { FunnelFlow } from "@/components/funnel/FunnelFlow";
import { MetaPixel } from "@/components/funnel/MetaPixel";
import type { PublicQuestion } from "@/components/funnel/types";
import { CONSENT_TEXT } from "@/modules/crm/service";
import { getActiveFunnel } from "@/modules/funnels/service";
import { HONEYPOT_FIELD, issueFormToken } from "../../../_lib/guard";
import { getSite } from "../../../_lib/site";
import { bookSlotAction, submitFunnelAction } from "./actions";

const loadFunnel = cache(async (slug: string) => {
  const site = await getSite();
  return getActiveFunnel(site.tenantId, slug);
});

export async function generateMetadata({ params }: PageProps<"/agenda/[slug]">): Promise<Metadata> {
  const funnel = await loadFunnel((await params).slug);
  if (!funnel) return { title: "Agenda no disponible", robots: { index: false } };
  return {
    title: funnel.headline,
    description: funnel.subheadline ?? undefined,
    alternates: { canonical: `/agenda/${funnel.slug}` },
    openGraph: { title: funnel.headline, description: funnel.subheadline ?? undefined, url: `/agenda/${funnel.slug}` },
  };
}

export default async function FunnelPage({ params }: PageProps<"/agenda/[slug]">) {
  const { slug } = await params;
  const funnel = await loadFunnel(slug);
  if (!funnel) notFound();
  const site = await getSite();

  // Scores and disqualifying flags never leave the server.
  const questions: PublicQuestion[] = funnel.questions.map((q) => ({
    id: q.id,
    label: q.label,
    ...(q.help ? { help: q.help } : {}),
    type: q.type,
    required: q.required,
    ...(q.options ? { options: q.options.map((o) => ({ value: o.value, label: o.label })) } : {}),
  }));
  const pixelId = env.META_PIXEL_ID;

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pt-8 pb-16 sm:px-8 sm:pt-12 lg:pb-24">
      {pixelId ? <MetaPixel pixelId={pixelId} /> : null}
      <header className="mb-8">
        <h1 className="font-display text-display-lg text-balance text-ink">{funnel.headline}</h1>
        {funnel.subheadline ? <p className="mt-3 text-lg text-pretty text-ink-muted">{funnel.subheadline}</p> : null}
      </header>
      <FunnelFlow
        slug={funnel.slug}
        questions={questions}
        consentText={CONSENT_TEXT}
        formToken={issueFormToken()}
        honeypotName={HONEYPOT_FIELD}
        pixel={Boolean(pixelId)}
        contact={{ whatsapp: site.agent?.whatsapp ?? null, name: site.name }}
        submit={submitFunnelAction}
        book={bookSlotAction}
      />
    </div>
  );
}
