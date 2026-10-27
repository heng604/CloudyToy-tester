import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { makeKhqr, checkPaid, bakongEnabled } from "../server/lib/bakong";
beforeEach(() => { process.env.BAKONG_ACCOUNT_ID = "shop@aba"; process.env.BAKONG_API_TOKEN = "tok"; });
afterEach(() => { vi.unstubAllGlobals(); });
const reply = (body: unknown, status = 200) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
describe("Bakong KHQR", () => {
  it("is enabled only with account + token", () => { expect(bakongEnabled()).toBe(true); process.env.BAKONG_API_TOKEN = ""; expect(bakongEnabled()).toBe(false); });
  it("builds a KHQR for the exact amount", async () => {
    const k = await makeKhqr("CT-261023-ABCDE", 1250);
    expect(k.qr).toContain("shop@aba"); expect(k.qr).toContain("5405" + "12.50"); expect(k.qr).toContain("CT-261023-ABCDE"); expect(k.md5).toMatch(/^[a-f0-9]{32}$/); expect(k.image).toMatch(/^data:image\/png/);
  });
  it("accepts only a matching payment", async () => {
    reply({ responseCode: 0, data: { hash: "h1", amount: 12.5, currency: "USD", toAccountId: "SHOP@aba" } });
    expect(await checkPaid("m", 1250)).toEqual({ ok: true, hash: "h1" });
  });
  it("rejects wrong amount, currency or account", async () => {
    reply({ responseCode: 0, data: { amount: 1, currency: "USD", toAccountId: "shop@aba" } }); expect((await checkPaid("m", 1250)).ok).toBe(false);
    reply({ responseCode: 0, data: { amount: 12.5, currency: "KHR", toAccountId: "shop@aba" } }); expect((await checkPaid("m", 1250)).ok).toBe(false);
    reply({ responseCode: 0, data: { amount: 12.5, currency: "USD", toAccountId: "other@aba" } }); expect((await checkPaid("m", 1250)).ok).toBe(false);
  });
  it("not found / network error => not paid", async () => {
    reply({ responseCode: 1, errorCode: 1, data: null }); expect(await checkPaid("m", 1250)).toEqual({ ok: false, reason: "NOT_FOUND" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("blocked"); })); expect((await checkPaid("m", 1250)).ok).toBe(false);
  });
});
