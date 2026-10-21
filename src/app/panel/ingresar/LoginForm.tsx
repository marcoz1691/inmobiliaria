"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/admin/ui/Button";
import { Icon } from "@/components/admin/ui/Icon";
import { inputClass, labelClass } from "@/components/admin/fields";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    if (error) {
      setPending(false);
      setError(error.status === 429 ? "Demasiados intentos. Espera un minuto e inténtalo de nuevo." : "Correo o contraseña incorrectos.");
      return;
    }
    router.replace("/panel");
    router.refresh();
  }

  return (
    <form method="post" action="/panel/ingresar" onSubmit={onSubmit} className="mt-8 rounded-md bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_20px_50px_-24px_rgba(0,0,0,0.18)] ring-1 ring-ink/[0.04] sm:p-6" noValidate>
      <div className="space-y-4">
        <div>
          <label htmlFor="email" className={labelClass}>
            Correo
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required inputMode="email" autoCapitalize="none" className={inputClass} aria-invalid={error ? true : undefined} aria-describedby={error ? "login-error" : undefined} />
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>
            Contraseña
          </label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} aria-invalid={error ? true : undefined} aria-describedby={error ? "login-error" : undefined} />
        </div>
      </div>
      {error ? (
        <p id="login-error" role="alert" className="mt-4 flex items-start gap-1.5 text-sm font-medium text-sold">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="mt-6 w-full" pending={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
