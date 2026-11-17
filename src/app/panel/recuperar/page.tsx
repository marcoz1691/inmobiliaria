import type { Metadata } from "next";
import Link from "next/link";
import { env, integrations } from "@/env";
import { Icon } from "@/components/admin/ui/Icon";
import { RecoverForm } from "./RecoverForm";

export const metadata: Metadata = { title: "Recuperar contraseña", robots: { index: false } };

export default function RecoverPage() {
  const wa = env.BILLING_WHATSAPP?.replace(/\D/g, "");
  return (
    <main id="contenido" className="flex w-full flex-1 flex-col items-center justify-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-[25rem]">
        <div className="flex flex-col items-center text-center">
          <span aria-hidden="true" className="grid size-16 place-items-center rounded-[18px] bg-navy text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.35)]">
            <Icon name="mail" className="size-8" strokeWidth={1.8} />
          </span>
          <h1 className="mt-5 font-display text-[2rem] leading-tight font-bold tracking-[-0.025em] text-ink">Recupera tu acceso</h1>
          <p className="mt-2 max-w-xs text-[0.9375rem] leading-relaxed text-ink-muted">
            {integrations.email
              ? "Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una nueva contraseña."
              : "La recuperación por correo aún no está activa. Escríbenos y te ayudamos a recuperar tu cuenta."}
          </p>
        </div>
        {integrations.email ? (
          <RecoverForm />
        ) : wa ? (
          <a
            href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola, necesito recuperar el acceso a mi cuenta de agente en ${env.PORTAL_NAME}.`)}`}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-sm bg-navy px-5 py-3 font-semibold text-white hover:bg-navy-hover"
          >
            <Icon name="chat" className="size-5" />
            Escribir por WhatsApp
          </a>
        ) : env.PORTAL_CONTACT_EMAIL ? (
          <a href={`mailto:${env.PORTAL_CONTACT_EMAIL}`} className="mt-8 block text-center font-semibold text-link underline-offset-4 hover:underline">
            {env.PORTAL_CONTACT_EMAIL}
          </a>
        ) : null}
        <p className="mt-6 text-center text-[0.9375rem] text-ink-muted">
          <Link href="/panel/ingresar" className="font-medium text-link underline-offset-4 hover:underline">
            Volver a ingresar
          </Link>
        </p>
      </div>
    </main>
  );
}
