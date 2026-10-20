"use server";

import { z } from "zod";
import { AppError } from "@/lib/errors";
import { errorInfo, log } from "@/lib/logger";
import { captureInquiry, inquirySchema } from "@/modules/crm/service";
import { cancelBookingByToken } from "@/modules/funnels/service";
import { getCurrentTenant } from "@/server/tenant";
import type { FormState } from "@/components/public/form-state";
import { checkPublicForm, GUARD_MESSAGE, HONEYPOT_FIELD } from "./guard";

const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : undefined;
};

/** Public contact / property inquiry form (progressively enhanced with useActionState). */
export async function submitInquiry(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = {
    name: str(fd, "name") ?? "",
    email: str(fd, "email") ?? "",
    phone: str(fd, "phone") ?? "",
    message: str(fd, "message") ?? "",
    consent: fd.get("consent") === "on" ? "on" : "",
  };
  const guard = await checkPublicForm({
    honeypot: fd.get(HONEYPOT_FIELD),
    token: fd.get("form_token"),
    minMs: 3000,
    scope: "inquiry",
    max: 8,
    windowSec: 600,
  });
  if (guard) return { status: "error", message: GUARD_MESSAGE[guard], values };

  const parsed = inquirySchema.safeParse({
    name: values.name,
    email: values.email,
    phone: values.phone,
    message: values.message || undefined,
    consent: values.consent === "on",
    propertyId: str(fd, "propertyId") || undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los campos marcados.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      values,
    };
  }
  try {
    const tenant = await getCurrentTenant();
    await captureInquiry(tenant.id, parsed.data, { source: parsed.data.propertyId ? "property_form" : "contact_form" });
    return { status: "success", message: "¡Gracias! Recibí tu mensaje y te responderé lo antes posible." };
  } catch (err) {
    if (err instanceof AppError) return { status: "error", message: err.message, values };
    log.error("inquiry failed", errorInfo(err));
    return { status: "error", message: "No pudimos enviar tu mensaje. Inténtalo de nuevo en unos minutos.", values };
  }
}

/** Cancels an appointment from the signed link in the visitor's confirmation. */
export async function cancelBooking(_prev: FormState, fd: FormData): Promise<FormState> {
  const token = str(fd, "token");
  if (!token || token.length > 200) return { status: "error", message: "El enlace no es válido." };
  try {
    const tenant = await getCurrentTenant();
    await cancelBookingByToken(tenant.id, token);
    return { status: "success", message: "Tu cita fue cancelada." };
  } catch (err) {
    if (err instanceof AppError) {
      return { status: "error", message: err.code === "not_found" ? "Esta cita ya no está activa." : err.message };
    }
    log.error("booking cancel failed", errorInfo(err));
    return { status: "error", message: "No pudimos cancelar la cita. Inténtalo de nuevo en unos minutos." };
  }
}
