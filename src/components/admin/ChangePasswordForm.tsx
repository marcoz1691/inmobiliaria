"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/Button";
import { inputClass, labelClass } from "./fields";

/** Lets the signed-in agent change their password; other sessions are closed on success. */
export function ChangePasswordForm() {
  const [state, setState] = useState<{ kind: "idle" | "ok" | "error"; message?: string }>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const currentPassword = String(fd.get("current") ?? "");
    const newPassword = String(fd.get("next") ?? "");
    if (newPassword.length < 10) return setState({ kind: "error", message: "La nueva contraseña debe tener al menos 10 caracteres." });
    if (newPassword !== String(fd.get("repeat") ?? "")) return setState({ kind: "error", message: "Las contraseñas nuevas no coinciden." });
    setPending(true);
    const { error } = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
    setPending(false);
    if (error) return setState({ kind: "error", message: error.status === 429 ? "Demasiados intentos. Espera un minuto." : "La contraseña actual no es correcta." });
    form.reset();
    setState({ kind: "ok", message: "Contraseña actualizada. Cerramos tus otras sesiones." });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:max-w-md" noValidate>
      <div>
        <label htmlFor="pw-current" className={labelClass}>
          Contraseña actual
        </label>
        <input id="pw-current" name="current" type="password" autoComplete="current-password" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="pw-next" className={labelClass}>
          Nueva contraseña
        </label>
        <input id="pw-next" name="next" type="password" autoComplete="new-password" required minLength={10} className={inputClass} />
      </div>
      <div>
        <label htmlFor="pw-repeat" className={labelClass}>
          Repite la nueva contraseña
        </label>
        <input id="pw-repeat" name="repeat" type="password" autoComplete="new-password" required minLength={10} className={inputClass} />
      </div>
      {state.kind !== "idle" ? (
        <p role={state.kind === "error" ? "alert" : "status"} className={state.kind === "error" ? "text-sm font-medium text-sold" : "text-sm font-medium text-available"}>
          {state.message}
        </p>
      ) : null}
      <div>
        <Button type="submit" pending={pending}>
          {pending ? "Guardando…" : "Cambiar contraseña"}
        </Button>
      </div>
    </form>
  );
}
