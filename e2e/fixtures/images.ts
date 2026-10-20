import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** Generates distinct solid-colour JPEG photos for upload tests (not committed). */
export async function makePhotos(n: number): Promise<string[]> {
  const dir = path.join(process.cwd(), "test-results", "fixtures");
  await mkdir(dir, { recursive: true });
  const colors = ["#8a6f55", "#4f6d7a", "#a3a380", "#6b4f4f", "#3e5c50"];
  return Promise.all(
    Array.from({ length: n }, async (_, i) => {
      const file = path.join(dir, `foto-${i + 1}.jpg`);
      await sharp({ create: { width: 3000, height: 2000, channels: 3, background: colors[i % colors.length]! } })
        .jpeg({ quality: 80 })
        .toFile(file);
      return file;
    }),
  );
}
