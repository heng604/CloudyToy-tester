import { describe, it, expect } from "vitest";
import { autoDiscounts, autoTotal, checkCampaign, checkPreorder, normalizePromotions, preorderSplit, DEFAULT_PREORDER, type Campaign } from "../shared/promotions";
import { can, initialsOf } from "../shared/roles";
import { payNowCents } from "../shared/orders";
import { toProduct, nameFor, isPreorder } from "../shared/products";

const spend: Campaign = { id: "a", name: "Spend & Save", kind: "spend_amount", minSpendCents: 2000, amountCents: 500, percent: 0, category: "", active: true, createdAt: "" };
const plush: Campaign = { id: "b", name: "15% Off Plushies", kind: "category_percent", minSpendCents: 0, amountCents: 0, percent: 15, category: "Plushies", active: true, createdAt: "" };

describe("automatic discounts", () => {
  it("stacks matching campaigns", () => {
    const d = autoDiscounts([{ category: "plushies", lineCents: 1500 }, { category: "Other", lineCents: 1000 }], [spend, plush]);
    expect(d.map((x) => x.cents)).toEqual([500, 225]); expect(autoTotal(d)).toBe(725);
  });
  it("needs the minimum spend", () => expect(autoDiscounts([{ category: "Other", lineCents: 1000 }], [spend])).toEqual([]));
  it("never takes off more than the subtotal", () => expect(autoDiscounts([{ category: "x", lineCents: 100 }], [{ ...spend, minSpendCents: 0 }])[0].cents).toBe(100));
  it("ignores paused campaigns", () => expect(autoDiscounts([{ category: "x", lineCents: 5000 }], [{ ...spend, active: false }])).toEqual([]));
});
describe("promotion forms", () => {
  it("validates pre-order rules", () => {
    expect(checkPreorder({ depositPercent: 50, dispatchText: "10 - 14 Business Days", capSlots: 50 }).ok).toBe(true);
    expect(checkPreorder({ depositPercent: 0, dispatchText: "ok text", capSlots: 5 }).ok).toBe(false);
    expect(checkPreorder({ depositPercent: 101, dispatchText: "ok text", capSlots: 5 }).ok).toBe(false);
  });
  it("validates campaigns and converts dollars to cents", () => {
    expect(checkCampaign({ name: "ab", kind: "spend_amount", minSpend: 20, amount: 25 }).ok).toBe(false);
    expect(checkCampaign({ name: "Plush", kind: "category_percent", percent: 15, category: "" }).ok).toBe(false);
    const c = checkCampaign({ name: "Spend & Save", kind: "spend_amount", minSpend: 20, amount: 5 });
    expect(c.ok && c.value).toMatchObject({ minSpendCents: 2000, amountCents: 500 });
  });
  it("repairs stored data", () => {
    const n = normalizePromotions({ preorder: { depositPercent: 30 }, campaigns: [spend, { id: "z", kind: "bad" }] });
    expect(n.preorder).toMatchObject({ depositPercent: 30, capSlots: 50 }); expect(n.campaigns).toHaveLength(1);
    expect(normalizePromotions(null).preorder).toEqual(DEFAULT_PREORDER);
  });
});
describe("pre-order deposit", () => {
  it("rounds the deposit up and keeps the balance", () => { const s = preorderSplit(1001, { ...DEFAULT_PREORDER, depositPercent: 50 }); expect(s.depositCents).toBe(501); expect(s.balanceCents).toBe(500); });
  it("customers pay the deposit now, others the full total", () => { expect(payNowCents({ totalCents: 1000 })).toBe(1000); expect(payNowCents({ totalCents: 1000, preorder: { depositCents: 300 } })).toBe(300); });
});
describe("roles", () => {
  it("limits what each role can do", () => {
    expect(can("owner", "staff")).toBe(true); expect(can("admin", "staff")).toBe(false); expect(can("admin", "orders")).toBe(true);
    expect(can("editor", "products")).toBe(true); expect(can("editor", "orders")).toBe(false); expect(can(null, "products")).toBe(false);
  });
  it("makes initials", () => { expect(initialsOf("Yihor Theng")).toBe("YT"); expect(initialsOf("", "sokha@x.com")).toBe("S"); });
});
describe("product fields", () => {
  it("maps Khmer name and keeps only known labels", () => {
    const p = toProduct({ id: "1", slug: "s", name: "Bunny", sku: "K", price: "3", sale_price: null, stock: 2, created_at: "", category: "C", description: null, images: null, active: true, name_km: "ទន្សាយ", labels: ["preorder", "bogus"] });
    expect(p.labels).toEqual(["preorder"]); expect(isPreorder(p)).toBe(true); expect(nameFor(p, "km")).toBe("ទន្សាយ"); expect(nameFor(p, "en")).toBe("Bunny");
  });
});
