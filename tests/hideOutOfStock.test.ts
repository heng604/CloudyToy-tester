import { describe, it, expect } from "vitest";
import { isListed, isShopVisible, HIDE_AFTER_MS } from "../shared/products";
const now = Date.parse("2026-10-23T12:00:00Z"); const ago = (ms: number) => new Date(now - ms).toISOString();
describe("hide products out of stock for 2 days", () => {
  it("in stock => always shown", () => { expect(isListed({ stock: 5, outOfStockAt: ago(9 * HIDE_AFTER_MS) }, now)).toBe(true); });
  it("out of stock < 2 days => shown (with the Out of stock label)", () => { expect(isListed({ stock: 0, outOfStockAt: ago(HIDE_AFTER_MS - 1000) }, now)).toBe(true); });
  it("out of stock >= 2 days => hidden", () => { expect(isListed({ stock: 0, outOfStockAt: ago(HIDE_AFTER_MS) }, now)).toBe(false); });
  it("restocked => shown again", () => { expect(isListed({ stock: 3 }, now)).toBe(true); });
  it("no timestamp yet (migration not run) => shown", () => { expect(isListed({ stock: 0 }, now)).toBe(true); });
});
describe("pre-order deadline hides the product from the shop only", () => {
  const w = { stock: 5, labels: ["preorder" as const], preorderStart: "2026-11-01", preorderEnd: "2026-11-15" }, at = (d: string) => Date.parse(`${d}T05:00:00Z`);
  it("shown before and on the deadline day, hidden after", () => {
    expect(isShopVisible(w, at("2026-11-15"))).toBe(true); expect(isShopVisible(w, at("2026-11-16"))).toBe(false);
  });
  it("normal products and pre-orders without dates are never hidden by this rule", () => {
    expect(isShopVisible({ stock: 5 }, at("2030-01-01"))).toBe(true); expect(isShopVisible({ stock: 5, labels: ["preorder"] }, at("2030-01-01"))).toBe(true);
  });
});
