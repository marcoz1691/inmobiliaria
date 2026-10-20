import { AppError } from "@/lib/errors";
import { errorInfo, log } from "@/lib/logger";
import { getMember } from "@/server/session";
import { importPdf, MAX_PDF_BYTES } from "@/modules/imports/service";
import { jsonError, sameOrigin } from "@/app/panel/_server/act";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "Origen no permitido.");
  const m = await getMember();
  if (!m) return jsonError(401, "Tu sesión expiró. Vuelve a ingresar.");
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_PDF_BYTES + 64 * 1024) return jsonError(413, "El PDF supera 20 MB.");

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return jsonError(400, "No recibimos el archivo. Inténtalo de nuevo.");
  }
  if (!(file instanceof File) || file.size === 0) return jsonError(400, "No recibimos el archivo. Inténtalo de nuevo.");
  if (file.size > MAX_PDF_BYTES) return jsonError(413, "El PDF supera 20 MB.");

  try {
    const result = await importPdf(m, file.name, Buffer.from(await file.arrayBuffer()));
    return Response.json({ ok: true, data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof AppError) return jsonError(400, err.message);
    log.error("import route failed", errorInfo(err));
    return jsonError(500, "No pudimos procesar el PDF. Inténtalo de nuevo.");
  }
}
