/**
 * Test-only fixtures, run by scripts/seed.ts ONLY when SEED_E2E_FIXTURES=1 (set by
 * playwright.config.ts for its throwaway database). Never enabled by default.
 * Everything goes through the real services, so publishing rules and RLS apply.
 * Idempotent: re-running leaves existing fixtures untouched.
 */
import sharp from "sharp";
import type { Db } from "../src/server/db/create";
import type { MemberContext } from "../src/server/session";

type Ids = { tenantId: string; ownerId: string; agentId: string };

/** Flat tonal "photo" generated on the fly: no stock images, nothing real. */
async function placeholderPhoto(hue: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="#ede8df"/><rect x="300" y="420" width="760" height="520" fill="${hue}"/><rect y="940" width="1600" height="260" fill="#b6a487"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

const PROPERTIES = [
  {
    title: "Casa de prueba E2E en Cumbayá",
    final: "published" as const,
    data: {
      description: "Ficha de prueba para las pruebas automáticas. No es una propiedad real.",
      operation: "sale",
      propertyType: "house",
      price: 185000,
      priceKind: "sale",
      city: "Quito",
      sector: "Cumbayá",
      province: "Pichincha",
      bedrooms: 3,
      bathrooms: 2.5,
      builtArea: 180,
      landArea: 300,
      lat: -0.2018,
      lng: -78.4321,
      locationPrivacy: "approximate",
      highlights: ["Dato de prueba: jardín privado"],
      amenities: ["Dato de prueba"],
    },
  },
  {
    title: "Departamento de prueba E2E en Machala",
    final: "published" as const,
    data: {
      description: "Ficha de prueba para las pruebas automáticas. No es una propiedad real.",
      operation: "rent",
      propertyType: "apartment",
      price: 450,
      priceKind: "rent",
      city: "Machala",
      bedrooms: 2,
      bathrooms: 1,
      builtArea: 85,
      locationPrivacy: "hidden",
    },
  },
  {
    title: "Terreno de prueba E2E archivado",
    final: "archived" as const,
    data: {
      operation: "sale",
      propertyType: "land",
      price: 60000,
      priceKind: "sale",
      city: "Quito",
      landArea: 500,
    },
  },
];

export async function seedE2EFixtures(db: Db, ids: Ids) {
  // Point the services' process-wide getDb() at the seed's connection (one PGlite per process).
  (globalThis as unknown as { __db?: Promise<Db> }).__db = Promise.resolve(db);
  const props = await import("../src/modules/properties/service");
  const funnelsSvc = await import("../src/modules/funnels/service");
  const m: MemberContext = { tenantId: ids.tenantId, tenantSlug: "e2e", userId: ids.ownerId, userName: "E2E", role: "owner", agentId: ids.agentId };

  const existing = await props.listForPanel(m);
  for (const [i, p] of PROPERTIES.entries()) {
    if (existing.some((e: { title: string }) => e.title === p.title)) continue;
    const draft = await props.createDraft(m, p.title);
    await props.updateDraft(m, draft.id, p.data);
    await props.addPhoto(m, draft.id, await placeholderPhoto(["#c9bfae", "#b9c0c9", "#bcc5b5"][i]!), `Imagen de prueba ${i + 1}`);
    await props.changeStatus(m, draft.id, "published");
    if (p.final === "archived") await props.changeStatus(m, draft.id, "archived");
  }

  const funnels = await funnelsSvc.listFunnels(m);
  let funnel = funnels.find((f) => f.slug === "comprador");
  funnel ??= await funnelsSvc.createFunnelFromTemplate(m, "real_estate_buyer", "comprador");
  if (funnel.status !== "active") await funnelsSvc.setFunnelStatus(m, funnel.id, "active");

  // Monday–Saturday, 09:00–18:00 in the tenant's time zone.
  await funnelsSvc.setWeeklyAvailability(
    m,
    ids.agentId,
    [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 9 * 60, endMinute: 18 * 60 })),
  );
  console.log(JSON.stringify({ level: "info", msg: "e2e fixtures ready" }));
}
