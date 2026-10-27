// Cloudflare R2 (S3-compatible) storage for public images. No extra npm package: requests are signed with AWS Signature V4 using node:crypto.
// Turned on automatically when all five R2_* variables are set (see .env.example). Without them the shop keeps using Supabase Storage.
import { createHmac, createHash } from "node:crypto";
import "../env"; // makes sure .env.local is loaded before we read process.env

const cfg = () => ({
  account: process.env.R2_ACCOUNT_ID || "", key: process.env.R2_ACCESS_KEY_ID || "", secret: process.env.R2_SECRET_ACCESS_KEY || "",
  bucket: process.env.R2_BUCKET || "", publicUrl: (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, ""),
});
export const r2Enabled = () => { const c = cfg(); return !!(c.account && c.key && c.secret && c.bucket && c.publicUrl); };
/** Public base address of the bucket, e.g. https://pub-xxxx.r2.dev (empty when R2 is off). */
export const r2PublicBase = () => cfg().publicUrl;

const sha256hex = (d: string | Uint8Array) => createHash("sha256").update(d).digest("hex");
const hmac = (k: string | Buffer, d: string) => createHmac("sha256", k).update(d).digest();

/** AWS Signature V4 "Authorization" header value. `headers` must be lowercase names and include host + x-amz-content-sha256 + x-amz-date. */
export function sigV4Authorization(o: { method: string; path: string; query?: string; headers: Record<string, string>; payloadHash: string; amzDate: string; region: string; service: string; accessKey: string; secretKey: string }) {
  const names = Object.keys(o.headers).sort();
  const canonicalHeaders = names.map((n) => `${n}:${o.headers[n].trim()}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalRequest = [o.method, o.path, o.query ?? "", canonicalHeaders, signedHeaders, o.payloadHash].join("\n");
  const day = o.amzDate.slice(0, 8), scope = `${day}/${o.region}/${o.service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", o.amzDate, scope, sha256hex(canonicalRequest)].join("\n");
  const kSigning = hmac(hmac(hmac(hmac("AWS4" + o.secretKey, day), o.region), o.service), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(toSign).digest("hex");
  return `AWS4-HMAC-SHA256 Credential=${o.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

async function call(method: "PUT" | "DELETE", name: string, body?: Uint8Array, extra: Record<string, string> = {}) {
  const c = cfg(), host = `${c.account}.r2.cloudflarestorage.com`, path = `/${c.bucket}/${name}`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""); // 20260101T000000Z
  const payloadHash = sha256hex(body ?? "");
  const headers: Record<string, string> = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate, ...extra };
  const authorization = sigV4Authorization({ method, path, headers, payloadHash, amzDate, region: "auto", service: "s3", accessKey: c.key, secretKey: c.secret });
  const { host: _h, ...sendHeaders } = headers;
  const init: any = { method, headers: { ...sendHeaders, authorization } };
  if (body) init.body = body;
  const res = await fetch(`https://${host}${path}`, init);
  if (!res.ok) throw new Error(`R2 ${method} failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
}

/** Upload one image; returns its public URL. `name` must already be a safe file name (letters, digits, dash, dot). */
export async function r2Put(name: string, bytes: Uint8Array, mime: string) {
  await call("PUT", name, bytes, { "content-type": mime, "cache-control": "public, max-age=31536000, immutable" });
  return `${cfg().publicUrl}/${name}`;
}
/** Delete images by file name. Missing files are not an error (R2 answers 204). */
export async function r2Delete(names: string[]) { await Promise.all(names.map((n) => call("DELETE", n))); }
