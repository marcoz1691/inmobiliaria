"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { act, isUuid } from "@/app/panel/_server/act";
import { addNote, addTask, DEAL_STAGES, moveDeal, toggleTask } from "@/modules/crm/service";
import { AppError, notFound } from "@/lib/errors";

const uuid = (v: string, what = "Prospecto") => {
  if (!isUuid(v)) throw notFound(what);
  return v;
};

const moveSchema = z.object({ stage: z.enum(DEAL_STAGES), lostReason: z.string().trim().max(300).optional() });

export async function moveDealAction(dealId: string, input: unknown) {
  const r = await act("deal.move", async (m) => {
    const parsed = moveSchema.safeParse(input);
    if (!parsed.success) throw new AppError("invalid", "Etapa no válida");
    if (parsed.data.stage === "lost" && !parsed.data.lostReason) throw new AppError("invalid", "Escribe el motivo por el que se perdió");
    await moveDeal(m, uuid(dealId), parsed.data.stage, parsed.data.lostReason);
  });
  if (r.ok) revalidatePath("/panel/prospectos");
  return r;
}

export async function addNoteAction(dealId: string, body: string) {
  const r = await act("deal.note", (m) => addNote(m, uuid(dealId), String(body ?? "")));
  if (r.ok) revalidatePath(`/panel/prospectos/${dealId}`);
  return r;
}

const taskSchema = z.object({
  title: z.string().trim().min(2, "Describe la tarea").max(200),
  dueAt: z.string().trim().optional(),
});

export async function addTaskAction(dealId: string, input: unknown) {
  const r = await act("deal.task", async (m) => {
    const parsed = taskSchema.safeParse(input);
    if (!parsed.success) throw new AppError("invalid", "Describe la tarea");
    let due: Date | null = null;
    if (parsed.data.dueAt) {
      // datetime-local has no zone: the panel works in Ecuador time (UTC−5, no DST).
      due = new Date(`${parsed.data.dueAt}:00-05:00`);
      if (Number.isNaN(due.getTime())) throw new AppError("invalid", "Fecha no válida");
    }
    await addTask(m, uuid(dealId), parsed.data.title, due);
  });
  if (r.ok) revalidatePath(`/panel/prospectos/${dealId}`);
  return r;
}

export async function toggleTaskAction(dealId: string, taskId: string) {
  const r = await act("deal.task.toggle", (m) => toggleTask(m, uuid(taskId, "Tarea")));
  if (r.ok) revalidatePath(`/panel/prospectos/${dealId}`);
  return r;
}
