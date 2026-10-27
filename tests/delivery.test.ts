import { describe, it, expect } from "vitest";
import { shippingFor, methodAllowed } from "../shared/delivery";
const s = { shipPhnomPenhCents: 150, shipProvinceCents: 200 };
describe("delivery rules", () => {
  it("Phnom Penh $1.50, Province $2.00", () => { expect(shippingFor("PHNOM_PENH", s)).toBe(150); expect(shippingFor("PROVINCE", s)).toBe(200); });
  it("uses admin-changed fees", () => expect(shippingFor("PROVINCE", { ...s, shipProvinceCents: 350 })).toBe(350));
  it("pay-with-delivery only in Phnom Penh; QR anywhere", () => { expect(methodAllowed("COD", "PHNOM_PENH")).toBe(true); expect(methodAllowed("COD", "PROVINCE")).toBe(false); expect(methodAllowed("QR_IMAGE", "PROVINCE")).toBe(true); });
});
