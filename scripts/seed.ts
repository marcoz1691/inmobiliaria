/**
 * Idempotent seed for the pilot tenant.
 * - Creates the tenant, localhost domains, owner account, membership and agent profile.
 * - Registers WHATSAPP_PHONE_NUMBER_ID (when set) as the tenant's WhatsApp channel account.
 * - Uploads the agent photo from assets-input/perfil/foto-agente.jpeg when present.
 * Never invents personal data: contact fields stay empty until filled in the panel.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { createDb } from "../src/server/db/create";
import { account, agentProfiles, channelAccounts, memberships, tenantDomains, tenants, user } from "../src/server/db/schema";
import { processImage } from "../src/modules/media/process";

const TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG ?? "piloto";
const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? "agente@piloto.test";
const PHOTO = "assets-input/perfil/foto-agente.jpeg";

// No default credentials in code: use SEED_OWNER_PASSWORD, or generate one shown once on first seed.
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD || randomBytes(12).toString("base64url");
const generatedPassword = !process.env.SEED_OWNER_PASSWORD;

export async function seed() {
  const db = await createDb({ migrate: true });

  let [tenant] = await db.select().from(tenants).where(eq(tenants.slug, TENANT_SLUG));
  if (!tenant) {
    [tenant] = await db.insert(tenants).values({ slug: TENANT_SLUG, name: "Agente inmobiliario" }).returning();
  }
  const tenantId = tenant!.id;

  for (const domain of ["localhost", "127.0.0.1"]) {
    await db.insert(tenantDomains).values({ domain, tenantId }).onConflictDoNothing();
  }

  let [owner] = await db.select().from(user).where(eq(user.email, OWNER_EMAIL));
  if (!owner) {
    [owner] = await db.insert(user).values({ id: randomUUID(), name: "Agente", email: OWNER_EMAIL, emailVerified: true }).returning();
    await db.insert(account).values({
      id: randomUUID(),
      accountId: owner!.id,
      providerId: "credential",
      userId: owner!.id,
      password: await hashPassword(OWNER_PASSWORD),
    });
    if (generatedPassword) {
      // Printed to the operator's terminal only, never logged elsewhere.
      process.stdout.write(`\nCuenta creada: ${OWNER_EMAIL}\nContraseña temporal: ${OWNER_PASSWORD}\nCámbiala al ingresar.\n\n`);
    }
  }
  await db.insert(memberships).values({ tenantId, userId: owner!.id, role: "owner" }).onConflictDoNothing();

  let [agent] = await db.select().from(agentProfiles).where(and(eq(agentProfiles.tenantId, tenantId), eq(agentProfiles.isPrimary, true)));
  if (!agent) {
    [agent] = await db
      .insert(agentProfiles)
      .values({ tenantId, userId: owner!.id, slug: "agente", displayName: "Agente inmobiliario", isPrimary: true })
      .returning();
  }

  if (!agent!.photoUrl && existsSync(PHOTO)) {
    const { getStorage } = await import("../src/modules/media/storage");
    const storage = getStorage();
    const processed = await processImage(await readFile(PHOTO));
    const baseKey = `tenants/${tenantId}/agents/${agent!.id}/photo-${Date.now()}`;
    for (const v of processed.variants) {
      await storage.put(`${baseKey}-${[480, 960, 1600][processed.variants.indexOf(v)]}.webp`, v.body, "image/webp");
    }
    await db.update(agentProfiles).set({ photoUrl: `media:${storage.url(baseKey)}` }).where(eq(agentProfiles.id, agent!.id));
  }

  // WhatsApp webhooks for this number are routed to this tenant (channel_accounts).
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (phoneNumberId) {
    await db.insert(channelAccounts).values({ tenantId, provider: "whatsapp", externalId: phoneNumberId, label: "WHATSAPP_PHONE_NUMBER_ID" }).onConflictDoNothing();
    const [owned] = await db
      .select({ tenantId: channelAccounts.tenantId })
      .from(channelAccounts)
      .where(and(eq(channelAccounts.provider, "whatsapp"), eq(channelAccounts.externalId, phoneNumberId)));
    if (owned?.tenantId !== tenantId) {
      console.warn(JSON.stringify({ level: "warn", msg: "WHATSAPP_PHONE_NUMBER_ID is registered to another tenant; not reassigned" }));
    }
  }

  // Test-only fixtures (funnel "comprador", availability, sample listings). Never on by default.
  if (process.env.SEED_E2E_FIXTURES === "1") {
    const { seedE2EFixtures } = await import("./e2e-fixtures");
    await seedE2EFixtures(db, { tenantId, ownerId: owner!.id, agentId: agent!.id });
  }

  console.log(JSON.stringify({ level: "info", msg: "seed complete", tenant: TENANT_SLUG, owner: OWNER_EMAIL }));
  return { tenantId, ownerId: owner!.id, agentId: agent!.id };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seed();
  process.exit(0);
}
