import "server-only";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { withTenant, type Tx } from "@/server/db/tenant-tx";
import { channelAccounts } from "@/server/db/schema";
import type { MemberContext } from "@/server/session";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/modules/audit/audit";

/**
 * Meta accounts a tenant receives webhooks for (panel: Integraciones). Routing itself happens in
 * `resolveTenant` (./meta-webhook.ts), which reads this table as the system role.
 */

export type ChannelAccount = typeof channelAccounts.$inferSelect;
export type ChannelProvider = ChannelAccount["provider"];

export const CHANNEL_PROVIDER_LABEL: Record<ChannelProvider, string> = {
  whatsapp: "WhatsApp (Phone number ID)",
  page: "Página de Facebook (Page ID)",
  instagram: "Instagram (ID de la cuenta profesional)",
};

export const channelAccountSchema = z.object({
  provider: z.enum(["whatsapp", "page", "instagram"], { error: "Elige el tipo de cuenta" }),
  externalId: z
    .string()
    .trim()
    .regex(/^\d{5,32}$/, "Usa el ID numérico que muestra Meta (solo dígitos)"),
  label: z
    .string()
    .trim()
    .max(80, "Máximo 80 caracteres")
    .transform((v) => (v === "" ? null : v))
    .nullish(),
});
export type ChannelAccountInput = z.input<typeof channelAccountSchema>;

const run = async <T>(tenantId: string, fn: (tx: Tx) => Promise<T>) => withTenant(await getDb(), tenantId, fn);

const canManage = (m: MemberContext) => m.role === "owner" || m.role === "admin";

export async function listChannelAccounts(m: MemberContext): Promise<ChannelAccount[]> {
  return run(m.tenantId, (tx) =>
    tx.select().from(channelAccounts).where(eq(channelAccounts.tenantId, m.tenantId)).orderBy(asc(channelAccounts.provider), asc(channelAccounts.createdAt)),
  );
}

/**
 * Registers an account for this tenant. Idempotent for the same tenant; an id already owned by
 * another tenant is rejected without revealing which one (the row is invisible under RLS).
 */
export async function registerChannelAccount(m: MemberContext, input: ChannelAccountInput): Promise<ChannelAccount> {
  if (!canManage(m)) throw forbidden();
  const parsed = channelAccountSchema.safeParse(input);
  if (!parsed.success) throw new AppError("invalid", parsed.error.issues[0]?.message ?? "Datos no válidos");
  const { provider, externalId, label } = parsed.data;
  return run(m.tenantId, async (tx) => {
    const [created] = await tx
      .insert(channelAccounts)
      .values({ tenantId: m.tenantId, provider, externalId, label: label ?? null })
      .onConflictDoNothing()
      .returning();
    if (created) {
      await audit(tx, { tenantId: m.tenantId, actorUserId: m.userId, action: "channel_account.register", entityType: "channel_account", entityId: created.id, diff: { provider, externalId } });
      return created;
    }
    const [own] = await tx
      .select()
      .from(channelAccounts)
      .where(and(eq(channelAccounts.tenantId, m.tenantId), eq(channelAccounts.provider, provider), eq(channelAccounts.externalId, externalId)));
    if (own) return own;
    throw new AppError("conflict", "Esa cuenta ya está registrada en la plataforma. Si es tuya, contacta a soporte.");
  });
}

export async function removeChannelAccount(m: MemberContext, id: string): Promise<void> {
  if (!canManage(m)) throw forbidden();
  if (!z.uuid().safeParse(id).success) throw notFound("Cuenta");
  await run(m.tenantId, async (tx) => {
    const [gone] = await tx
      .delete(channelAccounts)
      .where(and(eq(channelAccounts.tenantId, m.tenantId), eq(channelAccounts.id, id)))
      .returning();
    if (!gone) throw notFound("Cuenta");
    await audit(tx, { tenantId: m.tenantId, actorUserId: m.userId, action: "channel_account.remove", entityType: "channel_account", entityId: gone.id, diff: { provider: gone.provider, externalId: gone.externalId } });
  });
}
