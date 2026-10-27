import { describe, it, expect } from "vitest";
import { adminHtml, adminSubject, sendAdminEmail, fromAddress } from "../server/lib/email";
import type { StoredOrder } from "../shared/types";
const o: StoredOrder = { orderNumber: "CT-1", createdAt: "2026-10-18", area: "PHNOM_PENH", method: "COD", customer: { name: "<b>Sok</b>", email: "a@b.com", phone: "012", address: "Phnom Penh" },
  items: [{ productId: "1", sku: "CT-TOY-001", name: "Bear", qty: 2, unitCents: 1500, lineCents: 3000 }], subtotalCents: 3000, discountCents: 0, shippingCents: 150, totalCents: 3150, currency: "USD", paymentStatus: "PENDING", paymentReference: "PAY-CT-1", email: { status: "NONE", attempts: 0 } };
describe("admin email", () => {
  it("COD subject and note say pay with delivery", () => { expect(adminSubject(o)).toContain("PAY WITH DELIVERY"); expect(adminHtml(o)).toContain("collect <b>$31.50</b>"); });
  it("QR order is flagged NOT VERIFIED", () => { const q = { ...o, method: "QR_IMAGE" as const }; expect(adminSubject(q)).toContain("verify manually"); expect(adminHtml(q)).toContain("NOT VERIFIED"); });
  it("escapes customer HTML", () => { const h = adminHtml(o); expect(h).not.toContain("<b>Sok"); expect(h).toContain("&lt;b&gt;"); });
  it("uses the new owner design with the payment stamp", () => { const h = adminHtml(o); expect(h).toContain("New order received"); expect(h).toContain("ITEM"); expect(h).toContain("INV-1"); expect(h).toContain("PAY WITH DELIVERY"); expect(h).not.toContain("<img"); });
  it("never claims SENT without credentials", async () => { delete process.env.RESEND_API_KEY; expect((await sendAdminEmail(o)).status).toBe("SKIPPED"); });
  it("ignores gmail sender, keeps verified-domain sender", () => {
    expect(fromAddress("toyscloudy@gmail.com")).toContain("onboarding@resend.dev"); expect(fromAddress("")).toContain("onboarding@resend.dev"); expect(fromAddress(undefined)).toContain("onboarding@resend.dev");
    expect(fromAddress("Cloudy-Toy <orders@cloudytoy.com>")).toBe("Cloudy-Toy <orders@cloudytoy.com>");
  });
});
import { claimSubject, claimHtml, sendPaidClaimEmail, adminInbox } from "../server/lib/email";
describe("customer paid-claim email", () => {
  it("is clearly NOT VERIFIED and names order, total", () => { expect(claimSubject(o)).toContain("please verify"); const h = claimHtml(o); expect(h).toContain("NOT VERIFIED"); expect(h).toContain("$31.50"); expect(h).toContain("CT-1"); });
  it("escapes customer HTML", () => expect(claimHtml(o)).not.toContain("<b>Sok"));
  it("defaults to the admin account inbox", () => { delete process.env.ADMIN_NOTIFICATION_EMAIL; expect(adminInbox()).toBe("toyscloudy@gmail.com"); });
  it("never claims SENT without a Resend key", async () => { delete process.env.RESEND_API_KEY; expect((await sendPaidClaimEmail(o)).status).toBe("SKIPPED"); });
});

describe("admin inbox list", () => {
  it("accepts several comma separated admin emails", () => { process.env.ADMIN_NOTIFICATION_EMAIL = "a@x.com, b@y.com"; expect(adminInbox()).toContain("b@y.com"); delete process.env.ADMIN_NOTIFICATION_EMAIL; });
});

import { vi } from "vitest";
describe("sender fallback", () => {
  it("retries with the Resend test sender when the domain sender is rejected", async () => {
    process.env.RESEND_API_KEY = "re_test"; process.env.EMAIL_FROM = "Cloudy-Toy <orders@cloudytoys.com>";
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: { body: string }) => { const f = JSON.parse(init.body).from; calls.push(f); return f.includes("resend.dev") ? new Response("{}", { status: 200 }) : new Response("domain not verified", { status: 403 }); }));
    const r = await sendAdminEmail(o);
    expect(r.status).toBe("SENT"); expect(calls).toEqual(["Cloudy-Toy <orders@cloudytoys.com>", "Cloudy-Toy <onboarding@resend.dev>"]);
    vi.unstubAllGlobals(); delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM;
  });
});

describe("never throws", () => {
  it("returns FAILED (not an exception) when the network is down", async () => {
    process.env.RESEND_API_KEY = "re_test"; process.env.EMAIL_FROM = "Cloudy-Toy <orders@cloudytoys.com>";
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const r = await sendAdminEmail(o); expect(r.status).toBe("FAILED");
    vi.unstubAllGlobals(); delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM;
  });
  it("test sender: succeeds if at least one admin inbox is accepted", async () => {
    process.env.RESEND_API_KEY = "re_test"; process.env.EMAIL_FROM = "Cloudy-Toy <orders@cloudytoys.com>"; process.env.ADMIN_NOTIFICATION_EMAIL = "owner@x.com, other@y.com";
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: { body: string }) => { const b = JSON.parse(init.body); return b.from.includes("orders@cloudytoys.com") || b.to[0] === "other@y.com" ? new Response("no", { status: 403 }) : new Response("{}", { status: 200 }); }));
    const r = await sendAdminEmail(o); expect(r.status).toBe("SENT");
    vi.unstubAllGlobals(); delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM; delete process.env.ADMIN_NOTIFICATION_EMAIL;
  });
});

import { friendlyMailError } from "../server/lib/email";
describe("friendlyMailError", () => {
  it("explains the Resend test-mode 403", () => { const m = friendlyMailError('Resend HTTP 403: {"message":"You can only send testing emails to your own email address (toyscloudy@gmail.com)."}'); expect(m).toContain("test mode"); expect(m).toContain("resend.com/domains"); expect(m).not.toContain("HTTP 403"); });
  it("explains a bad key", () => { expect(friendlyMailError("Resend HTTP 401: x")).toContain("RESEND_API_KEY"); });
});
