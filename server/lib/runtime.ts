/** true when running inside a Cloudflare Worker (false on your PC, a normal Node server or Vercel). */
export const IS_WORKER = typeof navigator !== "undefined" && (navigator as { userAgent?: string }).userAgent === "Cloudflare-Workers";
