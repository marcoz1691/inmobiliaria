"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { errorInfo, log } from "@/lib/logger";
import { availableSlots, bookSlot, getActiveFunnel, submissionSchema, submitFunnel } from "@/modules/funnels/service";
import { formatAppointment, groupSlotsByDay } from "@/components/funnel/slots";
import { MEETING_LABEL, type BookResult, type FunnelSubmitInput, type FunnelSubmitResult, type Schedule } from "@/components/funnel/types";
import { getCurrentTenant } from "@/server/tenant";
import { getDb } from "@/server/db/client";
import { googleBusyProvider } from "@/modules/integrations/google";
import { checkPublicForm, GUARD_MESSAGE } from "../../../_lib/guard";

const slugSchema = z.string().regex(/^[a-z0-9-]{1,60}$/);

/** External busy times (Google Calendar) when the agent connected it; resolved outside the booking transaction. */
async function busy(tenantId: string) {
  return googleBusyProvider(await getDb(), tenantId);
}

async function schedule(tenantId: string, funnelId: string): Promise<Schedule> {
  const s = await availableSlots(tenantId, funnelId, { busyProvider: await busy(tenantId) });
  return { timezone: s.timezone, durationMinutes: s.durationMinutes, days: groupSlotsByDay(s.slots, s.timezone) };
}

async function funnelFor(slug: unknown) {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  const tenant = await getCurrentTenant();
  const funnel = await getActiveFunnel(tenant.id, parsed.data);
  return funnel ? { tenant, funnel } : null;
}

/** Qualification step. Qualified visitors get their bookable slots in the same round trip. */
export async function submitFunnelAction(slug: string, input: FunnelSubmitInput): Promise<FunnelSubmitResult> {
  const guard = await checkPublicForm({
    honeypot: input?.honeypot,
    token: input?.formToken,
    minMs: 3000,
    scope: "funnel",
    max: 10,
    windowSec: 600,
  });
  if (guard) return { ok: false, error: GUARD_MESSAGE[guard] };

  const ctx = await funnelFor(slug);
  if (!ctx) return { ok: false, error: "Este formulario ya no está disponible." };

  const fbp = input.fbp ?? (await cookies()).get("_fbp")?.value;
  const parsed = submissionSchema.safeParse({
    answers: input.answers,
    name: input.name,
    email: input.email,
    phone: input.phone,
    consent: input.consent,
    utm: input.utm,
    fbclid: input.fbclid,
    fbc: input.fbc,
    fbp,
    eventId: input.eventId,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los campos marcados.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const outcome = await submitFunnel(ctx.tenant.id, ctx.funnel.id, parsed.data);
    if (!outcome.qualified) return { ok: true, qualified: false };
    return {
      ok: true,
      qualified: true,
      submissionId: outcome.submissionId,
      pass: outcome.pass,
      schedule: await schedule(ctx.tenant.id, ctx.funnel.id).catch((err) => {
        log.error("slots failed", errorInfo(err));
        return { timezone: ctx.tenant.timezone, durationMinutes: ctx.funnel.durationMinutes, days: [] };
      }),
    };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    log.error("funnel submit failed", errorInfo(err));
    return { ok: false, error: "No pudimos enviar tus respuestas. Inténtalo de nuevo en unos minutos." };
  }
}

const bookSchema = z.object({ submissionId: z.uuid(), pass: z.string().min(10).max(200), startsAt: z.iso.datetime() });

export async function bookSlotAction(slug: string, input: { submissionId: string; pass: string; startsAt: string }): Promise<BookResult> {
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Elige un horario de la lista." };
  const ctx = await funnelFor(slug);
  if (!ctx) return { ok: false, error: "Este formulario ya no está disponible." };
  try {
    const { booking, manageToken } = await bookSlot(ctx.tenant.id, {
      submissionId: parsed.data.submissionId,
      pass: parsed.data.pass,
      startsAt: new Date(parsed.data.startsAt),
      busyProvider: await busy(ctx.tenant.id),
    });
    return {
      ok: true,
      booking: {
        bookingId: booking.id,
        when: formatAppointment(booking.startsAt, ctx.tenant.timezone),
        durationMinutes: ctx.funnel.durationMinutes,
        meetingLabel: MEETING_LABEL[booking.meetingKind],
        manageUrl: `/cita/${manageToken}`,
        icsUrl: `/cita/${manageToken}/ics`,
      },
    };
  } catch (err) {
    if (err instanceof AppError) {
      const refreshed = err.code === "conflict" ? await schedule(ctx.tenant.id, ctx.funnel.id).catch(() => undefined) : undefined;
      return { ok: false, error: err.message, ...(refreshed ? { schedule: refreshed } : {}) };
    }
    log.error("booking failed", errorInfo(err));
    return { ok: false, error: "No pudimos agendar la cita. Inténtalo de nuevo en unos minutos." };
  }
}
