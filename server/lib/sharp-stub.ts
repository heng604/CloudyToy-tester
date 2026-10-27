// wrangler.jsonc aliases "sharp" to this file so the Worker bundle never tries to include the native library.
export default function sharp(): never { throw new Error("sharp is not available on Cloudflare Workers (the IMAGES binding is used instead)"); }
