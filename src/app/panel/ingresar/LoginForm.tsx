"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";

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
    setPending(false);
    if (error) {
      setError(error.status === 429 ? "Demasiados intentos. Espera un minuto e inténtalo de nuevo." : "Correo o contraseña incorrectos.");
      return;
    }
    router.replace("/panel");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink">Correo</label>
        <input id="email" name="email" type="email" autoComplete="email" required inputMode="email"
          className="mt-1.5 block min-h-11 w-full rounded border border-line-strong bg-white px-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy" />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required
          className="mt-1.5 block min-h-11 w-full rounded border border-line-strong bg-white px-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy" />
      </div>
      {error ? <p role="alert" className="text-sm text-sold">{error}</p> : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
