import { describe, it, expect } from "vitest";
import { isAdminEmail, ADMIN_EMAIL } from "../shared/admin";
import { toCsv } from "../shared/csv";
import { buildPdf } from "../server/lib/pdf";
import { filterOrders, sortOrders, summarize, dailyRevenue, dayKey } from "../shared/stats";
import { stockStatus } from "../shared/products";
import type { StoredOrder } from "../shared/types";

const mk = (n: string, total: number, status: "PENDING" | "PAID", createdAt: string): StoredOrder => ({ orderNumber: n, createdAt, area: "PHNOM_PENH", method: "QR_IMAGE",
  customer: { name: "A", email: "a@b.c", phone: "012345", address: "street" }, items: [{ productId: "1", sku: "S", name: "Toy", qty: 1, unitCents: total, lineCents: total }],
  subtotalCents: total, discountCents: 0, shippingCents: 0, totalCents: total, currency: "USD", paymentStatus: status, paymentReference: "R", email: { status: "NONE", attempts: 0 } });
const orders = [mk("A", 500, "PAID", "2026-10-17T10:00:00Z"), mk("B", 2500, "PENDING", "2026-10-18T10:00:00Z"), mk("C", 1200, "PAID", "2026-10-18T11:00:00Z")];

describe("admin is only the two allowlisted emails", () => {
  it("accepts it (any case) when verified", () => { expect(ADMIN_EMAIL).toBe("toyscloudy@gmail.com"); expect(isAdminEmail("ToysCloudy@Gmail.com", true)).toBe(true); });
  it("rejects unverified and every other email", () => { expect(isAdminEmail("toyscloudy@gmail.com", false)).toBe(false); expect(isAdminEmail("other@gmail.com", true)).toBe(false); expect(isAdminEmail("Seangheng2006@gmail.com", true)).toBe(true); expect(isAdminEmail("seangheng2006@gmail.com", false)).toBe(false); expect(isAdminEmail("toyscloudy@gmail.com.evil.com", true)).toBe(false); });
});
describe("csv", () => {
  it("quotes, escapes and neutralises formulas", () => {
    const out = toCsv([{ a: 'he said "hi", ok', b: "=HYPERLINK(1)" }], [{ header: "A", get: (r) => r.a }, { header: "B", get: (r) => r.b }]);
    expect(out).toContain('"he said ""hi"", ok"'); expect(out).toContain(`"'=HYPERLINK(1)"`); expect(out.startsWith("\uFEFF")).toBe(true);
  });
});
describe("pdf", () => {
  it("builds a valid multi-page PDF and survives Khmer / parentheses", () => {
    const rows = Array.from({ length: 100 }, (_, i) => [`Row (${i})`, "ឈ្មោះ"]);
    const s = buildPdf({ title: "T", cols: [{ header: "A", chars: 20 }, { header: "B", chars: 10 }], rows }).toString("latin1");
    expect(s.startsWith("%PDF-1.4")).toBe(true); expect(s.trimEnd().endsWith("%%EOF")).toBe(true); expect(s).toContain("/Count 3"); expect(s).toContain("Page 3 of 3");
  });
  it("builds an empty report", () => expect(buildPdf({ title: "T", cols: [{ header: "A", chars: 5 }], rows: [] }).length).toBeGreaterThan(200));
});
describe("transaction stats", () => {
  it("sorts low and high", () => { expect(sortOrders(orders, "low").map((o) => o.orderNumber)).toEqual(["A", "C", "B"]); expect(sortOrders(orders, "high")[0].orderNumber).toBe("B"); });
  it("filters by status and by Phnom Penh date", () => {
    expect(filterOrders(orders, { status: "PAID" })).toHaveLength(2);
    expect(filterOrders(orders, { from: "2026-10-18", to: "2026-10-18" })).toHaveLength(2);
    expect(dayKey("2026-10-17T20:00:00Z")).toBe("2026-10-18"); // 03:00 next day in Cambodia
  });
  it("summarises: only PAID counts as revenue", () => { const s = summarize(orders); expect(s.paidCents).toBe(1700); expect(s.pendingCents).toBe(2500); expect(s.minCents).toBe(500); expect(s.maxCents).toBe(2500); });
  it("daily revenue covers 14 days", () => { const d = dailyRevenue(orders, 14, Date.parse("2026-10-18T12:00:00Z")); expect(d).toHaveLength(14); expect(d[13].cents).toBe(1200); expect(d[12].cents).toBe(500); });
});
describe("stock levels", () => { it("OUT / LOW / OK", () => { expect(stockStatus(0)).toBe("OUT"); expect(stockStatus(5)).toBe("LOW"); expect(stockStatus(6)).toBe("OK"); }); });
