import { describe, it, expect } from "vitest";
import { contactLines } from "../shared/invoice";
import { RECEIPT_MM } from "../src/components/Receipt";
describe("thermal receipt", () => {
  it("prints inside the roll: 58 mm paper -> 48 mm, 80 mm paper -> 72 mm", () => { expect(RECEIPT_MM["58"]).toBe(48); expect(RECEIPT_MM["80"]).toBe(72); });
  it("contact lines drop the protocol and skip empty links", () => { expect(contactLines({ telegramUrl: "https://t.me/x", facebookUrl: "" })).toEqual(["Telegram: t.me/x"]); expect(contactLines({})).toEqual([]); });
});
