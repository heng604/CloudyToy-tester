// Resize + convert an upload to WebP (fits inside width x height, never enlarged, EXIF rotation applied).
// Cloudflare Workers: uses the Images binding (env.IMAGES). Node / Vercel / your PC: uses sharp as before.
import { IS_WORKER } from "./runtime";

type ImagesBinding = { input(s: ReadableStream): { transform(o: Record<string, unknown>): { output(o: Record<string, unknown>): Promise<{ response(): Response }> } } };

export async function toWebp(bytes: Uint8Array, width: number, height: number, quality: number): Promise<Uint8Array> {
  const images = (globalThis as Record<string, unknown>).__CT_IMAGES as ImagesBinding | undefined;
  if (IS_WORKER || images) {
    if (!images) throw new Error("Images binding missing: add \"images\": { \"binding\": \"IMAGES\" } to wrangler.jsonc");
    const out = await images.input(new Response(bytes).body as ReadableStream).transform({ width, height, fit: "scale-down" }).output({ format: "image/webp", quality });
    return new Uint8Array(await out.response().arrayBuffer());
  }
  const sharp = (await import("sharp")).default;
  return new Uint8Array(await sharp(bytes).rotate().resize({ width, height, fit: "inside", withoutEnlargement: true }).webp({ quality }).toBuffer());
}
