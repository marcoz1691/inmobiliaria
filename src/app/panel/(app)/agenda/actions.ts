"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { act, isUuid } from "@/app/panel/_server/act";
import { markBookingOutcome, setWeeklyAvailability } from "@/modules/funnels/service";
import { getMyProfile } from "@/modules/agents/admin";
import { AppError, notFound } from "@/lib/errors";

const rulesSchema = z
  .array(z.object({ weekday: z.number().int().min(0).max(6), startMinute: z.number().int().min(0).max(1439), endMinute: z.number().int().min(1).max(1440) }))
  .max(70);

/** Rejects overlapping ranges in the same day: they would produce duplicated slots. */
export async function saveAvailabilityAction(rules: unknown) {
  const r = await act("availability.save", async (m) => {
    const parsed = rulesSchema.safeParse(rules);
    if (!parsed.success) throw new AppError("invalid", "Horario no válido");
    const list = [...parsed.data].sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
    for (const [i, x] of list.entries()) {
      if (x.startMinute >= x.endMinute) throw new AppError("invalid", "Cada franja debe terminar después de empezar.");
      const prev = list[i - 1];
      if (prev && prev.weekday === x.weekday && prev.endMinute > x.startMinute) throw new AppError("invalid", "Hay franjas que se cruzan en el mismo día.");
    }
    const profile = await getMyProfile(m);
    if (!profile) throw notFound("Perfil de agente");
    await setWeeklyAvailability(m, profile.id, list);
  });
  if (r.ok) revalidatePath("/panel/agenda");
  return r;
}

export async function bookingOutcomeAction(bookingId: string, outcome: "completed" | "no_show") {
  const r = await act("booking.outcome", async (m) => {
    if (!isUuid(bookingId)) throw notFound("Cita");
    if (outcome !== "completed" && outcome !== "no_show") throw new AppError("invalid", "Resultado no válido");
    await markBookingOutcome(m, bookingId, outcome);
  });
  if (r.ok) revalidatePath("/panel/agenda");
  return r;
}
