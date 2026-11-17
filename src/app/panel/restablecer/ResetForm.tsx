"use client";
import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/admin/ui/Button";
import { Icon } from "@/components/admin/ui/Icon";
import { inputClass, labelClass } from "@/components/admin/fields";

const MIN = 10;
const card = "mt-8 rounded-md bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_20px_50px_-24px_rgba(0,0,0,0.18)] ring-1 ring-ink/[0.04] sm:p-6";

export function ResetForm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < MIN) return setError(`Usa al menos ${MIN} caracteres.`);
    if (password !== String(form.get("confirm") ?? "")) return setError("Las contraseñas no coinciden.");
    setState("pending");
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) {
      setState("idle");
      setError("El enlace venció o ya se usó. Pide uno nuevo.");
      return;
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <div role="status" className={`${card} text-center`}>
        <p className="font-semibold text-ink">Contraseña actualizada</p>
        <p className="mt-2 text-[0.9375rem] text-ink-muted">Cerramos las sesiones abiertas por seguridad. Ingresa con tu nueva contraseña.</p>
        <Link href="/panel/ingresar" className="mt-5 inline-block font-semibold text-link underline-offset-4 hover:underline">
          Ir a ingresar
        </Link>
      </div>
    );
  }

  const describedBy = error ? "reset-error" : "reset-hint";
  return (
    <form onSubmit={onSubmit} className={card} noValidate>
      <div className="space-y-4">
        <div>
          <label htmlFor="password" className={labelClass}>
            Nueva contraseña
          </label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={MIN} className={inputClass} aria-describedby={describedBy} aria-invalid={error ? true : undefined} />
          <p id="reset-hint" className="mt-1.5 text-sm text-ink-muted">
            Al menos {MIN} caracteres.
          </p>
        </div>
        <div>
          <label htmlFor="confirm" className={labelClass}>
            Repítela
          </label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className={inputClass} aria-invalid={error ? true : undefined} />
        </div>
      </div>
      {error ? (
        <p id="reset-error" role="alert" className="mt-4 flex items-start gap-1.5 text-sm font-medium text-sold">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="mt-6 w-full" pending={state === "pending"}>
        {state === "pending" ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
