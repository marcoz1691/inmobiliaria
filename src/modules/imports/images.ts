import { createHash } from "node:crypto";
import sharp from "sharp";
import { extractImages, getDocumentProxy } from "unpdf";

export type PdfImage = { page: number; index: number; webp: Buffer; width: number; height: number };

/** Banners/strips wider than this ratio are layout decoration, not photos. */
const MAX_ASPECT_RATIO = 4;

/**
 * Extracts embedded raster images as WebP. Discards:
 *  - images narrower than `minWidth` (icons, logos; default 400 px),
 *  - extreme-aspect banners,
 *  - images repeated on 2+ pages (template backgrounds, covers, logos).
 */
export async function extractPdfImages(
  data: Uint8Array,
  opts: { minWidth?: number } = {},
): Promise<{ page: number; index: number; webp: Buffer; width: number; height: number }[]> {
  const minWidth = opts.minWidth ?? 400;
  const pdf = await getDocumentProxy(new Uint8Array(data), { verbosity: 0 });
  try {
    type Candidate = { page: number; index: number; hash: string; width: number; height: number; raw: Uint8ClampedArray; channels: 1 | 3 | 4 };
    const candidates: Candidate[] = [];
    const pagesByHash = new Map<string, Set<number>>();

    for (let page = 1; page <= pdf.numPages; page++) {
      const images = await extractImages(pdf, page);
      images.forEach((img, index) => {
        const hash = createHash("sha1").update(img.data).digest("hex");
        const seen = pagesByHash.get(hash) ?? new Set<number>();
        seen.add(page);
        pagesByHash.set(hash, seen);
        if (img.width < minWidth) return;
        const ratio = Math.max(img.width / img.height, img.height / img.width);
        if (ratio > MAX_ASPECT_RATIO) return;
        candidates.push({ page, index, hash, width: img.width, height: img.height, raw: img.data, channels: img.channels });
      });
    }

    const emitted = new Set<string>();
    const out: PdfImage[] = [];
    for (const c of candidates) {
      if ((pagesByHash.get(c.hash)?.size ?? 0) > 1 || emitted.has(c.hash)) continue;
      emitted.add(c.hash);
      const webp = await sharp(Buffer.from(c.raw.buffer, c.raw.byteOffset, c.raw.byteLength), {
        raw: { width: c.width, height: c.height, channels: c.channels },
      })
        .webp({ quality: 82 })
        .toBuffer();
      out.push({ page: c.page, index: c.index, webp, width: c.width, height: c.height });
    }
    return out;
  } finally {
    await pdf.loadingTask.destroy();
  }
}
