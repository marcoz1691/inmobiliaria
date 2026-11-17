import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/admin/ui/Icon";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const valid = Boolean(token) && !error;
  return (
    <main id="contenido" className="flex w-full flex-1 flex-col items-center justify-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-[25rem]">
        <div className="flex flex-col items-center text-center">
          <span aria-hidden="true" className="grid size-16 place-items-center rounded-[18px] bg-navy text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.35)]">
            <Icon name="mail" className="size-8" strokeWidth={1.8} />
          </span>
          <h1 className="mt-5 font-display text-[2rem] leading-tight font-bold tracking-[-0.025em] text-ink">
            {valid ? "Elige tu nueva contraseña" : "El enlace ya no sirve"}
          </h1>
          {valid ? null : (
            <p className="mt-2 max-w-xs text-[0.9375rem] leading-relaxed text-ink-muted">Venció o ya se usó. Pide uno nuevo; dura 1 hora.</p>
          )}
        </div>
        {valid ? (
          <ResetForm token={token!} />
        ) : (
          <p className="mt-8 text-center">
            <Link href="/panel/recuperar" className="font-semibold text-link underline-offset-4 hover:underline">
              Pedir un enlace nuevo
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
