import { AppError } from "@/lib/errors";
import { errorInfo, log } from "@/lib/logger";
import { getMember } from "@/server/session";
import { setProfilePhoto } from "@/modules/agents/admin";
import { jsonError, sameOrigin } from "@/app/panel/_server/act";

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "Origen no permitido.");
  const m = await getMember();
  if (!m) return jsonError(401, "Tu sesión expiró. Vuelve a ingresar.");
  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return jsonError(400, "No recibimos la foto. Inténtalo de nuevo.");
  }
  if (!(file instanceof File) || file.size === 0) return jsonError(400, "No recibimos la foto. Inténtalo de nuevo.");
  if (file.size > MAX_BYTES) return jsonError(413, "La foto supera 15 MB.");
  try {
    const photoUrl = await setProfilePhoto(m, Buffer.from(await file.arrayBuffer()));
    return Response.json({ ok: true, data: { photoUrl } }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof AppError) return jsonError(400, err.message);
    log.error("profile photo failed", errorInfo(err));
    return jsonError(500, "No pudimos guardar la foto. Inténtalo de nuevo.");
  }
}
