"use server";
import { revalidatePath } from "next/cache";
import { act, isUuid } from "@/app/panel/_server/act";
import { registerChannelAccount, removeChannelAccount, type ChannelAccountInput } from "@/modules/integrations/channel-accounts";
import { notFound } from "@/lib/errors";

export async function registerChannelAccountAction(input: ChannelAccountInput) {
  const r = await act("channel_account.register", (m) => registerChannelAccount(m, input));
  if (r.ok) revalidatePath("/panel/integraciones");
  return r;
}

export async function removeChannelAccountAction(id: string) {
  const r = await act("channel_account.remove", async (m) => {
    if (!isUuid(id)) throw notFound("Cuenta");
    await removeChannelAccount(m, id);
  });
  if (r.ok) revalidatePath("/panel/integraciones");
  return r;
}
