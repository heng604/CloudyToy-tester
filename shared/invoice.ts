// Pure helpers shared by the invoice page (image/print) and the customer e-mail, so both always say the same thing.
import type { StoredOrder } from "./types";
import { payNowCents } from "./orders";
export const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
/** "CT-261023-AB12C" -> "INV-261023-AB12C" */
export const invoiceNo = (orderNumber: string) => `INV-${orderNumber.replace(/^CT-/, "")}`;
/** "sok dara" -> "Sok" (used for the personal greeting). Falls back to "friend". */
export const firstName = (full: string) => { const w = full.trim().split(/\s+/)[0] ?? ""; return w ? w.charAt(0).toUpperCase() + w.slice(1) : "friend"; };
/** 23 October 2026 (Cambodia time, so the date never shifts for the shop owner). */
export const dateLong = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Phnom_Penh" });
export const timeShort = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Phnom_Penh" });
export type InvoiceState = { label: "PAID" | "PAY WITH DELIVERY" | "AWAITING PAYMENT" | "FAILED PAYMENT" | "REFUNDED"; tone: "green" | "amber" | "red" };
/** The stamp on the invoice and in the e-mails: PAID, AWAITING PAYMENT, PAY WITH DELIVERY or FAILED PAYMENT (expired counts as failed). */
export const invoiceState = (o: StoredOrder): InvoiceState =>
  o.paymentStatus === "PAID" ? { label: "PAID", tone: "green" }
  : o.paymentStatus === "FAILED" || o.paymentStatus === "EXPIRED" ? { label: "FAILED PAYMENT", tone: "red" }
  : o.paymentStatus === "REFUNDED" ? { label: "REFUNDED", tone: "amber" }
  : o.method === "COD" ? { label: "PAY WITH DELIVERY", tone: "red" } : { label: "AWAITING PAYMENT", tone: "amber" };
/** One warm sentence that tells the customer what happens next. */
export function nextStep(o: StoredOrder): string {
  const pre = o.preorder, full = !!pre && pre.balanceCents <= 0;
  if (o.paymentStatus === "FAILED" || o.paymentStatus === "EXPIRED") return "We could not confirm the payment for this order. Please contact us on Telegram or Facebook, or place the order again.";
  if (o.paymentStatus === "REFUNDED") return "This payment was refunded. If you have any questions, just reply to this email.";
  if (o.paymentStatus === "PAID") return pre ? (full ? `Your full payment is confirmed. Your pre-order will be dispatched in ${pre.dispatch}.` : `Your deposit is confirmed. Your pre-order will be dispatched in ${pre.dispatch}; the balance of ${usd(pre.balanceCents)} is paid then.`) : "Your payment is confirmed. We are packing your toys with love and will deliver them soon.";
  if (o.method === "COD") return `Please keep ${usd(o.totalCents)} in cash ready for our delivery driver. We will call you before we arrive.`;
  return o.paymentProof || o.claimedPaidAt
    ? "Thank you for sending your payment screenshot. We are checking it now and will confirm your order very soon."
    : `Please pay ${pre ? (full ? "the full pre-order price of " : `your ${pre.percent}% pre-order deposit of `) : ""}${usd(payNowCents(o))} by scanning our QR code and write ${o.orderNumber} in the note. Then send us the screenshot so we can confirm.${pre && !full ? ` The balance of ${usd(pre.balanceCents)} is paid when your order is dispatched (${pre.dispatch}).` : ""}`;
}
export const BRAND = { name: "Cloudy Toys", tagline: "Little Toys, Big Happiness", sky: "#8ECCFF", skyDeep: "#6CB8F5", skyPale: "#EAF5FF", border: "#D8EAFE", ink: "#2F4156", red: "#D62828", redPale: "#FDE4E4", mute: "#64748B", pink: "#FFB6C8" };
/** Header logo used on the invoice and in the invoice e-mails. */
export const INVOICE_LOGO = "/img/invoice-logo.jpg";

/** Footer contact lines ("Telegram: t.me/x", "Facebook: ..."), shared by the invoice, the receipt and the e-mails. */
export const contactLines = (s: { telegramUrl?: string; facebookUrl?: string }): string[] =>
  [s.telegramUrl && `Telegram: ${s.telegramUrl.replace(/^https?:\/\//, "")}`, s.facebookUrl && `Facebook: ${s.facebookUrl.replace(/^https?:\/\//, "")}`].filter(Boolean) as string[];
