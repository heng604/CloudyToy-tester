import { describe, it, expect } from "vitest";
import { checkPreorder, preorderSplit, DEFAULT_PREORDER } from "../shared/promotions";
import { checkPreorderDates, preorderPhase, windowText } from "../shared/products";
import { customerHtml, adminInvoiceHtml, customerSubject } from "../server/lib/customerEmail";
import { itemsHtml } from "../server/lib/itemsEmail";
import { adminHtml } from "../server/lib/email";
import { nextStep } from "../shared/invoice";
import { payNowCents } from "../shared/orders";
import type { StoredOrder } from "../shared/types";

const base = { depositPercent: 50, dispatchText: "10 - 14 Business Days", capSlots: 50 };
const order = (pre?: StoredOrder["preorder"]): StoredOrder => ({ orderNumber: "CT-261101-ABCDE", createdAt: "2026-11-01T03:00:00Z", area: "PHNOM_PENH", method: "QR_IMAGE",
  customer: { name: "sok dara", email: "a@b.co", phone: "012", address: "x" }, items: [{ productId: "p1", sku: "S1", name: "Plush <Bear>", qty: 2, unitCents: 1000, lineCents: 2000 }],
  subtotalCents: 2000, discountCents: 0, shippingCents: 150, totalCents: 2150, currency: "USD", ...(pre ? { preorder: pre } : {}), paymentStatus: "PENDING", paymentReference: "PAY-1", email: { status: "NONE", attempts: 0 } });
/** Two pre-order toys with DIFFERENT dates, plus one normal toy: each line carries its own window. */
const multi = (): StoredOrder => { const o = order(preorderSplit(5000, DEFAULT_PREORDER));
  o.items = [{ productId: "p1", sku: "S1", name: "Bear", qty: 1, unitCents: 1000, lineCents: 1000, opens: "2026-11-01", closes: "2026-11-15" },
    { productId: "p2", sku: "S2", name: "Bunny", qty: 1, unitCents: 2000, lineCents: 2000, opens: "2026-12-01", closes: "2026-12-20" },
    { productId: "p3", sku: "S3", name: "Cat", qty: 1, unitCents: 2000, lineCents: 2000 }]; return o; };
const win = DEFAULT_PREORDER;

