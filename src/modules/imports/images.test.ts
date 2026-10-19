import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { extractPdfImages } from "./images";

const PDF_DIR = process.env.IMPORT_PDF_DIR ?? "/Users/marquinho/inmobiliaria/assets-input/pdfs";
const hasPdfs = existsSync(PDF_DIR);

describe.skipIf(!hasPdfs)("extractPdfImages — real PDFs", () => {
  it("extracts photos as WebP and drops small icons, banners and repeated template images", async () => {
    const data = new Uint8Array(readFileSync(path.join(PDF_DIR, "Casa Pomasqui.pdf")));
    const images = await extractPdfImages(data);
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      expect(img.width).toBeGreaterThanOrEqual(400);
      expect(Math.max(img.width / img.height, img.height / img.width)).toBeLessThanOrEqual(4);
      const meta = await sharp(img.webp).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(img.width);
    }
    // The 1732×895 page background repeats on every page and must not be returned.
    expect(images.some((i) => i.width === 1732 && i.height === 895)).toBe(false);
    // The six 640px photos on the "FOTOS" pages (5 and 6) are kept.
    expect(images.filter((i) => i.page === 5 || i.page === 6)).toHaveLength(6);
  }, 60_000);

  it("respects a custom minWidth", async () => {
    const data = new Uint8Array(readFileSync(path.join(PDF_DIR, "CASA 4 CONJ. LAS PALMERAS - MACHALA.pdf")));
    const strict = await extractPdfImages(data);
    const loose = await extractPdfImages(data, { minWidth: 300 });
    expect(loose.length).toBeGreaterThan(strict.length);
    expect(loose.every((i) => i.width >= 300)).toBe(true);
  }, 60_000);
});
