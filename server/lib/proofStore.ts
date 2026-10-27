// Payment screenshots: stored in a PRIVATE Supabase bucket ("payment-proofs"). Only the admin sees them, through short-lived signed links.
import { db } from "./db";
const BUCKET = "payment-proofs";
let ready = false;
async function ensureBucket() {
  if (ready) return;
  const r = await db().storage.createBucket(BUCKET, { public: false, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ["image/webp"] });
  if (r.error && !/already exists|duplicate/i.test(r.error.message)) throw new Error(r.error.message);
  ready = true;
}
/** Saves the screenshot and returns its storage path (kept on the order as paymentProof). */
export async function uploadProof(orderNumber: string, bytes: Uint8Array) {
  await ensureBucket();
  const path = `${orderNumber.toLowerCase()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}.webp`;
  const r = await db().storage.from(BUCKET).upload(path, bytes, { contentType: "image/webp", upsert: false });
  if (r.error) throw new Error(r.error.message);
  return path;
}
/** Signed links (valid 1 hour) for the admin pages: { path: url }. */
const signed = new Map<string, { url: string; until: number }>(); // a signed link is reused for 30 of its 60 minutes (the admin pages poll, so this avoids re-signing every screenshot each time)
export async function proofUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}; const now = Date.now(); const need: string[] = [];
  for (const p of new Set(paths.filter(Boolean))) { const hit = signed.get(p); if (hit && hit.until > now) out[p] = hit.url; else need.push(p); }
  if (!need.length) return out;
  try { const r = await db().storage.from(BUCKET).createSignedUrls(need, 3600);
    if (signed.size > 2000) signed.clear();
    for (const x of r.data ?? []) if (x.path && x.signedUrl) { out[x.path] = x.signedUrl; signed.set(x.path, { url: x.signedUrl, until: now + 30 * 60_000 }); } } catch { /* bucket not created yet */ }
  return out;
}
export async function deleteProofs(paths: string[]) {
  const list = paths.filter(Boolean); if (list.length) await db().storage.from(BUCKET).remove(list).catch(() => undefined);
}
