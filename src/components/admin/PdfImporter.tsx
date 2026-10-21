"use client";
import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { Spinner } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { card } from "./ui/ListGroup";
import { press, tap } from "./ui/motion";
import { uploadWithProgress } from "./wizard/upload";

const MAX_BYTES = 20 * 1024 * 1024;

type ImportResult =
  | { kind: "already_imported"; importId: string; fileName: string }
  | { kind: "needs_ocr"; importId: string; message: string }
  | { kind: "parsed"; importId: string; created: number; skipped: number; warnings: string[] };

type Item = { key: string; name: string; progress: number; state: "waiting" | "uploading" | "processing" | "done" | "error"; result?: ImportResult; error?: string };

function summary(r: ImportResult): { text: string; tone: "ok" | "warn" } {
  if (r.kind === "already_imported") return { text: `Este PDF ya se importó antes («${r.fileName}»).`, tone: "warn" };
  if (r.kind === "needs_ocr") return { text: r.message, tone: "warn" };
  if (r.created === 0) return { text: r.skipped ? "No se creó ningún borrador: ya existen propiedades muy parecidas." : "No encontramos fichas con precio y dirección. Puedes crear la propiedad a mano y adjuntar fotos.", tone: "warn" };
  const drafts = r.created === 1 ? "Se creó 1 borrador" : `Se crearon ${r.created} borradores`;
  return { text: `${drafts} para revisar${r.skipped ? ` y se omitieron ${r.skipped} posibles duplicados` : ""}.`, tone: "ok" };
}

/** Uploads PDFs one by one (each can take a few seconds to parse) and reports what was created. */
export function PdfImporter() {
  const id = useId();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const patch = (key: string, p: Partial<Item>) => setItems((all) => all.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list);
    const queued: (Item & { file: File })[] = files.map((f) => ({ key: crypto.randomUUID(), name: f.name, progress: 0, state: "waiting", file: f }));
    setItems((all) => [...queued.map(({ file: _f, ...i }) => i), ...all]);
    if (input.current) input.current.value = "";
    for (const q of queued) {
      if (q.file.type !== "application/pdf" && !/\.pdf$/i.test(q.file.name)) {
        patch(q.key, { state: "error", error: "Solo se aceptan PDF. Exporta la presentación como PDF e inténtalo de nuevo." });
        continue;
      }
      if (q.file.size > MAX_BYTES) {
        patch(q.key, { state: "error", error: "El PDF supera 20 MB." });
        continue;
      }
      patch(q.key, { state: "uploading" });
      const form = new FormData();
      form.append("file", q.file);
      const r = await uploadWithProgress<ImportResult>("/api/panel/imports", form, (p) => patch(q.key, { progress: p, state: p >= 1 ? "processing" : "uploading" }));
      patch(q.key, r.ok ? { state: "done", result: r.data } : { state: "error", error: r.error });
    }
    router.refresh();
  }

  return (
    <div>
      <div className={cn(card, "flex flex-col items-center px-5 py-7 text-center sm:py-9")}>
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-navy/10 text-navy">
          <Icon name="docImport" className="size-7" />
        </span>
        <p className="mt-3 text-headline text-ink">Sube fichas o catálogos en PDF</p>
        <p id={`${id}-help`} className="mt-1 max-w-md text-[0.9375rem] text-ink-muted">
          Hasta 20 MB por archivo. Leemos los datos y las fotos y creamos borradores para que los revises. Nada se publica solo.
        </p>
        <input
          ref={input}
          id={`${id}-file`}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="peer sr-only"
          aria-describedby={`${id}-help`}
          onChange={(e) => void onFiles(e.currentTarget.files)}
        />
        <label
          htmlFor={`${id}-file`}
          className={cn(
            "mt-5 inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-navy px-6 text-[1.0625rem] font-medium text-white hover:bg-navy-hover peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-navy",
            tap,
            press,
          )}
        >
          <Icon name="upload" className="size-5" strokeWidth={1.9} />
          Elegir PDFs
        </label>
      </div>
      {items.length ? (
        <ul className={cn(card, "mt-4 overflow-hidden")} aria-live="polite" aria-label="Archivos subidos en esta sesión">
          {items.map((i) => {
            const s = i.result ? summary(i.result) : null;
            const busy = i.state === "waiting" || i.state === "uploading" || i.state === "processing";
            return (
              <li key={i.key} className="relative flex gap-3 px-4 py-3 not-first:before:absolute not-first:before:inset-x-4 not-first:before:top-0 not-first:before:h-px not-first:before:bg-line">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
                    busy ? "bg-navy/10 text-navy" : i.state === "error" ? "bg-sold-bg text-sold" : s?.tone === "ok" ? "bg-available-bg text-available" : "bg-reserved-bg text-reserved",
                  )}
                >
                  {busy ? <Spinner /> : <Icon name={i.state === "error" ? "x" : s?.tone === "ok" ? "check" : "alert"} className="size-4" strokeWidth={2.4} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-ink">{i.name}</p>
                  {i.state === "waiting" ? <p className="text-sm text-ink-muted">En espera…</p> : null}
                  {i.state === "uploading" ? (
                    <>
                      <progress
                        max={1}
                        value={i.progress}
                        aria-label={`Subiendo ${i.name}`}
                        className="mt-1.5 h-1 w-full appearance-none overflow-hidden rounded-full bg-ink/10 [&::-moz-progress-bar]:bg-navy [&::-webkit-progress-bar]:bg-ink/10 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-navy"
                      />
                      <p className="mt-0.5 text-sm text-ink-muted tabular-nums">Subiendo {Math.round(i.progress * 100)} %</p>
                    </>
                  ) : null}
                  {i.state === "processing" ? <p className="text-sm text-ink-muted">Leyendo el PDF y extrayendo fotos…</p> : null}
                  {i.state === "error" ? <p className="text-sm font-medium text-sold">{i.error}</p> : null}
                  {s && i.result ? (
                    <>
                      <p className={cn("text-sm", s.tone === "ok" ? "text-available" : "text-reserved")}>{s.text}</p>
                      <Link
                        href={`/panel/importar/${i.result.importId}`}
                        className={cn("-ml-3 inline-flex min-h-11 items-center gap-0.5 rounded-full px-3 text-[0.9375rem] font-medium text-navy hover:bg-navy/[0.07]", tap)}
                      >
                        Ver revisión
                        <Icon name="chevronRight" className="size-4" strokeWidth={2.2} />
                      </Link>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
