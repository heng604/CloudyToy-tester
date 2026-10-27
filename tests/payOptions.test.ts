import { describe, it, expect } from "vitest";
import { methodOn, modeOf } from "../shared/payOptions";
import { DEFAULT_SETTINGS } from "../shared/types";
describe("payment option switches", () => {
  it("all on by default, including old saved settings without the flags", () => { for (const m of ["BAKONG", "QR_IMAGE", "COD"] as const) { expect(methodOn(DEFAULT_SETTINGS, m)).toBe(true); expect(methodOn({} as never, m)).toBe(true); } });
  it("three modes; old true/false values still work", () => { const s = { payBakong: "soon", payQr: false, payCod: true } as never; expect(modeOf(s, "BAKONG")).toBe("soon"); expect(modeOf(s, "QR_IMAGE")).toBe("paused"); expect(modeOf(s, "COD")).toBe("on"); expect(methodOn(s, "BAKONG")).toBe(false); });
  it("turning one off only affects that option", () => { const s = { ...DEFAULT_SETTINGS, payBakong: "paused" as const }; expect(methodOn(s, "BAKONG")).toBe(false); expect(methodOn(s, "QR_IMAGE")).toBe(true); expect(methodOn(s, "COD")).toBe(true); });
});
