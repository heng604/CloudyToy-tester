// Reads a file from public/ (e.g. "/img/invoice-logo.jpg"). On Node it reads the disk; on Cloudflare Workers (no disk) it uses the copy embedded by tools/embed-assets.mjs.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EMBEDDED } from "./embedded-assets.gen";

export function publicFile(rel: string): Buffer | null {
  const key = rel.replace(/^\/+/, "");
  try { return readFileSync(join(process.cwd(), "public", key)); } catch { /* no disk: fall through */ }
  const b64 = EMBEDDED[key]; return b64 ? Buffer.from(b64, "base64") : null;
}
