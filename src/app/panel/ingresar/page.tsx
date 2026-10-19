import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMember } from "@/server/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage() {
  if (await getMember()) redirect("/panel");
  return (
    <main id="contenido" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-16">
      <p className="text-eyebrow text-clay">Panel del agente</p>
      <h1 className="mt-2 font-display text-display-md text-ink">Ingresa a tu panel</h1>
      <p className="mt-2 text-sm text-ink-muted">Publica propiedades y atiende a tus prospectos desde cualquier dispositivo.</p>
      <LoginForm />
    </main>
  );
}
