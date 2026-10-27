export const MAX_BYTES = 5 * 1024 * 1024;
export const ALLOWED = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
export type AllowedMime = keyof typeof ALLOWED;
/** Detect type from file CONTENT (magic bytes), never from filename. SVG/HTML/exe return null. */
export function sniff(b: Uint8Array): AllowedMime | null {
  if (b.length > 11 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}
export function validateImage(bytes: Uint8Array, declaredMime: string) {
  if (bytes.length === 0) return { ok: false as const, error: "Empty file" };
  if (bytes.length > MAX_BYTES) return { ok: false as const, error: "File larger than 5 MB" };
  const real = sniff(bytes);
  if (!real) return { ok: false as const, error: "Unsupported image type. Use JPEG, PNG or WebP." };
  if (real !== declaredMime) return { ok: false as const, error: "File content does not match its type" };
  return { ok: true as const, mime: real, ext: ALLOWED[real] };
}
/** Server-generated name; user filename is never used in the path. */
export function safeFileName(sku: string, ext: string, rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6)) {
  const s = sku.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32) || "product";
  return `${s}-${rand}.${ext}`;
}
