"use client";
import { useId, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/admin/ui/Button";
import { useToast } from "@/components/admin/ui/Toast";
import { saveProfileAction, saveSiteAction } from "@/app/panel/(app)/perfil/actions";
import { Field, describedBy, inputClass } from "./fields";
import { compressImage, uploadWithProgress } from "./wizard/upload";
import { cn } from "@/components/ui/cn";

export type ProfileValues = {
  displayName: string;
  headline: string;
  bio: string;
  whatsapp: string;
  phone: string;
  email: string;
  city: string;
  affiliation: string;
  socials: Record<string, string>;
};

const SOCIAL_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  x: "X",
  website: "Sitio web propio",
};

type Errors = Record<string, string[] | undefined>;

export function ProfileForm({ initial, socialKeys }: { initial: ProfileValues; socialKeys: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof ProfileValues, value: string) => setV((x) => ({ ...x, [k]: value }));

  const text = (k: Exclude<keyof ProfileValues, "socials">, label: string, opts: { optional?: boolean; hint?: string; type?: string; inputMode?: "tel" | "email"; autoComplete?: string; multiline?: boolean } = {}) => {
    const id = `p-${k}`;
    const m = { error: errors[k]?.[0], hint: opts.hint };
    const common = {
      id,
      value: v[k],
      "aria-invalid": m.error ? true : undefined,
      "aria-describedby": describedBy(id, m),
    } as const;
    return (
      <Field id={id} label={label} optional={opts.optional} {...m}>
        {opts.multiline ? (
          <textarea {...common} rows={6} className={cn(inputClass, "py-2 leading-relaxed")} onChange={(e) => set(k, e.target.value)} maxLength={2000} />
        ) : (
          <input {...common} type={opts.type ?? "text"} inputMode={opts.inputMode} autoComplete={opts.autoComplete} className={inputClass} onChange={(e) => set(k, e.target.value)} />
        )}
      </Field>
    );
  };

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const socials = Object.fromEntries(socialKeys.map((k) => [k, v.socials[k] ?? ""]));
          const r = await saveProfileAction({ ...v, socials });
          if (r.ok) {
            setErrors({});
            setMsg({ text: "Perfil guardado. Tu sitio ya muestra los cambios." });
            toast.success("Perfil guardado.");
            router.refresh();
          } else {
            const fe: Errors = { ...(r.fieldErrors ?? {}) };
            setErrors(fe);
            setMsg({ text: r.error, error: true });
            const first = Object.keys(fe)[0];
            if (first) document.getElementById(first === "socials" ? `p-s-${socialKeys[0]}` : `p-${first}`)?.focus();
          }
        });
      }}
    >
      {text("displayName", "Nombre visible", { autoComplete: "name" })}
      {text("headline", "Titular", { optional: true, hint: "Una línea sobre cómo ayudas. Ej.: «Asesoría en compra de vivienda en el valle de Tumbaco»." })}
      {text("bio", "Biografía", { optional: true, multiline: true, hint: "Escribe solo experiencia y datos que puedas respaldar." })}
      <div className="grid gap-5 sm:grid-cols-2">
        {text("whatsapp", "WhatsApp", { optional: true, type: "tel", inputMode: "tel", autoComplete: "tel", hint: "Con código de país: +593 99 123 4567" })}
        {text("phone", "Teléfono", { optional: true, type: "tel", inputMode: "tel", autoComplete: "tel" })}
        {text("email", "Correo de contacto", { optional: true, type: "email", inputMode: "email", autoComplete: "email" })}
        {text("city", "Ciudad", { optional: true, autoComplete: "address-level2" })}
      </div>
      {text("affiliation", "Afiliación o marca", { optional: true, hint: "Solo si estás autorizado a usar esa marca. Si lo dejas vacío, no se muestra ninguna." })}
      <fieldset>
        <legend className="text-[1.125rem] font-semibold tracking-[-0.015em] text-ink">Redes</legend>
        <p className="mt-1 text-sm text-ink-muted">Enlaces completos que empiecen con https://. Las vacías no se muestran.</p>
        {errors.socials ? <p className="mt-1 text-sm font-medium text-sold">{errors.socials[0] ?? "Revisa los enlaces"}</p> : null}
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {socialKeys.map((k) => (
            <div key={k}>
              <label htmlFor={`p-s-${k}`} className="block text-sm font-medium text-ink">
                {SOCIAL_LABEL[k] ?? k}
              </label>
              <input
                id={`p-s-${k}`}
                type="url"
                inputMode="url"
                autoCapitalize="none"
                value={v.socials[k] ?? ""}
                onChange={(e) => setV((x) => ({ ...x, socials: { ...x.socials, [k]: e.target.value } }))}
                className={inputClass}
                placeholder="https://"
              />
            </div>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:flex-wrap sm:items-center">
        <Button type="submit" pending={pending} className="w-full sm:w-auto">
          {pending ? "Guardando…" : "Guardar perfil"}
        </Button>
        <p role="status" className={msg?.error ? "text-sm font-medium text-sold" : "text-sm text-available"}>
          {msg?.text}
        </p>
      </div>
    </form>
  );
}

export function ProfilePhoto({ src, name }: { src: string | null; name: string }) {
  const id = useId();
  const router = useRouter();
  const toast = useToast();
  const [preview, setPreview] = useState<string | null>(src);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setProgress(0);
    const blob = await compressImage(file);
    const form = new FormData();
    form.append("file", blob, "foto.jpg");
    const r = await uploadWithProgress<{ photoUrl: string }>("/api/panel/profile/photo", form, setProgress);
    setProgress(null);
    if (r.ok) {
      setPreview(r.data.photoUrl);
      toast.success("Foto actualizada.");
      router.refresh();
    } else setError(r.error);
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-24 shrink-0 overflow-hidden rounded-sm bg-sand">
        {preview ? <Image src={preview} alt={`Foto de ${name}`} fill sizes="96px" className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs text-ink-muted">Sin foto</span>}
      </div>
      <div>
        <input id={id} type="file" accept="image/*" className="peer sr-only" onChange={(e) => void onFile(e.currentTarget.files?.[0])} aria-describedby={`${id}-h`} />
        <label
          htmlFor={id}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-ink/[0.06] px-5 text-[0.9375rem] font-medium text-ink hover:bg-ink/10 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-navy"
        >
          {preview ? "Cambiar foto" : "Subir foto"}
        </label>
        <p id={`${id}-h`} className="mt-1 text-sm text-ink-muted">
          Una foto real tuya. Solo la recortamos y optimizamos.
        </p>
        {progress !== null ? (
          <p role="status" className="text-sm text-ink-muted">
            Subiendo {Math.round(progress * 100)} %
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm font-medium text-sold">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function SiteForm({ initial, canEdit }: { initial: { name: string; tagline: string }; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const f = (k: "name" | "tagline", label: string, hint?: string) => {
    const id = `site-${k}`;
    const m = { error: errors[k]?.[0], hint };
    return (
      <Field id={id} label={label} optional={k === "tagline"} {...m}>
        <input
          id={id}
          value={v[k]}
          disabled={!canEdit}
          maxLength={k === "name" ? 120 : 160}
          onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value }))}
          className={inputClass}
          aria-invalid={m.error ? true : undefined}
          aria-describedby={describedBy(id, m)}
        />
      </Field>
    );
  };
  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveSiteAction(v);
          if (r.ok) {
            setErrors({});
            setMsg({ text: "Sitio actualizado." });
            toast.success("Sitio actualizado.");
            router.refresh();
          } else {
            setErrors(r.fieldErrors ?? {});
            setMsg({ text: r.error, error: true });
          }
        });
      }}
    >
      {f("name", "Nombre del sitio", "Aparece en la cabecera y en el título de las páginas.")}
      {f("tagline", "Frase corta", "Ej.: «Casas y departamentos en Quito y los valles»." )}
      {canEdit ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button type="submit" variant="tinted" pending={pending} className="w-full sm:w-auto">
            {pending ? "Guardando…" : "Guardar sitio"}
          </Button>
          <p role="status" className={msg?.error ? "text-sm font-medium text-sold" : "text-sm text-available"}>
            {msg?.text}
          </p>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Solo el dueño o un administrador puede cambiar estos datos.</p>
      )}
    </form>
  );
}
