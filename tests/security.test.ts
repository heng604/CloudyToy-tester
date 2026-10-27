import { describe, it, expect } from "vitest";
import { publicOrder } from "../server/lib/publicOrder";
import { tooMany } from "../server/lib/rateLimit";
import { safeNext } from "../shared/safeRedirect";
import type { StoredOrder } from "../shared/types";
const o = { orderNumber: "CT-261027-ABCDE", createdAt: "2026-10-27", area: "PHNOM_PENH", method: "QR_IMAGE", customer: { name: "Sok", email: "sok@example.com", phone: "012345678", address: "Street 1, Phnom Penh" },
  items: [{ productId: "1", sku: "CT-1", name: "Bear", qty: 1, unitCents: 1500, lineCents: 1500 }], subtotalCents: 1500, discountCents: 0, shippingCents: 150, totalCents: 1650, currency: "USD", accountEmail: "sok@example.com",
  paymentStatus: "PENDING", paymentReference: "PAY-1", paymentProof: "proofs/secret.webp", bakongHash: "abc", bakongMd5s: ["x"], paidManuallyBy: "admin@x.com", email: { status: "FAILED", detail: "Resend key abc", attempts: 3 } } as StoredOrder;
describe("public order view", () => {
  it("removes personal data and internal fields", () => { const j = JSON.stringify(publicOrder(o)); for (const s of ["Sok", "sok@example.com", "012345678", "Street 1", "proofs/secret", "abc", "admin@x.com", "Resend key"]) expect(j).not.toContain(s); });
  it("keeps what the payment page needs", () => { const p = publicOrder(o); expect(p.items[0].name).toBe("Bear"); expect(p.totalCents).toBe(1650); expect(p.paymentStatus).toBe("PENDING"); expect(p.area).toBe("PHNOM_PENH"); });
});
describe("rate limiter", () => { it("blocks after the limit and keeps other keys free", () => { for (let i = 0; i < 3; i++) expect(tooMany("t:a", 3)).toBe(false); expect(tooMany("t:a", 3)).toBe(true); expect(tooMany("t:b", 3)).toBe(false); }); });
describe("open redirect", () => { it("only allows same-site paths", () => { for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)"]) expect(safeNext(bad)).toBe("/account"); expect(safeNext("/orders")).toBe("/orders"); }); });
