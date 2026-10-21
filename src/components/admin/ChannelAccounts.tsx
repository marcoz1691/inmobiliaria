"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerChannelAccountAction, removeChannelAccountAction } from "@/app/panel/(app)/integraciones/actions";
import { ConfirmDialog } from "./ConfirmDialog";
import { Field, inputClass, selectClass } from "./fields";
import { Button } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { IconTile, ListGroup, ListItem } from "@/components/admin/ui/ListGroup";
import { useToast } from "@/components/admin/ui/Toast";

export type ChannelProvider = "whatsapp" | "page" | "instagram";
export type ChannelAccountRow = {
  id: string;
  provider: ChannelProvider;
  externalId: string;
  label: string | null;
  createdAt: string;
};

const CHANNEL_PROVIDER_LABEL: Record<ChannelProvider, string> = {
  whatsapp: "WhatsApp (Phone number ID)",
  page: "Página de Facebook (Page ID)",
  instagram: "Instagram (ID de la cuenta profesional)",
};

const date = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "America/Guayaquil" });
const PROVIDER_OPTIONS: { value: ChannelProvider; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "page", label: "Página de Facebook" },
  { value: "instagram", label: "Instagram" },
];
const TILE: Record<ChannelProvider, "green" | "blue" | "clay"> = { whatsapp: "green", page: "blue", instagram: "clay" };

export function ChannelAccounts({ accounts }: { accounts: ChannelAccountRow[] }) {
  const id = useId();
  const router = useRouter();
  const toast = useToast();
  const [provider, setProvider] = useState<ChannelProvider>("whatsapp");
  const [externalId, setExternalId] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-6">
      {accounts.length ? (
        <ListGroup title="Cuentas registradas" titleId="channel-list">
          {accounts.map((a) => (
            <ListItem key={a.id} inset="icon">
              <div className="flex items-start gap-3 px-4 py-3">
                <IconTile name={a.provider === "whatsapp" ? "chat" : a.provider === "page" ? "people" : "camera"} tone={TILE[a.provider]} />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium text-ink">{a.label || CHANNEL_PROVIDER_LABEL[a.provider]}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {CHANNEL_PROVIDER_LABEL[a.provider]}
                    <span className="mt-0.5 block font-mono text-[0.8125rem] tabular-nums">{a.externalId}</span>
                    <span className="mt-0.5 block">{date.format(new Date(a.createdAt))}</span>
                  </p>
                </div>
                <ConfirmDialog
                  destructive
                  title="¿Quitar esta cuenta?"
                  description={
                    <>
                      Dejarás de recibir webhooks para {a.label ? `«${a.label}»` : CHANNEL_PROVIDER_LABEL[a.provider]} ({a.externalId}). Esto no conecta ni desconecta Meta: solo quita el ID de tu lista.
                    </>
                  }
                  confirmLabel="Quitar cuenta"
                  onConfirm={async () => {
                    const r = await removeChannelAccountAction(a.id);
                    if (!r.ok) return r.error;
                    toast.success("Cuenta quitada.");
                    router.refresh();
                  }}
                  trigger={(open) => (
                    <Button variant="plain" size="sm" className="shrink-0 text-sold hover:bg-sold/10" icon="trash" onClick={open}>
                      Quitar
                      <span className="sr-only">
                        {" "}
                        {a.label || CHANNEL_PROVIDER_LABEL[a.provider]} {a.externalId}
                      </span>
                    </Button>
                  )}
                />
              </div>
            </ListItem>
          ))}
        </ListGroup>
      ) : (
        <EmptyState
          icon="plug"
          title="Ninguna cuenta registrada"
          description="Añade el ID numérico que muestra Meta. Registrar un ID no significa que Meta esté conectado."
        />
      )}

      <ListGroup
        as="div"
        title="Añadir cuenta"
        titleId="channel-add"
        footer="El ID debe ser solo dígitos. Si otro espacio ya lo registró, el sistema lo rechaza sin decir de quién es."
      >
        <form
          className="grid gap-4 p-4 sm:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await registerChannelAccountAction({ provider, externalId, label });
              if (r.ok) {
                setExternalId("");
                setLabel("");
                setError(null);
                toast.success("Cuenta registrada.");
                router.refresh();
              } else setError(r.error);
            });
          }}
        >
          <Field id={`${id}-p`} label="Tipo">
            <select id={`${id}-p`} value={provider} className={selectClass} onChange={(e) => setProvider(e.target.value as ChannelProvider)}>
              {PROVIDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-x`} label="ID numérico" hint={CHANNEL_PROVIDER_LABEL[provider]}>
            <input
              id={`${id}-x`}
              inputMode="numeric"
              autoComplete="off"
              autoCapitalize="none"
              value={externalId}
              onChange={(e) => setExternalId(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
              placeholder="123456789012345"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-err` : undefined}
            />
          </Field>
          <Field id={`${id}-l`} label="Etiqueta" optional hint="Para reconocerlo tú. No se publica.">
            <input id={`${id}-l`} value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} className={inputClass} placeholder="Ej.: WhatsApp oficina" />
          </Field>
          {error ? (
            <p id={`${id}-err`} role="alert" className="text-sm font-medium text-sold">
              {error}
            </p>
          ) : null}
          <Button type="submit" pending={pending} disabled={externalId.length < 5} className="w-full sm:w-auto">
            {pending ? "Guardando…" : "Registrar cuenta"}
          </Button>
        </form>
      </ListGroup>
    </div>
  );
}
