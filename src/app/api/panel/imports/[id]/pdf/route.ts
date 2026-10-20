import { AppError } from "@/lib/errors";
import { getMember } from "@/server/session";
import { readImportPdf } from "@/modules/imports/service";
import { isUuid } from "@/app/panel/_server/act";

/** Source PDF of an import, only for signed-in members of the tenant. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const m = await getMember();
  if (!m) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return new Response("No encontrado", { status: 404 });
  try {
    const { body, fileName } = await readImportPdf(m, id);
    const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof AppError) return new Response("No encontrado", { status: 404 });
    throw err;
  }
}
