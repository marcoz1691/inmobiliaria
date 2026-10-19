import sharp from "sharp";
import { MEDIA_WIDTHS } from "@/lib/image-loader";
import type { MediaVariant } from "@/server/db/schema";

const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const ACCEPTED = new Set(["jpeg", "png", "webp", "heif", "avif"]);

export type ProcessedImage = {
  width: number;
  height: number;
  blurDataUrl: string;
  variants: { width: number; height: number; body: Buffer }[];
};

/**
 * Validates by content (not extension), auto-rotates, strips EXIF/GPS metadata and
 * produces WebP variants plus a tiny blur placeholder.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.byteLength > MAX_INPUT_BYTES) throw new Error("La imagen supera 25 MB");
  const meta = await sharp(input, { failOn: "error" }).metadata();
  if (!meta.format || !ACCEPTED.has(meta.format)) throw new Error("Formato no soportado. Usa JPG, PNG, WebP o HEIC.");

  const base = sharp(input).rotate();
  const { width = 0, height = 0 } = await base.clone().toBuffer({ resolveWithObject: true }).then((r) => r.info);

  const variants = await Promise.all(
    MEDIA_WIDTHS.map(async (w) => {
      const { data, info } = await base
        .clone()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer({ resolveWithObject: true });
      return { width: info.width, height: info.height, body: data };
    }),
  );
  const blur = await base.clone().resize(16).webp({ quality: 40 }).toBuffer();
  return { width, height, blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`, variants };
}

export function variantKeys(baseKey: string): MediaVariant[] {
  return MEDIA_WIDTHS.map((w) => ({ width: w, height: 0, key: `${baseKey}-${w}.webp`, format: "webp" as const }));
}
