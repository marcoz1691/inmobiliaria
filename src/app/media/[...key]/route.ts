import { integrations } from "@/env";
import { readLocal } from "@/modules/media/storage";

/**
 * Public photo variants only (`<base>-<width>.webp` of properties and agent photos). Other stored
 * objects, like imported source PDFs, are private and go through authenticated panel routes.
 */
const PUBLIC_KEY = /^tenants\/[0-9a-f-]{36}\/(properties|agents)\/[0-9a-f-]{36}\/[\w-]+\.webp$/i;

/** Serves locally stored media in dev/test. In production media is served by Supabase Storage. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (integrations.supabaseStorage) return new Response("Not found", { status: 404 });
  const { key } = await params;
  const joined = key.join("/");
  if (!PUBLIC_KEY.test(joined)) return new Response("Not found", { status: 404 });
  try {
    const body = await readLocal(joined);
    return new Response(new Uint8Array(body), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
