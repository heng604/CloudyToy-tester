import { describe, it, expect } from "vitest";
import { isAdminEmail } from "../shared/admin";
import { safeNext } from "../shared/safeRedirect";
import { canPay, canFulfil } from "../shared/orders";
import { computeTotals, PricedProduct } from "../shared/pricing";
import { validateImage, safeFileName } from "../shared/images";
import { matchesExpected, hmacValid, firstSeen } from "../server/lib/verify";
import { createHmac } from "crypto";

describe("admin allowlist", () => {
  it("accepts verified allowlisted email, case-insensitive", () => expect(isAdminEmail("Owner@Example.com", true, "owner@example.com")).toBe(true));
  it("rejects unverified email", () => expect(isAdminEmail("owner@example.com", false, "owner@example.com")).toBe(false));
  it("rejects non-listed and empty allowlist", () => { expect(isAdminEmail("x@y.com", true, "owner@example.com")).toBe(false); expect(isAdminEmail("x@y.com", true, "")).toBe(false); });
});
describe("oauth redirect safety", () => {
  it("allows relative paths", () => expect(safeNext("/account/orders")).toBe("/account/orders"));
  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "", null])("blocks %s", (v) => expect(safeNext(v as string)).toBe("/account"));
});
describe("state transitions", () => {
  it("payment: PENDING->PAID ok, PAID->PENDING blocked, FAILED->PAID blocked", () => { expect(canPay("PENDING", "PAID")).toBe(true); expect(canPay("PAID", "PENDING")).toBe(false); expect(canPay("FAILED", "PAID")).toBe(false); });
  it("late payment: EXPIRED->PAID allowed for review workflow only", () => expect(canPay("EXPIRED", "PAID")).toBe(true));
  it("REFUNDED only from PAID", () => { expect(canPay("PAID", "REFUNDED")).toBe(true); expect(canPay("PENDING", "REFUNDED")).toBe(false); });
  it("cannot fulfil unpaid order", () => expect(canFulfil("UNFULFILLED", "CONFIRMED", "PENDING")).toBe(false));
  it("paid order advances; cannot skip to SHIPPED", () => { expect(canFulfil("UNFULFILLED", "CONFIRMED", "PAID")).toBe(true); expect(canFulfil("UNFULFILLED", "SHIPPED", "PAID")).toBe(false); });
});
const cat = new Map<string, PricedProduct>([
  ["a", { id: "a", name: "A", priceCents: 1800, saleCents: 1500, stock: 3, active: true }],
  ["b", { id: "b", name: "B", priceCents: 1200, stock: 0, active: true }],
  ["c", { id: "c", name: "C", priceCents: 500, stock: 9, active: false }],
]);
describe("server pricing", () => {
  it("uses sale price and adds shipping", () => expect(computeTotals([{ productId: "a", qty: 2 }], cat, 300).totalCents).toBe(3300));
  it("rejects over-stock, out-of-stock, inactive, bad qty, empty", () => {
    expect(() => computeTotals([{ productId: "a", qty: 4 }], cat, 0)).toThrow("INSUFFICIENT_STOCK");
    expect(() => computeTotals([{ productId: "b", qty: 1 }], cat, 0)).toThrow("INSUFFICIENT_STOCK");
    expect(() => computeTotals([{ productId: "c", qty: 1 }], cat, 0)).toThrow("PRODUCT_UNAVAILABLE");
    expect(() => computeTotals([{ productId: "a", qty: 0 }], cat, 0)).toThrow("INVALID_QTY");
    expect(() => computeTotals([], cat, 0)).toThrow("EMPTY_CART");
  });
  it("allows backorder only when enabled", () => { const m = new Map(cat); m.set("b", { ...cat.get("b")!, backorder: true }); expect(computeTotals([{ productId: "b", qty: 2 }], m, 0).totalCents).toBe(2400); });
  it("discount cannot exceed subtotal", () => expect(computeTotals([{ productId: "a", qty: 1 }], cat, 0, 999999).totalCents).toBe(0));
});
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
describe("image validation", () => {
  it("accepts real PNG", () => expect(validateImage(png, "image/png").ok).toBe(true));
  it("rejects SVG/HTML disguised as image", () => { const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>"); expect(validateImage(svg, "image/png").ok).toBe(false); });
  it("rejects MIME/content mismatch", () => expect(validateImage(png, "image/jpeg").ok).toBe(false));
  it("rejects >5MB and empty", () => { expect(validateImage(new Uint8Array(5 * 1024 * 1024 + 1), "image/png").ok).toBe(false); expect(validateImage(new Uint8Array(0), "image/png").ok).toBe(false); });
  it("generated names ignore path traversal", () => { const n = safeFileName("../../etc/passwd", "png", "abc123"); expect(n).not.toMatch(/[\/\\.]{2}/); expect(n.endsWith("-abc123.png")).toBe(true); expect(n).not.toContain("/"); });
});
const exp = { reference: "CT-1", amountCents: 3300, currency: "USD", merchantId: "M1" };
const ok = { ...exp, status: "SUCCESS" as const };
describe("payment verification rules", () => {
  it("accepts exact match", () => expect(matchesExpected(ok, exp).ok).toBe(true));
  it.each([["amountCents", 100, "AMOUNT_MISMATCH"], ["currency", "KHR", "CURRENCY_MISMATCH"], ["reference", "CT-2", "REFERENCE_MISMATCH"], ["merchantId", "M2", "MERCHANT_MISMATCH"], ["status", "PENDING", "NOT_SUCCESS"]])("rejects bad %s", (k, v, reason) => expect(matchesExpected({ ...ok, [k]: v } as never, exp)).toEqual({ ok: false, reason }));
  it("HMAC: valid, tampered body, wrong secret, empty secret", () => {
    const body = '{"a":1}', sig = createHmac("sha256", "s3cret").update(body).digest("hex");
    expect(hmacValid(body, sig, "s3cret")).toBe(true); expect(hmacValid(body + " ", sig, "s3cret")).toBe(false);
    expect(hmacValid(body, sig, "other")).toBe(false); expect(hmacValid(body, sig, "")).toBe(false); expect(hmacValid(body, "zz", "s3cret")).toBe(false);
  });
  it("replay: duplicate event id is rejected", () => { const s = new Set<string>(); expect(firstSeen(s, "e1")).toBe(true); expect(firstSeen(s, "e1")).toBe(false); });
});


import { percentOk } from "../shared/discount";
describe("percent limits", () => { it("allows 10-50 whole numbers only", () => { expect(percentOk(10)).toBe(true); expect(percentOk(50)).toBe(true); expect(percentOk(9)).toBe(false); expect(percentOk(51)).toBe(false); expect(percentOk(12.5)).toBe(false); }); });

import { subtotalCodeDiscount } from "../shared/discount";
describe("store-wide discount codes", () => {
  it("takes the % off the whole subtotal", () => expect(subtotalCodeDiscount(4000, 25)).toEqual({ ok: true, discountCents: 1000 }));
  it("rounds to whole cents", () => expect(subtotalCodeDiscount(1999, 10)).toEqual({ ok: true, discountCents: 200 }));
  it("empty cart gives no discount", () => expect(subtotalCodeDiscount(0, 10).ok).toBe(false));
});

import { generateCode, CODE_RE } from "../shared/discount";
describe("generated discount codes", () => { it("always match the allowed code format", () => { for (let i = 0; i < 50; i++) expect(CODE_RE.test(generateCode())).toBe(true); }); });
describe("SKU characters", () => {
  const SKU = /^[A-Za-z0-9_#*-]+$/;
  it("allows letters, numbers, # * _ -", () => { for (const s of ["CT-TOY-001", "#A1", "BEAR*2", "toy_9", "a#b*c_d"]) expect(SKU.test(s)).toBe(true); });
  it("rejects spaces and other symbols", () => { for (const s of ["a b", "a/b", "a.b", "a'b", "a%b"]) expect(SKU.test(s)).toBe(false); });
  it("image file names stay safe with # and *", () => { const n = safeFileName("#A*1_x", "webp", "abc123"); expect(n).toBe("a1x-abc123.webp"); });
});
