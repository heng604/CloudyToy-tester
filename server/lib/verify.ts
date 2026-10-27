import { createHmac, timingSafeEqual } from "crypto";
export type ProviderResult = { reference: string; amountCents: number; currency: string; merchantId: string; status: "SUCCESS" | "PENDING" | "FAILED"; transactionId?: string };
export type Expected = { reference: string; amountCents: number; currency: string; merchantId: string };
/** Every field must match exactly; anything else is rejected. This is the ONLY path to "PAID". */
export function matchesExpected(r: ProviderResult, e: Expected): { ok: true } | { ok: false; reason: string } {
  if (r.status !== "SUCCESS") return { ok: false, reason: "NOT_SUCCESS" };
  if (r.reference !== e.reference) return { ok: false, reason: "REFERENCE_MISMATCH" };
  if (r.merchantId !== e.merchantId) return { ok: false, reason: "MERCHANT_MISMATCH" };
  if (r.currency !== e.currency) return { ok: false, reason: "CURRENCY_MISMATCH" };
  if (r.amountCents !== e.amountCents) return { ok: false, reason: "AMOUNT_MISMATCH" };
  return { ok: true };
}
/** Generic HMAC-SHA256 helper. The REAL scheme must be taken from the provider's verified docs before use. */
export function hmacValid(rawBody: string, signatureHex: string, secret: string): boolean {
  if (!secret || !signatureHex) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  let given: Buffer; try { given = Buffer.from(signatureHex, "hex"); } catch { return false; }
  return given.length === expected.length && timingSafeEqual(given, expected);
}
/** Replay guard: true only the first time an event id is seen (DB enforces with unique provider_event_id). */
export function firstSeen(seen: Set<string>, eventId: string) { if (seen.has(eventId)) return false; seen.add(eventId); return true; }
