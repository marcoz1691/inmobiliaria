import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/admin/ui/Icon";
import { getMember } from "@/server/session";
import { getHostTenant } from "@/server/tenant";
import { HONEYPOT_FIELD, issueFormToken } from "../../(public)/_lib/guard";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Crea tu cuenta de agente" };

export default async function RegisterPage() {
  if (await getHostTenant()) notFound();
  if (await getMember()) redirect("/panel");
  return (
    <main id="contenido" className="flex w-full flex-1 flex-col items-center justify-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-[28rem]">
        <div className="flex flex-col items-center text-center">
          <span aria-hidden="true" className="grid size-16 place-items-center rounded-[18px] bg-navy text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.35)]">
            <Icon name="building" className="size-8" strokeWidth={1.8} />
          </span>
          <p className="mt-5 text-[0.9375rem] font-semibold text-ink-muted">Para agentes inmobiliarios</p>
          <h1 className="mt-1 font-display text-[2rem] leading-tight font-bold tracking-[-0.025em] text-ink">Crea tu cuenta</h1>
          <p className="mt-2 max-w-sm text-[0.9375rem] leading-relaxed text-ink-muted">
            Publica tus propiedades en el portal y recibe las consultas en tu panel.
          </p>
        </div>
        <RegisterForm formToken={issueFormToken()} honeypotName={HONEYPOT_FIELD} />
        <p className="mt-6 text-center text-[0.9375rem] text-ink-muted">
          ¿Ya tienes cuenta?{" "}
          <Link href="/panel/ingresar" className="font-medium text-link underline-offset-4 hover:underline">
            Ingresa
          </Link>
        </p>
      </div>
    </main>
  );
}
