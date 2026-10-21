"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/admin/ui/Button";
import { useToast } from "@/components/admin/ui/Toast";
import { createFunnelAction, setFunnelStatusAction } from "@/app/panel/(app)/embudos/actions";
import { inputClass, selectClass } from "./fields";

export function CreateFunnel({ templates }: { templates: { key: string; name: string; description: string }[] }) {
  const id = useId();
  const router = useRouter();
  const toast = useToast();
  const [template, setTemplate] = useState(templates[0]?.key ?? "");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createFunnelAction({ template, slug });
          if (r.ok) {
            setSlug("");
            setError(null);
            toast.success("Embudo creado.");
            router.refresh();
          } else setError(r.error);
        });
      }}
    >
      <div>
        <label htmlFor={`${id}-t`} className="block text-sm font-medium text-ink">
          Plantilla
        </label>
        <select id={`${id}-t`} value={template} onChange={(e) => setTemplate(e.target.value)} className={selectClass} aria-describedby={`${id}-td`}>
          {templates.map((t) => (
            <option key={t.key} value={t.key}>
              {t.name}
            </option>
          ))}
        </select>
        <p id={`${id}-td`} className="mt-1.5 text-sm text-ink-muted">
          {templates.find((t) => t.key === template)?.description}
        </p>
      </div>
      <div>
        <label htmlFor={`${id}-s`} className="block text-sm font-medium text-ink">
          Dirección del embudo
        </label>
        <input
          id={`${id}-s`}
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          className={inputClass}
          placeholder="comprador"
          autoCapitalize="none"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-sh${error ? ` ${id}-e` : ""}`}
        />
        <p id={`${id}-sh`} className="mt-1.5 text-sm text-ink-muted">
          Quedará en /agenda/{slug || "…"}
        </p>
        {error ? (
          <p id={`${id}-e`} className="mt-1.5 text-sm font-medium text-sold">
            {error}
          </p>
        ) : null}
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" pending={pending} disabled={slug.length < 3} className="w-full sm:w-auto">
          {pending ? "Creando…" : "Crear embudo"}
        </Button>
      </div>
    </form>
  );
}

export function FunnelStatusToggle({ id, status, name }: { id: string; status: "draft" | "active" | "paused"; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const next = status === "active" ? "paused" : "active";
  return (
    <div>
      <Button
        variant={status === "active" ? "gray" : "filled"}
        pending={pending}
        onClick={() =>
          start(async () => {
            const r = await setFunnelStatusAction(id, next);
            setError(r.ok ? null : r.error);
            if (r.ok) {
              toast.success(next === "active" ? `«${name}» está activo.` : `«${name}» está pausado.`);
              router.refresh();
            }
          })
        }
      >
        {status === "active" ? "Pausar" : "Activar"}
        <span className="sr-only"> {name}</span>
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-sold">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Ad link with UTM parameters. Values are normalised so reports group them consistently. */
export function UtmBuilder({ baseUrl }: { baseUrl: string }) {
  const id = useId();
  const toast = useToast();
  const [source, setSource] = useState("facebook");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const clean = (v: string) => v.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");
  const url = new URL(baseUrl);
  url.searchParams.set("utm_source", clean(source) || "facebook");
  url.searchParams.set("utm_medium", "paid_social");
  if (clean(campaign)) url.searchParams.set("utm_campaign", clean(campaign));
  if (clean(content)) url.searchParams.set("utm_content", clean(content));
  const link = url.toString();

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied("Enlace copiado.");
      toast.success("Enlace copiado.");
    } catch {
      setCopied("No se pudo copiar automáticamente: selecciona el enlace y cópialo.");
    }
  }

  const field = (key: string, label: string, value: string, set: (v: string) => void, placeholder: string) => (
    <div>
      <label htmlFor={`${id}-${key}`} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input id={`${id}-${key}`} value={value} onChange={(e) => set(e.target.value)} className={inputClass} placeholder={placeholder} autoCapitalize="none" />
    </div>
  );

  return (
    <div className="mt-3 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {field("src", "Fuente (utm_source)", source, setSource, "facebook")}
        {field("cmp", "Campaña (utm_campaign)", campaign, setCampaign, "casas-cumbaya-octubre")}
        {field("cnt", "Anuncio (utm_content)", content, setContent, "video-1")}
      </div>
      <label htmlFor={`${id}-out`} className="block text-sm font-medium text-ink">
        Enlace para tu anuncio
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id={`${id}-out`} readOnly value={link} className={`${inputClass} mt-0 font-mono text-sm`} onFocus={(e) => e.currentTarget.select()} />
        <Button variant="gray" icon="copy" onClick={() => void copy()} className="w-full sm:w-auto">
          Copiar enlace
        </Button>
      </div>
      <p role="status" className="text-sm text-ink-muted empty:hidden">
        {copied}
      </p>
    </div>
  );
}
