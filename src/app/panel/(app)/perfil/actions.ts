"use server";
import { revalidatePath } from "next/cache";
import { act } from "@/app/panel/_server/act";
import { updateProfile, updateSite } from "@/modules/agents/admin";

export async function saveProfileAction(input: unknown) {
  const r = await act("profile.save", async (m) => {
    await updateProfile(m, input);
  });
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

export async function saveSiteAction(input: unknown) {
  const r = await act("site.save", (m) => updateSite(m, input));
  if (r.ok) revalidatePath("/", "layout");
  return r;
}
