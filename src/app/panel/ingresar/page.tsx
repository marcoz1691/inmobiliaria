import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMember } from "@/server/session";
import { Icon } from "@/components/admin/ui/Icon";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage() {
  if (await getMember()) redirect("/panel");
  return (
    <main id="contenido" className="flex w-full flex-1 flex-col items-center justify-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-[25rem] transition-[opacity,translate] duration-700 ease-apple starting:translate-y-3 starting:opacity-0">
        <div className="flex flex-col items-center text-center">
          <span aria-hidden="true" className="grid size-16 place-items-center rounded-[18px] bg-navy text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.35)]">
            <Icon name="building" className="size-8" strokeWidth={1.8} />
          </span>
          <p className="mt-5 text-[0.9375rem] font-semibold text-ink-muted">Panel del agente</p>
          <h1 className="mt-1 font-display text-[2rem] leading-tight font-bold tracking-[-0.025em] text-ink">Ingresa a tu panel</h1>
          <p className="mt-2 max-w-xs text-[0.9375rem] leading-relaxed text-ink-muted">Publica propiedades y atiende a tus prospectos desde cualquier dispositivo.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
