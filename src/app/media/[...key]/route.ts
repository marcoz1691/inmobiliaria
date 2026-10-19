import { integrations } from "@/env";
import { readLocal } from "@/modules/media/storage";

const TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", pdf: "application/pdf" };

/** Serves locally stored media in dev/test. In production media is served by Supabase Storage. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (integrations.supabaseStorage) return new Response("Not found", { status: 404 });
  const { key } = await params;
  const joined = key.join("/");
  try {
    const body = await readLocal(joined);
    const ext = joined.split(".").pop()?.toLowerCase() ?? "";
    return new Response(new Uint8Array(body), {
      headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
