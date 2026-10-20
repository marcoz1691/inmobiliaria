"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { act, isUuid } from "@/app/panel/_server/act";
import { createFunnelFromTemplate, setFunnelStatus } from "@/modules/funnels/service";
import { FUNNEL_TEMPLATES } from "@/modules/funnels/scoring";
import { funnelHasAvailability } from "@/modules/agents/admin";
import { AppError, notFound } from "@/lib/errors";

const createSchema = z.object({
  template: z.enum(FUNNEL_TEMPLATES.map((t) => t.key) as [string, ...string[]]),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,60}$/, "Usa de 3 a 60 letras minúsculas, números o guiones"),
});

export async function createFunnelAction(input: unknown) {
  const r = await act("funnel.create", async (m) => {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) throw new AppError("invalid", parsed.error.issues[0]?.message ?? "Datos no válidos");
    try {
      const f = await createFunnelFromTemplate(m, parsed.data.template as (typeof FUNNEL_TEMPLATES)[number]["key"], parsed.data.slug);
      return { id: f.id };
    } catch (err) {
      // Unique (tenant, slug) violation.
      if (!(err instanceof AppError) && /unique|duplicate/i.test(String((err as Error)?.message ?? ""))) throw new AppError("conflict", "Ya tienes un embudo con esa dirección. Elige otra.");
      throw err;
    }
  });
  if (r.ok) revalidatePath("/panel/embudos");
  return r;
}

export async function setFunnelStatusAction(funnelId: string, status: "active" | "paused") {
  const r = await act("funnel.status", async (m) => {
    if (!isUuid(funnelId)) throw notFound("Embudo");
    if (status !== "active" && status !== "paused") throw new AppError("invalid", "Estado no válido");
    if (status === "active" && !(await funnelHasAvailability(m, funnelId))) {
      throw new AppError("invalid", "Configura tus horarios de atención en Agenda antes de activar el embudo.");
    }
    await setFunnelStatus(m, funnelId, status);
  });
  if (r.ok) revalidatePath("/panel/embudos");
  return r;
}
