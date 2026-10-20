import { AppError } from "@/lib/errors";
import { errorInfo, log } from "@/lib/logger";
import { getMember } from "@/server/session";
import { addPhoto, mediaSrc } from "@/modules/properties/service";
import { isUuid, jsonError, sameOrigin } from "@/app/panel/_server/act";

/** Client compresses to ~2400 px JPEG; this is a generous ceiling for originals the browser could not decode (HEIC). */
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return jsonError(403, "Origen no permitido.");
  const m = await getMember();
  if (!m) return jsonError(401, "Tu sesión expiró. Vuelve a ingresar.");
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "Propiedad no encontrada.");
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES + 64 * 1024) return jsonError(413, "La foto supera 15 MB.");

  let file: FormDataEntryValue | null;
  let alt: FormDataEntryValue | null;
  try {
    const form = await req.formData();
    file = form.get("file");
    alt = form.get("alt");
  } catch {
    return jsonError(400, "No recibimos la foto. Inténtalo de nuevo.");
  }
  if (!(file instanceof File) || file.size === 0) return jsonError(400, "No recibimos la foto. Inténtalo de nuevo.");
  if (file.size > MAX_BYTES) return jsonError(413, "La foto supera 15 MB.");

  try {
    const row = await addPhoto(m, id, Buffer.from(await file.arrayBuffer()), typeof alt === "string" ? alt : undefined);
    return Response.json(
      { ok: true, data: { id: row.id, src: mediaSrc(row), alt: row.alt, isCover: row.isCover, position: row.position, width: row.width, height: row.height } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof AppError) return jsonError(err.code === "not_found" ? 404 : err.code === "forbidden" ? 403 : 400, err.message);
    // processImage rejects unreadable or unsupported files with a plain Error.
    log.warn("photo upload rejected", { propertyId: id, ...errorInfo(err) });
    return jsonError(415, "No pudimos leer esa imagen. Usa JPG, PNG, WebP o HEIC.");
  }
}
