import { and, eq, isNull, or } from "drizzle-orm";
import type { Tx } from "@/server/db/tenant-tx";
import { automationSequences, type SequenceStep } from "@/server/db/schema";
import { enqueue } from "@/modules/jobs/queue";

export type SequenceTrigger = "booking_created" | "lead_created" | "lead_unqualified" | "no_show";

export type SequenceContext = {
  tenantId: string;
  contactId: string;
  dealId: string;
  funnelId?: string | null;
  bookingId?: string | null;
  bookingStart?: Date | null;
  now?: Date;
};

/** Defaults installed for every new funnel. Templates live in src/modules/automations/templates.ts. */
export const DEFAULT_SEQUENCES: { name: string; trigger: SequenceTrigger; steps: SequenceStep[] }[] = [
  {
    name: "Confirmación y recordatorios de cita",
    trigger: "booking_created",
    steps: [
      { id: "confirm-email", channel: "email", anchor: "trigger", offsetMinutes: 0, template: "booking_confirmation" },
      { id: "confirm-wa", channel: "whatsapp", anchor: "trigger", offsetMinutes: 0, template: "booking_confirmation" },
      { id: "r24-email", channel: "email", anchor: "booking_start", offsetMinutes: -1440, template: "booking_reminder_24h" },
      { id: "r24-wa", channel: "whatsapp", anchor: "booking_start", offsetMinutes: -1440, template: "booking_reminder_24h" },
      { id: "r1-wa", channel: "whatsapp", anchor: "booking_start", offsetMinutes: -60, template: "booking_reminder_1h" },
    ],
  },
  {
    name: "Seguimiento a prospectos no calificados",
    trigger: "lead_unqualified",
    steps: [
      { id: "nurture-0", channel: "email", anchor: "trigger", offsetMinutes: 0, template: "nurture_welcome" },
      { id: "nurture-3d", channel: "email", anchor: "trigger", offsetMinutes: 3 * 1440, template: "nurture_catalog" },
    ],
  },
  {
    name: "Recuperar inasistencias",
    trigger: "no_show",
    steps: [
      { id: "noshow-wa", channel: "whatsapp", anchor: "trigger", offsetMinutes: 30, template: "no_show_followup" },
      { id: "noshow-email", channel: "email", anchor: "trigger", offsetMinutes: 60, template: "no_show_followup" },
    ],
  },
];

export async function installDefaultSequences(tx: Tx, tenantId: string, funnelId: string) {
  await tx.insert(automationSequences).values(DEFAULT_SEQUENCES.map((s) => ({ ...s, tenantId, funnelId })));
}

/** Enqueues one `message.send` job per step. Idempotent per (sequence, step, booking|deal). */
export async function scheduleSequence(tx: Tx, trigger: SequenceTrigger, ctx: SequenceContext): Promise<number> {
  const now = ctx.now ?? new Date();
  const sequences = await tx
    .select()
    .from(automationSequences)
    .where(
      and(
        eq(automationSequences.tenantId, ctx.tenantId),
        eq(automationSequences.trigger, trigger),
        eq(automationSequences.active, true),
        ctx.funnelId ? or(eq(automationSequences.funnelId, ctx.funnelId), isNull(automationSequences.funnelId)) : isNull(automationSequences.funnelId),
      ),
    );
  let count = 0;
  for (const seq of sequences) {
    for (const step of seq.steps) {
      const anchor = step.anchor === "booking_start" ? ctx.bookingStart : now;
      if (!anchor) continue;
      const runAt = new Date(anchor.getTime() + step.offsetMinutes * 60_000);
      // A reminder whose moment already passed (booking made last minute) is skipped, not sent late.
      if (step.offsetMinutes !== 0 && runAt.getTime() < now.getTime()) continue;
      const scope = ctx.bookingId ? `booking:${ctx.bookingId}` : `deal:${ctx.dealId}`;
      await enqueue(tx, {
        tenantId: ctx.tenantId,
        type: "message.send",
        runAt,
        idempotencyKey: `${scope}:seq:${seq.id}:${step.id}`,
        payload: { channel: step.channel, template: step.template, contactId: ctx.contactId, dealId: ctx.dealId, bookingId: ctx.bookingId ?? null },
      });
      count++;
    }
  }
  return count;
}