describe("pre-order dates are per product (not one deadline for all)", () => {
  it("accepts both dates or none", () => { expect(checkPreorderDates("2026-11-01", "2026-11-15").ok).toBe(true); expect(checkPreorderDates("", "").ok).toBe(true); });
  it("rejects one date only, bad dates, and a deadline before the start", () => {
    expect(checkPreorderDates("2026-11-01", "").ok).toBe(false); expect(checkPreorderDates("2026-02-31", "2026-03-05").ok).toBe(false); expect(checkPreorderDates("2026-11-15", "2026-11-01").ok).toBe(false);
  });
  it("global rules no longer carry dates", () => { expect(DEFAULT_PREORDER).not.toHaveProperty("startDate"); expect(preorderSplit(2150, DEFAULT_PREORDER)).not.toHaveProperty("opens"); });
  it("phase follows each product's own dates (deadline day included, Cambodia time)", () => {
    const w = { preorderStart: "2026-11-01", preorderEnd: "2026-11-15" }, at = (d: string) => Date.parse(`${d}T05:00:00Z`);
    expect(preorderPhase(w, at("2026-10-31"))).toBe("upcoming"); expect(preorderPhase(w, at("2026-11-01"))).toBe("open"); expect(preorderPhase(w, at("2026-11-15"))).toBe("open"); expect(preorderPhase(w, at("2026-11-16"))).toBe("closed");
    expect(preorderPhase({}, at("2030-01-01"))).toBe("open");
    expect(preorderPhase(w, Date.parse("2026-11-15T18:00:00Z"))).toBe("closed"); // 01:00 on 16 Nov in Phnom Penh
  });
  it("windowText", () => { expect(windowText({ preorderStart: "2026-11-01", preorderEnd: "2026-11-15" })).toBe("1 Nov 2026 to 15 Nov 2026"); expect(windowText({})).toBe(""); });
});
describe("pre-order payment choice: deposit or full price", () => {
  it("deposit is the default; full price pays everything now", () => {
    expect(preorderSplit(2150, DEFAULT_PREORDER)).toMatchObject({ percent: 50, depositCents: 1075, balanceCents: 1075 });
    const f = preorderSplit(2150, DEFAULT_PREORDER, true);
    expect(f).toMatchObject({ percent: 100, depositCents: 2150, balanceCents: 0, full: true });
    expect(payNowCents(order(f))).toBe(2150);
  });
  it("wording follows the choice", () => {
    expect(nextStep(order(preorderSplit(2150, DEFAULT_PREORDER)))).toContain("50% pre-order deposit");
    const full = nextStep(order(preorderSplit(2150, DEFAULT_PREORDER, true)));
    expect(full).toContain("full pre-order price"); expect(full).not.toContain("balance");
  });
});
describe("pre-order e-mail", () => {
  const withDates = (o: StoredOrder) => ({ ...o, items: o.items.map((i) => ({ ...i, opens: "2026-11-01", closes: "2026-11-15" })) });
  const dep = withDates(order(preorderSplit(2150, win))), full = withDates(order(preorderSplit(2150, win, true)));
  it("customer copy: dates, deposit, balance, customer details, escaped names", () => {
    const h = customerHtml(dep, "placed", "");
    expect(h).toContain("INV-261101-ABCDE"); expect(h).toContain("is reserved"); expect(h).toContain("Hi Sok"); expect(h).toContain("1 Nov 2026 to 15 Nov 2026");
    expect(h).toContain("$10.75"); expect(h).toContain("Balance at dispatch"); expect(h).toContain("012"); expect(h).toContain("a@b.co");
    expect(h).toContain("Plush &lt;Bear&gt;"); expect(h).not.toContain("Plush <Bear>"); expect(h).not.toContain("OWNER ONLY"); expect(customerSubject(dep, "placed")).toContain("Sok");
  });
  it("full price: no balance line, says paid in full when paid", () => {
    const h = customerHtml(full, "placed", ""); expect(h).toContain("Pay now (full)"); expect(h).not.toContain("Balance at dispatch"); expect(h).toContain("Full price");
    expect(customerHtml({ ...full, paymentStatus: "PAID" }, "placed", "")).toContain("Paid in full");
  });
  it("owner copy has the owner-only box; pre-order orders use it for the shop mail, normal orders do not", () => {
    const h = adminInvoiceHtml(dep, "", ""); expect(h).toContain("Hi Shop Owner"); expect(h).toContain("OWNER ONLY"); expect(h).toContain("PAY-1");
    expect(adminHtml(dep)).toContain("New pre-order received"); expect(adminHtml(order())).toContain("New order received"); expect(adminHtml(order())).not.toContain("Pre-order dates");
  });
  it("no window text when the admin set no dates; normal orders keep the old design", () => {
    expect(customerHtml(order(preorderSplit(2150, DEFAULT_PREORDER)), "placed", "")).not.toContain("15 November");
    const normal = itemsHtml(order(), {}, ""); expect(normal).toContain("Meet your toys"); expect(normal).not.toContain("is reserved"); expect(customerHtml(order(), "placed", "")).not.toContain("Pre-order dates");
  });
});
describe("each toy shows its own pre-order dates", () => {
  it("invoice and 'Meet your toys' list one window per item; items without dates show none", () => {
    for (const h of [customerHtml(multi(), "placed", ""), itemsHtml(multi(), {}, "")]) {
      expect(h).toContain("1 Nov 2026 to 15 Nov 2026"); expect(h).toContain("1 Dec 2026 to 20 Dec 2026"); expect((h.match(/Pre-order: /g) ?? []).length).toBe(2);
    }
  });
  it("old orders with one order-wide window still show it on every item", () => {
    const o = order({ ...preorderSplit(2150, win), opens: "2026-11-01", closes: "2026-11-15" }); expect(customerHtml(o, "placed", "")).toContain("1 Nov 2026 to 15 Nov 2026");
  });
});
