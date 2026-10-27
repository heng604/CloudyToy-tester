// Pure discount rules (no I/O). Amounts are integer cents. Delivery is never discounted.
// The admin creates a code worth 10-50%. A customer who types that exact code at checkout gets that % off the cart SUBTOTAL.
// There are no per-item discounts.
export const MIN_PERCENT = 10, MAX_PERCENT = 50;
export const percentOk = (n: number) => Number.isInteger(n) && n >= MIN_PERCENT && n <= MAX_PERCENT;
export const CODE_RE = /^[A-Z0-9_-]{3,30}$/;
export const normalizeCode = (s: string) => s.trim().toUpperCase();
export type DiscountResult = { ok: true; discountCents: number } | { ok: false; error: string };
/** The % comes off the whole cart subtotal (delivery is never discounted). */
export function subtotalCodeDiscount(subtotalCents: number, percent: number): DiscountResult {
  const cents = Math.round((subtotalCents * percent) / 100);
  return cents > 0 ? { ok: true, discountCents: cents } : { ok: false, error: "That discount code is not valid for the items in your cart." };
}
/** Random easy-to-read code for the admin "Generate" button (no 0/O/1/I). */
export function generateCode(len = 8, rand: () => number = Math.random) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = "";
  for (let i = 0; i < len; i++) s += abc[Math.floor(rand() * abc.length)];
  return s;
}
