import "server-only";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { getCanton } from "@/modules/geo/ecuador";
import { slugify } from "@/modules/properties/domain";
import { getDb } from "@/server/db/client";
import { account, agentProfiles, memberships, tenants, user } from "@/server/db/schema";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

export const registrationSchema = z.object({
  name: z.string().trim().min(3, "Escribe tu nombre completo.").max(80, "Máximo 80 caracteres."),
  email: z.email("Escribe un correo válido.").trim().toLowerCase().max(160),
  password: z.string().min(10, "Usa al menos 10 caracteres.").max(128, "Máximo 128 caracteres."),
  whatsapp: optional(30).refine((v) => v === undefined || /^\+?[\d\s()-]{7,20}$/.test(v), "Escribe solo el número, con código de país si lo tienes."),
  /** Canton slug from the Ecuador list (src/modules/geo/ecuador.ts). */
  city: optional(80).refine((v) => v === undefined || getCanton(v) !== null, "Elige una ciudad de la lista."),
});
export type RegistrationInput = z.infer<typeof registrationSchema>;

const RESERVED = ["www", "api", "app", "panel", "admin", "portal", "mail", "static", "media", "agentes", "propiedades"];

/** "maria-perez", then "maria-perez-2"…: the agent's workspace slug and subdomain label. */
async function freeTenantSlug(db: Pick<Awaited<ReturnType<typeof getDb>>, "select">, name: string): Promise<string> {
  const root = slugify(name).slice(0, 40).replace(/-+$/, "") || "agente";
  const taken = new Set(
    (await db.select({ slug: tenants.slug }).from(tenants).where(sql`${tenants.slug} = ${root} or ${tenants.slug} like ${`${root}-%`}`)).map((r) => r.slug),
  );
  // Labels the platform may need for itself as subdomains.
  for (const r of RESERVED) if (root === r) taken.add(root);
  if (!taken.has(root)) return root;
  for (let i = 2; ; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
}

/**
 * Self-service sign-up for agents on the portal: one transaction creates the login (Better Auth
 * user + credential), the agent's own workspace (tenant, owner membership) and their public
 * profile. Contact fields stay empty unless given: nothing is invented.
 */
export async function registerAgent(input: RegistrationInput): Promise<{ userId: string; tenantId: string; tenantSlug: string }> {
  const db = await getDb();
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, input.email)).limit(1);
  if (existing) throw new AppError("conflict", "Ya existe una cuenta con ese correo. Ingresa con tu contraseña.", { field: "email" });

  const password = await hashPassword(input.password);
  const canton = getCanton(input.city);
  try {
    return await create(db, input, password, canton?.name ?? null);
  } catch (err) {
    // Two sign-ups with the same email at once: the unique index decides.
    if ((err as { code?: string; cause?: { code?: string } })?.code === "23505" || (err as { cause?: { code?: string } })?.cause?.code === "23505") {
      throw new AppError("conflict", "Ya existe una cuenta con ese correo. Ingresa con tu contraseña.", { field: "email" });
    }
    throw err;
  }
}

async function create(db: Awaited<ReturnType<typeof getDb>>, input: RegistrationInput, password: string, city: string | null) {
  return db.transaction(async (tx) => {
    // Inside the transaction: PGlite has a single connection, and it keeps the check consistent.
    const slug = await freeTenantSlug(tx, input.name);
    const userId = randomUUID();
    await tx.insert(user).values({ id: userId, name: input.name, email: input.email, emailVerified: false });
    await tx.insert(account).values({ id: randomUUID(), accountId: userId, providerId: "credential", userId, password });
    const [tenant] = await tx.insert(tenants).values({ slug, name: input.name }).returning({ id: tenants.id });
    await tx.insert(memberships).values({ tenantId: tenant!.id, userId, role: "owner" });
    await tx.insert(agentProfiles).values({
      tenantId: tenant!.id,
      userId,
      slug: slugify(input.name).slice(0, 60) || "agente",
      displayName: input.name,
      whatsapp: input.whatsapp ?? null,
      city,
      isPrimary: true,
    });
    return { userId, tenantId: tenant!.id, tenantSlug: slug };
  });
}
