import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Tx } from "@/server/db/tenant-tx";
import { conversations, messages } from "@/server/db/schema";
import { sign, verify } from "@/modules/integrations/signing";

/**
 * Unified conversation history (web chat, WhatsApp, Messenger, Instagram). All functions run inside
 * a `withTenant` transaction supplied by the caller and filter by tenant explicitly.
 */

export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type Channel = ConversationRow["channel"];

export async function getConversation(tx: Tx, tenantId: string, id: string): Promise<ConversationRow | null> {
  const [c] = await tx
    .select()
    .from(conversations)
    .where(and(eq(conversations.tenantId, tenantId), eq(conversations.id, id)))
    .limit(1);
  return c ?? null;
}

export async function createConversation(
  tx: Tx,
  c: { tenantId: string; channel: Channel; externalThreadId?: string | null; contactId?: string | null; propertyId?: string | null },
): Promise<ConversationRow> {
  const [row] = await tx
    .insert(conversations)
    .values({ tenantId: c.tenantId, channel: c.channel, externalThreadId: c.externalThreadId ?? null, contactId: c.contactId ?? null, propertyId: c.propertyId ?? null })
    .returning();
  return row!;
}

/** Thread for an external channel (WhatsApp number, Messenger PSID…). Links the contact when known. */
export async function getOrCreateThread(
  tx: Tx,
  c: { tenantId: string; channel: Exclude<Channel, "web">; externalThreadId: string; contactId?: string | null },
): Promise<ConversationRow> {
  await tx
    .insert(conversations)
    .values({ tenantId: c.tenantId, channel: c.channel, externalThreadId: c.externalThreadId, contactId: c.contactId ?? null })
    .onConflictDoNothing();
  const [row] = await tx
    .select()
    .from(conversations)
    .where(and(eq(conversations.tenantId, c.tenantId), eq(conversations.channel, c.channel), eq(conversations.externalThreadId, c.externalThreadId)))
    .limit(1);
  if (row && !row.contactId && c.contactId) {
    const [updated] = await tx.update(conversations).set({ contactId: c.contactId }).where(eq(conversations.id, row.id)).returning();
    return updated!;
  }
  return row!;
}

/** Appends a message. Returns null when `externalId` was already stored (provider retry). */
export async function appendMessage(
  tx: Tx,
  m: { tenantId: string; conversationId: string; direction: "in" | "out"; role: MessageRow["role"]; body: string; externalId?: string | null },
): Promise<MessageRow | null> {
  const [row] = await tx
    .insert(messages)
    .values({ ...m, body: m.body.slice(0, 8000), externalId: m.externalId ?? null })
    .onConflictDoNothing()
    .returning();
  if (row) await tx.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, m.conversationId));
  return row ?? null;
}

/** Last `limit` messages in chronological order. */
export async function recentMessages(tx: Tx, tenantId: string, conversationId: string, limit = 40): Promise<MessageRow[]> {
  const rows = await tx
    .select()
    .from(messages)
    .where(and(eq(messages.tenantId, tenantId), eq(messages.conversationId, conversationId)))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit);
  return rows.reverse();
}

export async function countUserMessages(tx: Tx, tenantId: string, conversationId: string): Promise<number> {
  const [r] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.tenantId, tenantId), eq(messages.conversationId, conversationId), eq(messages.role, "user")));
  return r?.n ?? 0;
}

export async function listMessages(tx: Tx, tenantId: string, conversationId: string): Promise<MessageRow[]> {
  return tx
    .select()
    .from(messages)
    .where(and(eq(messages.tenantId, tenantId), eq(messages.conversationId, conversationId)))
    .orderBy(asc(messages.createdAt));
}

export async function linkContact(tx: Tx, tenantId: string, conversationId: string, contactId: string, propertyId?: string | null) {
  await tx
    .update(conversations)
    .set({ contactId, ...(propertyId ? { propertyId } : {}) })
    .where(and(eq(conversations.tenantId, tenantId), eq(conversations.id, conversationId)));
}

/** Marks the conversation for a human. Returns false if it was already marked (no duplicate alerts). */
export async function requestHandoff(tx: Tx, tenantId: string, conversationId: string, now = new Date()): Promise<boolean> {
  const rows = await tx
    .update(conversations)
    .set({ handoffRequestedAt: now })
    .where(and(eq(conversations.tenantId, tenantId), eq(conversations.id, conversationId), sql`${conversations.handoffRequestedAt} is null`))
    .returning({ id: conversations.id });
  return rows.length > 0;
}

/* ───────────── web chat token ───────────── */

/**
 * The browser keeps `{conversationId}.{mac}` so a visitor can only continue their own conversation:
 * guessing another id is not enough to read (or make the assistant recite) someone else's history.
 */
export const conversationToken = (tenantId: string, conversationId: string) => sign("chat", `${tenantId}:${conversationId}`);

export function readConversationToken(token: string | null | undefined, tenantId: string): string | null {
  const data = verify("chat", token);
  if (!data) return null;
  const [t, id] = data.split(":");
  return t === tenantId && id ? id : null;
}
