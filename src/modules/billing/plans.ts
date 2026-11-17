/**
 * Subscription plans. Prices in US$ per month before IVA (13 %). Limits are enforced on the
 * server (publishing, featuring, AI PDF reads); changing a number here changes the product.
 */
export const PLAN_IDS = ["free", "agente", "pro", "inmobiliaria"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type Plan = {
  id: PlanId;
  name: string;
  priceUsd: number;
  /** Published or reserved listings at the same time. */
  maxListings: number;
  /** PDFs read by the AI agent per 30 days (about US$0.10 each on Claude Opus 5.5). */
  aiImportsPerMonth: number;
  /** Listings shown first on the portal and in search results. */
  maxFeatured: number;
  pitch: string;
  features: string[];
  highlight?: boolean;
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Gratis",
    priceUsd: 0,
    maxListings: 1,
    aiImportsPerMonth: 1,
    maxFeatured: 0,
    pitch: "Prueba el portal con una propiedad.",
    features: ["1 propiedad publicada", "1 PDF leído con IA al mes", "Perfil de agente en el portal", "Consultas a tu panel y WhatsApp", "CRM, agenda y embudo de citas"],
  },
  agente: {
    id: "agente",
    name: "Agente",
    priceUsd: 19,
    maxListings: 15,
    aiImportsPerMonth: 20,
    maxFeatured: 1,
    pitch: "Para el agente independiente.",
    features: ["15 propiedades publicadas", "20 PDFs leídos con IA al mes", "1 propiedad destacada", "Todo lo del plan Gratis"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 39,
    maxListings: 50,
    aiImportsPerMonth: 60,
    maxFeatured: 5,
    pitch: "Para quien vive de sus anuncios.",
    features: ["50 propiedades publicadas", "60 PDFs leídos con IA al mes", "5 propiedades destacadas", "Todo lo del plan Agente"],
    highlight: true,
  },
  inmobiliaria: {
    id: "inmobiliaria",
    name: "Inmobiliaria",
    priceUsd: 99,
    maxListings: 200,
    aiImportsPerMonth: 200,
    maxFeatured: 15,
    pitch: "Para oficinas con mucho inventario.",
    features: ["200 propiedades publicadas", "200 PDFs leídos con IA al mes", "15 propiedades destacadas", "Todo lo del plan Pro"],
  },
};

export const IVA_RATE = 0.13;

/** A paid plan past its end date falls back to Gratis; nothing is deleted, publishing more is blocked. */
export function effectivePlan(plan: string | null | undefined, expiresAt: Date | null | undefined, now = new Date()): Plan {
  const p = PLANS[(PLAN_IDS as readonly string[]).includes(plan ?? "") ? (plan as PlanId) : "free"];
  if (p.id !== "free" && expiresAt && expiresAt.getTime() < now.getTime()) return PLANS.free;
  return p;
}

export const planLimitMessage = (plan: Plan, what: "listings" | "featured" | "ai") =>
  what === "listings"
    ? `Tu plan ${plan.name} permite ${plan.maxListings === 1 ? "1 propiedad publicada" : `${plan.maxListings} propiedades publicadas`}. Mejora tu plan para publicar más.`
    : what === "featured"
      ? plan.maxFeatured === 0
        ? `El plan ${plan.name} no incluye propiedades destacadas. Mejora tu plan para destacar.`
        : `Tu plan ${plan.name} permite ${plan.maxFeatured} ${plan.maxFeatured === 1 ? "propiedad destacada" : "propiedades destacadas"}.`
      : `Usaste los ${plan.aiImportsPerMonth} ${plan.aiImportsPerMonth === 1 ? "PDF" : "PDFs"} con IA de tu plan ${plan.name} este mes. Se usó la lectura automática.`;
