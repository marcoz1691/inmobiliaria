"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { Button } from "@/components/admin/ui/Button";
import { Icon } from "@/components/admin/ui/Icon";
import { inputClass, labelClass } from "@/components/admin/fields";
import { LocationSelects } from "@/components/public/LocationSelects";
import { register, type RegisterState } from "./actions";

const hintClass = "mt-1 text-sm text-ink-muted";
const errorClass = "mt-1 text-sm font-medium text-sold";

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: (describedBy: string | undefined) => React.ReactNode;
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children(describedBy)}
      {hint ? (
        <p id={`${id}-hint`} className={hintClass}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className={errorClass}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RegisterForm({ formToken, honeypotName }: { formToken: string; honeypotName: string }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(register, { status: "idle" });
  useEffect(() => {
    if (state.status === "success" && state.next) window.location.assign(state.next);
  }, [state]);
  const v = state.values;
  const err = (k: string) => state.fieldErrors?.[k]?.[0];

  return (
    <form
      action={action}
      noValidate
      className="mt-8 rounded-md bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_20px_50px_-24px_rgba(0,0,0,0.18)] ring-1 ring-ink/[0.04] sm:p-6"
    >
      <input type="hidden" name="form_token" value={formToken} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={honeypotName}>No llenes este campo</label>
        <input id={honeypotName} name={honeypotName} type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="space-y-4">
        <Field id="name" label="Nombre y apellido" hint="Así te verán quienes buscan propiedades." error={err("name")}>
          {(d) => <input id="name" name="name" autoComplete="name" required defaultValue={v?.name} className={inputClass} aria-invalid={err("name") ? true : undefined} aria-describedby={d} />}
        </Field>
        <Field id="email" label="Correo" error={err("email")}>
          {(d) => (
            <input id="email" name="email" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" required defaultValue={v?.email} className={inputClass} aria-invalid={err("email") ? true : undefined} aria-describedby={d} />
          )}
        </Field>
        <Field id="password" label="Contraseña" hint="Al menos 10 caracteres." error={err("password")}>
          {(d) => <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className={inputClass} aria-invalid={err("password") ? true : undefined} aria-describedby={d} />}
        </Field>
        <Field id="whatsapp" label="WhatsApp (opcional)" hint="Aparece en tus fichas para que te escriban directo. Ej.: +593 99 123 4567" error={err("whatsapp")}>
          {(d) => <input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" defaultValue={v?.whatsapp} className={inputClass} aria-invalid={err("whatsapp") ? true : undefined} aria-describedby={d} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <LocationSelects
            idPrefix="registro"
            defaultProvince={v?.province}
            defaultCity={v?.city}
            selectClassName={`${inputClass} select-chevron`}
            labelClassName={labelClass}
            cityLabel="Ciudad donde trabajas"
            anyProvince="Elige provincia"
            anyCity="Elige ciudad (opcional)"
          />
        </div>
        {err("city") ? <p className={errorClass}>{err("city")}</p> : null}
      </div>
      {state.status === "error" && state.message ? (
        <p role="alert" className="mt-4 flex items-start gap-1.5 text-sm font-medium text-sold">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {state.message}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="mt-6 w-full" pending={pending}>
        {pending ? "Creando tu cuenta…" : state.status === "success" ? "Entrando a tu panel…" : "Crear cuenta"}
      </Button>
      <p className="mt-4 text-center text-sm text-ink-muted">
        Al crear tu cuenta aceptas los{" "}
        <Link href="/terminos" className="text-link underline underline-offset-4">
          términos y condiciones
        </Link>{" "}
        y la{" "}
        <Link href="/privacidad" className="text-link underline underline-offset-4">
          política de privacidad
        </Link>
        .
      </p>
    </form>
  );
}
