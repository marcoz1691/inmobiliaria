"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConsentCheckbox, Honeypot, TextArea, TextField } from "./fields";
import { IDLE, type FormState } from "./form-state";

type InquiryFormProps = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  formToken: string;
  honeypotName: string;
  consentText: string;
  propertyId?: string;
  defaultMessage?: string;
  submitLabel?: string;
};

/** Contact / property inquiry. Works without JavaScript (Server Action); errors are announced. */
export function InquiryForm({
  action,
  formToken,
  honeypotName,
  consentText,
  propertyId,
  defaultMessage = "",
  submitLabel = "Enviar mensaje",
}: InquiryFormProps) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const id = useId();
  const alertRef = useRef<HTMLParagraphElement>(null);
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};
  const values = state.status === "error" ? state.values ?? {} : {};
  const first = (k: string) => errors[k]?.[0];

  useEffect(() => {
    if (state.status === "error") alertRef.current?.focus();
  }, [state]);

  if (state.status === "success") {
    return (
      <EmptyState
        tone="success"
        headingLevel={3}
        title="Mensaje enviado"
        description={<p>{state.message}</p>}
      />
    );
  }

  return (
    <form action={formAction} noValidate className="relative flex flex-col gap-5">
      <Honeypot name={honeypotName} />
      <input type="hidden" name="form_token" value={formToken} />
      {propertyId ? <input type="hidden" name="propertyId" value={propertyId} /> : null}

      {state.status === "error" ? (
        <p ref={alertRef} tabIndex={-1} role="alert" className="rounded-sm bg-sold-bg px-4 py-3 text-sm font-medium text-sold">
          {state.message}
        </p>
      ) : null}

      <TextField id={`${id}-name`} name="name" label="Nombre" autoComplete="name" required defaultValue={values.name} error={first("name")} />
      <TextField
        id={`${id}-phone`}
        name="phone"
        label="Teléfono o WhatsApp"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        defaultValue={values.phone}
        hint="Déjanos un teléfono o un correo."
        error={first("phone")}
      />
      <TextField
        id={`${id}-email`}
        name="email"
        label="Correo"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={values.email}
        error={first("email")}
      />
      <TextArea
        id={`${id}-message`}
        name="message"
        label="Mensaje"
        optional
        maxLength={2000}
        defaultValue={values.message ?? defaultMessage}
        error={first("message")}
      />
      <ConsentCheckbox id={`${id}-consent`} text={consentText} defaultChecked={values.consent === "on"} error={first("consent")} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Enviando…" : submitLabel}
      </Button>
    </form>
  );
}
