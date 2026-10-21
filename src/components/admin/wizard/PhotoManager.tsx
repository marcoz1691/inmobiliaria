"use client";
import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/components/ui/cn";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { card } from "../ui/ListGroup";
import { press, tap } from "../ui/motion";
import { ConfirmDialog } from "../ConfirmDialog";
import { inputClass } from "../fields";
import { compressImage, runLimited, uploadWithProgress } from "./upload";
import { removePhotoAction, reorderPhotosAction, setCoverAction, updatePhotoAltAction } from "@/app/panel/(app)/propiedades/actions";

export type Photo = { id: string; src: string; alt: string | null; isCover: boolean };

type Upload = {
  key: string;
  name: string;
  preview: string;
  progress: number;
  status: "compressing" | "uploading" | "error";
  error?: string;
  blob?: Blob;
};

const MAX_FILES = 40;
const CONCURRENCY = 3;

/** Photos step: pick from camera/gallery, compress, upload in parallel with progress, sort, cover, alt. */
export function PhotoManager({ propertyId, initial, onChange }: { propertyId: string; initial: Photo[]; onChange: (photos: Photo[]) => void }) {
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [announce, setAnnounce] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => onChange(photos), [photos, onChange]);

  const patchUpload = (key: string, patch: Partial<Upload>) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  async function uploadOne(item: Upload, file?: File) {
    let blob = item.blob;
    if (!blob && file) {
      patchUpload(item.key, { status: "compressing", progress: 0 });
      blob = await compressImage(file);
      patchUpload(item.key, { blob });
    }
    if (!blob) return;
    patchUpload(item.key, { status: "uploading", progress: 0, error: undefined });
    const form = new FormData();
    form.append("file", blob, item.name.replace(/\.[^.]+$/, "") + (blob.type === "image/jpeg" ? ".jpg" : ""));
    const r = await uploadWithProgress<Photo>(`/api/panel/properties/${propertyId}/photos`, form, (p) => patchUpload(item.key, { progress: p }));
    if (r.ok) {
      setUploads((u) => u.filter((x) => x.key !== item.key));
      URL.revokeObjectURL(item.preview);
      setPhotos((p) => [...p, { ...r.data, isCover: p.length === 0 ? true : r.data.isCover }]);
    } else {
      patchUpload(item.key, { status: "error", error: r.error });
    }
  }

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const files = Array.from(list).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    const room = MAX_FILES - photos.length - uploads.length;
    if (files.length > room) setError(`Puedes tener hasta ${MAX_FILES} fotos por propiedad. Se subirán las primeras ${Math.max(room, 0)}.`);
    const items = files.slice(0, Math.max(room, 0)).map((f) => ({
      file: f,
      item: { key: crypto.randomUUID(), name: f.name, preview: URL.createObjectURL(f), progress: 0, status: "compressing" as const },
    }));
    setUploads((u) => [...u, ...items.map((i) => i.item)]);
    if (inputRef.current) inputRef.current.value = "";
    await runLimited(items, CONCURRENCY, ({ item, file }) => uploadOne(item, file));
    setAnnounce(`${items.length === 1 ? "Foto procesada" : `${items.length} fotos procesadas`}.`);
  }

  async function persistOrder(next: Photo[], message: string) {
    const prev = photos;
    const withCover = next.map((p, i) => ({ ...p, isCover: i === 0 }));
    setPhotos(withCover);
    const r = await reorderPhotosAction(propertyId, withCover.map((p) => p.id));
    const c = r.ok && prev[0]?.id !== withCover[0]?.id ? await setCoverAction(propertyId, withCover[0]!.id) : r;
    if (!r.ok || !c.ok) {
      setPhotos(prev);
      setError(!r.ok ? r.error : !c.ok ? c.error : null);
      return;
    }
    setAnnounce(message);
  }

  function move(index: number, to: number) {
    if (to < 0 || to >= photos.length) return;
    void persistOrder(arrayMove(photos, index, to), `Foto movida a la posición ${to + 1} de ${photos.length}.`);
  }

  function onDragEnd(e: DragEndEvent) {
    const from = photos.findIndex((p) => p.id === e.active.id);
    const to = photos.findIndex((p) => p.id === e.over?.id);
    if (from < 0 || to < 0 || from === to) return;
    void persistOrder(arrayMove(photos, from, to), `Foto movida a la posición ${to + 1} de ${photos.length}.`);
  }

  async function remove(photo: Photo): Promise<string | void> {
    const r = await removePhotoAction(propertyId, photo.id);
    if (!r.ok) return r.error;
    setPhotos((p) => {
      const rest = p.filter((x) => x.id !== photo.id);
      return rest.map((x, i) => ({ ...x, isCover: i === 0 }));
    });
    setAnnounce("Foto eliminada.");
  }

  return (
    <div>
      <div className={cn(card, "flex flex-col items-center px-5 py-7 text-center sm:py-9")}>
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-navy/10 text-navy">
          <Icon name="camera" className="size-7" />
        </span>
        <p className="mt-3 text-headline text-ink">Agrega fotos desde tu cámara o galería</p>
        <p className="mt-1 max-w-md text-[0.9375rem] text-ink-muted" id={`${id}-help`}>
          Puedes elegir varias a la vez. Las reducimos en tu teléfono antes de subirlas para ahorrar datos.
        </p>
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="file"
          accept="image/*"
          multiple
          className="peer sr-only"
          aria-describedby={`${id}-help`}
          onChange={(e) => void onFiles(e.currentTarget.files)}
        />
        <label
          htmlFor={`${id}-input`}
          className={cn("mt-5 inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-navy px-6 text-[1.0625rem] font-medium text-white hover:bg-navy-hover peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-navy", tap, press)}
        >
          <Icon name="photo" className="size-5" strokeWidth={1.9} />
          Elegir fotos
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm font-medium text-sold">
          <Icon name="alert" className="size-4 shrink-0" strokeWidth={2} />
          {error}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {uploads.length ? (
        <ul className={cn(card, "mt-4 overflow-hidden")} aria-label="Fotos en proceso">
          {uploads.map((u) => (
            <li key={u.key} className="relative flex items-center gap-3 px-3 py-2.5 not-first:before:absolute not-first:before:inset-x-3 not-first:before:top-0 not-first:before:h-px not-first:before:bg-line sm:px-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={u.preview} alt="" className="size-12 shrink-0 rounded-xs object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.9375rem] text-ink">{u.name}</p>
                {u.status === "error" ? (
                  <p className="text-sm text-sold">{u.error}</p>
                ) : (
                  <>
                    <progress
                      className="mt-1.5 h-1 w-full appearance-none overflow-hidden rounded-full bg-ink/10 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-navy [&::-webkit-progress-bar]:bg-ink/10 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-navy [&::-webkit-progress-value]:transition-[width] [&::-webkit-progress-value]:duration-300"
                      max={1}
                      value={u.status === "compressing" ? undefined : u.progress}
                      aria-label={`Progreso de ${u.name}`}
                    />
                    <p className="mt-0.5 text-xs text-ink-muted">{u.status === "compressing" ? "Preparando…" : `Subiendo ${Math.round(u.progress * 100)} %`}</p>
                  </>
                )}
              </div>
              {u.status === "error" ? (
                <div className="flex shrink-0 gap-1">
                  <Button variant="tinted" size="sm" onClick={() => void uploadOne(u)} disabled={!u.blob}>
                    Reintentar
                  </Button>
                  <button
                    type="button"
                    className={cn("grid size-11 place-items-center rounded-full text-ink-muted hover:bg-ink/5 hover:text-ink", tap)}
                    aria-label={`Descartar ${u.name}`}
                    onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}
                  >
                    <Icon name="x" className="size-5" />
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {photos.length ? (
        <>
          <div className="mt-7 flex items-baseline justify-between gap-3">
            <h2 className="text-headline text-ink">Tus fotos</h2>
            <p className="text-sm text-ink-muted tabular-nums">
              {photos.length} de {MAX_FILES}
            </p>
          </div>
          <p className="mt-1 text-sm text-ink-muted" id={`${id}-sort-help`}>
            La primera foto es la portada. Arrastra desde el asa, usa las flechas o «Usar como portada» para cambiar el orden.
          </p>
          <DndContext
            id={`${id}-dnd`}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            accessibility={{
              screenReaderInstructions: {
                draggable: "Para mover una foto, presiona espacio o Enter. Usa las flechas para cambiarla de lugar y espacio o Enter para soltarla. Escape cancela.",
              },
              announcements: {
                onDragStart: ({ active }) => `Tomaste la foto ${photos.findIndex((p) => p.id === active.id) + 1}.`,
                onDragOver: ({ over }) => (over ? `Sobre la posición ${photos.findIndex((p) => p.id === over.id) + 1}.` : "Fuera de la lista."),
                onDragEnd: ({ over }) => (over ? `Foto soltada en la posición ${photos.findIndex((p) => p.id === over.id) + 1}.` : "Movimiento cancelado."),
                onDragCancel: () => "Movimiento cancelado.",
              },
            }}
          >
            <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
              <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-describedby={`${id}-sort-help`} data-testid="photo-list">
                {photos.map((p, i) => (
                  <SortablePhoto
                    key={p.id}
                    photo={p}
                    index={i}
                    total={photos.length}
                    onMove={move}
                    onAlt={async (alt) => {
                      const r = await updatePhotoAltAction(propertyId, p.id, alt);
                      if (r.ok) setPhotos((all) => all.map((x) => (x.id === p.id ? { ...x, alt: alt.trim() || null } : x)));
                      return r.ok ? null : r.error;
                    }}
                    onRemove={() => remove(p)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        </>
      ) : uploads.length === 0 ? (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-sm text-ink-muted">
          <Icon name="info" className="size-4 shrink-0" />
          Aún no hay fotos. Necesitas al menos una para publicar; lo ideal son 8 a 15.
        </p>
      ) : null}
    </div>
  );
}

function SortablePhoto({
  photo,
  index,
  total,
  onMove,
  onAlt,
  onRemove,
}: {
  photo: Photo;
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onAlt: (alt: string) => Promise<string | null>;
  onRemove: () => Promise<string | void>;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  const [alt, setAlt] = useState(photo.alt ?? "");
  const [altError, setAltError] = useState<string | null>(null);
  const altId = `alt-${photo.id}`;
  const n = index + 1;
  const iconBtn = cn("grid size-11 shrink-0 place-items-center rounded-full text-ink hover:bg-ink/[0.06] disabled:text-ink/25 disabled:hover:bg-transparent", tap);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(card, "flex gap-3 p-2 transition-shadow duration-200 sm:flex-col sm:p-2.5", isDragging && "relative z-10 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.3)] ring-2 ring-navy")}
      data-photo-id={photo.id}
    >
      <div className="relative aspect-[4/3] w-28 shrink-0 self-start overflow-hidden rounded-xs bg-mist sm:w-full">
        <Image src={photo.src} alt={photo.alt ?? ""} fill sizes="(min-width: 640px) 33vw, 112px" className="object-cover" />
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Mover foto ${n} de ${total}`}
          className="absolute top-1 right-1 grid size-11 cursor-grab touch-none place-items-center rounded-full bg-white/80 text-ink shadow-sm backdrop-blur-md active:cursor-grabbing"
        >
          <Icon name="grip" className="size-5" />
        </button>
        {photo.isCover ? (
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-ink/75 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-md">
            <Icon name="star" className="size-3" strokeWidth={2.4} />
            Portada
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <label htmlFor={altId} className="block text-[0.8125rem] font-medium text-ink">
          Descripción de la foto {n} <span className="font-normal text-ink-muted">(opcional)</span>
        </label>
        <input
          id={altId}
          value={alt}
          maxLength={200}
          placeholder="Ej.: Sala con ventanal al jardín"
          onChange={(e) => setAlt(e.target.value)}
          onBlur={async () => {
            if ((photo.alt ?? "") === alt.trim()) return;
            setAltError(await onAlt(alt));
          }}
          aria-invalid={altError ? true : undefined}
          aria-describedby={altError ? `${altId}-e` : undefined}
          className={inputClass}
        />
        {altError ? (
          <p id={`${altId}-e`} className="mt-1 text-xs text-sold">
            {altError}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center">
          <button type="button" className={iconBtn} onClick={() => onMove(index, index - 1)} disabled={index === 0} aria-label={`Mover foto ${n} antes`}>
            <Icon name="chevronLeft" className="size-5" strokeWidth={2} />
          </button>
          <button type="button" className={iconBtn} onClick={() => onMove(index, index + 1)} disabled={index === total - 1} aria-label={`Mover foto ${n} después`}>
            <Icon name="chevronRight" className="size-5" strokeWidth={2} />
          </button>
          {!photo.isCover ? (
            <button type="button" className={cn("min-h-11 rounded-full px-3 text-sm font-medium text-navy hover:bg-navy/[0.07]", tap)} onClick={() => onMove(index, 0)}>
              Usar como portada<span className="sr-only"> (foto {n})</span>
            </button>
          ) : null}
          <ConfirmDialog
            destructive
            title="¿Eliminar esta foto?"
            description="La foto se quitará de la propiedad. No se puede deshacer."
            confirmLabel="Eliminar foto"
            onConfirm={onRemove}
            trigger={(open) => (
              <button type="button" className={cn(iconBtn, "ml-auto text-sold hover:bg-sold/[0.08]")} onClick={open} aria-label={`Eliminar foto ${n}`}>
                <Icon name="trash" className="size-5" />
              </button>
            )}
          />
        </div>
      </div>
    </li>
  );
}
