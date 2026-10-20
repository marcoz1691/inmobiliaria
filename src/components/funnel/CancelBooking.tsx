"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IDLE, type FormState } from "@/components/public/form-state";

type Props = { token: string; action: (prev: FormState, fd: FormData) => Promise<FormState> };

/** Two-step cancel: nothing changes until the visitor confirms. */
export function CancelBooking({ token, action }: Props) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const [confirming, setConfirming] = useState(false);

  if (state.status === "success") {
    return (
      <EmptyState
        tone="success"
        headingLevel={2}
        title={state.message}
        description="Si quieres, puedes agendar otra fecha cuando te venga mejor."
        action={<Button href="/">Volver al inicio</Button>}
      />
    );
  }

  if (!confirming) {
    return (
      <Button variant="secondary" size="lg" onClick={() => setConfirming(true)}>
        Cancelar la cita
      </Button>
    );
  }

  return (
    <form action={formAction} className="border-t-2 border-sold pt-5">
      <input type="hidden" name="token" value={token} />
      <p className="text-base font-medium text-ink">¿Seguro que quieres cancelar esta cita?</p>
      <p className="mt-1 text-sm text-ink-muted">El horario quedará libre para otra persona.</p>
      {state.status === "error" ? (
        <p role="alert" className="mt-3 text-sm font-medium text-sold">
          {state.message}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Button type="submit" size="lg" disabled={pending} className="bg-sold hover:bg-sold/90">
          {pending ? "Cancelando…" : "Sí, cancelar la cita"}
        </Button>
        <Button variant="ghost" size="lg" onClick={() => setConfirming(false)} disabled={pending}>
          No, mantenerla
        </Button>
      </div>
    </form>
  );
}
