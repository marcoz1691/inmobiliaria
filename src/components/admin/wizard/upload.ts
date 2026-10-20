"use client";

export const MAX_EDGE = 2400;
export const JPEG_QUALITY = 0.85;

/**
 * Downscales a photo in the browser (longest edge ≤ 2400 px, JPEG 0.85) before upload, so a
 * 12 MP phone photo travels as ~1 MB on mobile data. Files the browser cannot decode (e.g. HEIC on
 * Chrome) are sent as-is and processed on the server.
 */
export async function compressImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) return file;
    // Already small JPEGs can grow when re-encoded; keep the original then.
    return scale === 1 && file.type === "image/jpeg" && blob.size >= file.size ? file : blob;
  } finally {
    bitmap.close();
  }
}

export type UploadResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** multipart POST with upload progress (fetch has no upload progress events). */
export function uploadWithProgress<T>(url: string, form: FormData, onProgress: (fraction: number) => void): Promise<UploadResult<T>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      const body = xhr.response as { ok?: boolean; data?: T; error?: string } | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.ok) resolve({ ok: true, data: body.data as T });
      else resolve({ ok: false, error: body?.error ?? "No se pudo subir. Inténtalo de nuevo." });
    };
    xhr.onerror = () => resolve({ ok: false, error: "Sin conexión. Toca «Reintentar» cuando vuelva la señal." });
    xhr.ontimeout = () => resolve({ ok: false, error: "La subida tardó demasiado. Toca «Reintentar»." });
    xhr.timeout = 120_000;
    xhr.send(form);
  });
}

/** Runs async tasks with a concurrency limit. */
export async function runLimited<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await worker(queue.shift()!);
  });
  await Promise.all(runners);
}
