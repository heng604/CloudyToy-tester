import type { Settings } from "./types";
import type { Method } from "./delivery";
/** on = working, paused = stopped for now, soon = shown as "Coming soon". */
export type PayMode = "on" | "paused" | "soon";
export const PAY_MODES: PayMode[] = ["on", "paused", "soon"];
export const PAY_KEY = { BAKONG: "payBakong", QR_IMAGE: "payQr", COD: "payCod" } as const;
/** Reads the admin's choice. Old settings (missing, or true/false) still work: missing/true = on, false = paused. */
export function modeOf(s: Partial<Pick<Settings, "payBakong" | "payQr" | "payCod">>, m: Method): PayMode {
  const v: unknown = s[PAY_KEY[m]]; return v === "paused" || v === "soon" ? v : v === false ? "paused" : "on";
}
export const methodOn = (s: Partial<Pick<Settings, "payBakong" | "payQr" | "payCod">>, m: Method) => modeOf(s, m) === "on";
