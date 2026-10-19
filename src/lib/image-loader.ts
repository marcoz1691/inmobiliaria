/** Widths generated for every uploaded photo (src/modules/media/process.ts). */
export const MEDIA_WIDTHS = [480, 960, 1600] as const;

type LoaderArgs = { src: string; width: number; quality?: number };

/**
 * next/image loader. Uploaded media is stored as pre-sized WebP variants named `<base>-<w>.webp`;
 * the `media:` scheme marks those so the closest variant is picked. Other sources pass through.
 */
export default function imageLoader({ src, width }: LoaderArgs): string {
  if (!src.startsWith("media:")) return src;
  const base = src.slice("media:".length);
  const w = MEDIA_WIDTHS.find((mw) => mw >= width) ?? MEDIA_WIDTHS[MEDIA_WIDTHS.length - 1];
  return `${base}-${w}.webp`;
}
