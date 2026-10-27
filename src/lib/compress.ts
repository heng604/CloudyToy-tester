/** Shrinks photos in the browser BEFORE upload so requests stay under Vercel's ~4.5 MB body limit.
 *  The server still validates and re-encodes everything, so this is only a size optimisation. */
const MAX_SIDE = 1600;
async function shrink(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size === 0) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d"); if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h); bmp.close?.();
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/webp", 0.85));
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch { return file; }
}
/** Replaces every image File in the form data with a smaller copy. */
export async function compressFormData(fd: FormData): Promise<FormData> {
  const out = new FormData();
  for (const [k, v] of fd.entries()) out.append(k, v instanceof File ? await shrink(v) : v);
  return out;
}
