import { describe, it, expect } from "vitest";
import { customerHtml, customerSubject, adminInvoiceHtml } from "../server/lib/customerEmail";
import { sendCustomerEmail } from "../server/lib/email";
import { invoiceNo, firstName } from "../shared/invoice";
import type { StoredOrder } from "../shared/types";
const o: StoredOrder = { orderNumber: "CT-261023-AB12C", createdAt: "2026-10-23T05:00:00Z", area: "PHNOM_PENH", method: "COD", customer: { name: "sok <b>dara</b>", email: "a@b.com", phone: "012", address: "St 1" },
  items: [{ productId: "1", sku: "CT-TOY-001", name: "Bear", qty: 2, unitCents: 1500, lineCents: 3000 }], subtotalCents: 3000, discountCents: 300, shippingCents: 150, totalCents: 2850, currency: "USD", discountCode: "HAPPY10", paymentStatus: "PENDING", paymentReference: "PAY-X", email: { status: "NONE", attempts: 0 } };
describe("customer invoice email", () => {
  it("greets the customer by first name and shows totals", () => { const h = customerHtml(o, "placed", "https://shop.test"); expect(h).toContain("Hi Sok"); expect(h).toContain("$28.50"); expect(h).toContain("HAPPY10"); expect(h).toContain("/img/invoice-logo.jpg"); });
  it("customers get no invoice link; red discount", () => { const h = customerHtml(o, "placed", "https://shop.test"); expect(h).not.toContain("/invoice/"); expect(h).not.toContain("/admin/"); expect(h).not.toContain("OWNER ONLY"); expect(h).toContain("ITEM"); expect(h).toContain("color:#D62828;font-weight:bold"); });
  it("escapes customer HTML", () => expect(customerHtml(o, "placed", "")).not.toContain("<b>dara"));
  it("works without SITE_URL (no broken image or link)", () => { const h = customerHtml(o, "placed", ""); expect(h).not.toContain("<img"); expect(h).not.toContain("/invoice/"); });
  it("paid receipt says payment received", () => { expect(customerSubject(o, "paid")).toContain("Payment received"); expect(customerHtml({ ...o, paymentStatus: "PAID" }, "paid", "")).toContain("PAID"); });
  it("is skipped when the customer has no email", async () => expect((await sendCustomerEmail({ ...o, customer: { ...o.customer, email: "" } }, "placed")).status).toBe("SKIPPED"));
  it("helpers", () => { expect(invoiceNo(o.orderNumber)).toBe("INV-261023-AB12C"); expect(firstName("  ")).toBe("friend"); });
});
describe("same design for every order: header pill, mascot, details, stamp, footer", () => {
  const h = customerHtml(o, "placed", "https://shop.test", ["Telegram: t.me/x"]);
  it("has the pill, mascot, details box, totals box and footer", () => {
    expect(h).toContain("INV-261023-AB12C"); expect(h).not.toContain("#CT-261023-AB12C"); expect(h).toContain("/img/email/mascot.png"); expect(h).toContain("Ship to"); expect(h).toContain("Subtotal"); expect(h).toContain("with love, Cloudy Toys"); expect(h).toContain("Telegram: t.me/x"); expect(h).toContain("Nunito");
  });
  it("inline logo and mascot use attached images (cid) even without SITE_URL", () => { const x = customerHtml(o, "placed", "", [], true); expect(x).toContain('src="cid:invoice-logo"'); expect(x).toContain('src="cid:cloudy-mascot"'); });
});
describe("payment stamp", () => {
  const stampOf = (x: StoredOrder) => customerHtml(x, "placed", "");
  it("PAY WITH DELIVERY for pending cash orders (blue)", () => { const h = stampOf(o); expect(h).toContain("PAY WITH DELIVERY"); expect(h).toContain("border:4px double #1F4E9C"); });
  it("AWAITING PAYMENT for pending QR / Bakong orders (amber)", () => { const h = stampOf({ ...o, method: "QR_IMAGE" }); expect(h).toContain("AWAITING PAYMENT"); expect(h).toContain("border:4px double #B87500"); expect(h).not.toContain("PAY WITH DELIVERY"); });
  it("PAID (green)", () => { const h = stampOf({ ...o, paymentStatus: "PAID" }); expect(h).toContain(">PAID<"); expect(h).toContain("border:4px double #1f7a3a"); });
  it("FAILED PAYMENT (red) for failed and expired orders, with its own subject and message", () => {
    for (const s of ["FAILED", "EXPIRED"] as const) { const x = { ...o, method: "QR_IMAGE" as const, paymentStatus: s }; const h = stampOf(x); expect(h).toContain("FAILED PAYMENT"); expect(h).toContain("border:4px double #D62828"); expect(h).toContain("could not confirm the payment"); expect(customerSubject(x, "placed")).toContain("not completed"); }
  });
  it("the owner copy carries the same stamp plus the owner-only box", () => { const h = adminInvoiceHtml({ ...o, paymentStatus: "PAID" }, "", ""); expect(h).toContain(">PAID<"); expect(h).toContain("OWNER ONLY"); expect(h).toContain("Hi Shop Owner"); });
});
import { itemsHtml, itemsSubject } from "../server/lib/itemsEmail";
describe("meet-your-toys email (one card per product)", () => {
  it("shows every product with qty and price, different subject from the invoice", () => {
    const h = itemsHtml(o, { "1": "https://img.test/bear.jpg" }, "https://shop.test");
    expect(h).toContain("Meet your toys, Sok"); expect(h).toContain("Bear"); expect(h).toContain("× 2"); expect(h).toContain("$15.00"); expect(h).toContain("https://img.test/bear.jpg"); expect(h).toContain("All rights reserved.");
    expect(itemsSubject(o)).not.toBe(customerSubject(o, "placed"));
  });
  it("escapes HTML, works without pictures or SITE_URL", () => { const h = itemsHtml(o, {}, ""); expect(h).not.toContain("<b>dara"); expect(h).not.toContain("<img"); expect(h).toContain("🧸"); });
});
