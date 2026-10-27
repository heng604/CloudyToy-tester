import { describe, it, expect } from "vitest";
import { ProfileInput } from "../shared/profile";
describe("profile input", () => {
  it("accepts name and phone", () => expect(ProfileInput.safeParse({ display_name: " Sok ", phone: "+855 12 345 678" }).success).toBe(true));
  it("rejects letters in phone and long names", () => { expect(ProfileInput.safeParse({ display_name: "a", phone: "abc" }).success).toBe(false); expect(ProfileInput.safeParse({ display_name: "x".repeat(81), phone: "" }).success).toBe(false); });
  it("drops privileged fields like role", () => expect(Object.keys(ProfileInput.parse({ display_name: "a", phone: "1", role: "admin" } as never))).toEqual(["display_name", "phone"]));
});
