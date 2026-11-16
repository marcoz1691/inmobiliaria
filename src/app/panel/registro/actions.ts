"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { errorInfo, log } from "@/lib/logger";
import { registerAgent, registrationSchema } from "@/modules/agents/registration";
import { getAuth } from "@/server/auth";
import { getHostTenant } from "@/server/tenant";
import { checkPublicForm, GUARD_MESSAGE, HONEYPOT_FIELD } from "../../(public)/_lib/guard";

export type RegisterState = {
  status: "idle" | "error" | "success";
  /** Where the browser goes next, in a fresh request that carries the new session cookie. */
  next?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: { name: string; email: string; whatsapp: string; province: string; city: string };
};

const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};

/** Agent sign-up on the portal: creates the account and workspace, signs in and opens the panel. */
export async function register(_prev: RegisterState, fd: FormData): Promise<RegisterState> {
  const values = { name: str(fd, "name"), email: str(fd, "email"), whatsapp: str(fd, "whatsapp"), province: str(fd, "province"), city: str(fd, "city") };
  // Sign-up exists only on the portal; an agent's own domain serves that agent's team.
  if (await getHostTenant()) return { status: "error", message: "El registro está disponible en el portal.", values };

  const guard = await checkPublicForm({
    honeypot: fd.get(HONEYPOT_FIELD),
    token: fd.get("form_token"),
    minMs: 3000,
    scope: "signup",
    max: 5,
    windowSec: 3600,
  });
  if (guard) return { status: "error", message: GUARD_MESSAGE[guard], values };

  const parsed = registrationSchema.safeParse({ ...values, password: str(fd, "password") });
  if (!parsed.success) {
    return { status: "error", message: "Revisa los campos marcados.", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }
  try {
    await registerAgent(parsed.data);
  } catch (err) {
    if (err instanceof AppError) {
      return { status: "error", message: err.message, fieldErrors: err.details?.field ? { [String(err.details.field)]: [err.message] } : undefined, values };
    }
    log.error("agent sign-up failed", errorInfo(err));
    return { status: "error", message: "No pudimos crear tu cuenta. Inténtalo de nuevo en unos minutos.", values };
  }
  try {
    const auth = await getAuth();
    await auth.api.signInEmail({ body: { email: parsed.data.email, password: parsed.data.password }, headers: await headers() });
  } catch (err) {
    // The account exists; worst case the agent signs in by hand.
    log.error("sign-in after sign-up failed", errorInfo(err));
    redirect("/panel/ingresar?nuevo=1");
  }
  // First stop for a new agent: the plans, with the free one already active. Not a server
  // redirect: the page it renders in this same request would not see the cookie just set.
  return { status: "success", next: "/panel/plan?bienvenida=1" };
}
