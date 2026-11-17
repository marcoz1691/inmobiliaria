"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/admin/ui/Button";
import { Icon } from "@/components/admin/ui/Icon";
import { inputClass, labelClass } from "@/components/admin/fields";

const card = "mt-8 rounded-md bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_20px_50px_-24px_rgba(0,0,0,0.18)] ring-1 ring-ink/[0.04] sm:p-6";

export function RecoverForm() {
  const [state, setState] = useState<"idle" | "pending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!email.includes("@")) {
      setError("Escribe un correo válido.");
      return;
    }
    setState("pending");
    setError(null);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/panel/restablecer" });
    if (error) {
      setState("idle");
      setError(error.status === 429 ? "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." : "No pudimos enviar el correo. Inténtalo de nuevo.");
      return;
    }
    // Same answer whether or not the account exists, so the form cannot be used to probe emails.
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div role="status" className={`${card} text-center`}>
        <p className="font-semibold text-ink">Revisa tu correo</p>
        <p className="mt-2 text-[0.9375rem] text-ink-muted">
          Si hay una cuenta con ese correo, te llegará un enlace para elegir una nueva contraseña. Vence en 1 hora; revisa también la carpeta de spam.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={card} noValidate>
      <label htmlFor="email" className={labelClass}>
        Correo
      </label>
      <input id="email" name="email" type="email" autoComplete="email" required inputMode="email" autoCapitalize="none" className={inputClass} aria-invalid={error ? true : undefined} aria-describedby={error ? "recover-error" : undefined} />
      {error ? (
        <p id="recover-error" role="alert" className="mt-4 flex items-start gap-1.5 text-sm font-medium text-sold">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="mt-6 w-full" pending={state === "pending"}>
        {state === "pending" ? "Enviando…" : "Enviar enlace"}
      </Button>
    </form>
  );
}
