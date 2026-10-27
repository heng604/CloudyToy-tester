// Shared look of the Excel and PDF reports: the header (logo + shop name), the footer (logo, contact, copyright) and the friendly intro.
import { publicFile } from "./assets";
import { join } from "node:path";
import { INVOICE_LOGO, BRAND } from "../../shared/invoice";
export type Logo = { jpeg: Buffer; w: number; h: number; comps: number };
export type ReportMeta = { brand: string; tagline: string; contacts: string[]; logo: Logo | null; generated: string; year: number; intro?: string; summary?: [string, string][] };
export const COPYRIGHT = (year: number) => `\u00A9 ${year} Cloudy Toys. All rights reserved.`;
/** Reads width / height / colour components from a JPEG (null if it is not a baseline or progressive JPEG). */
export function jpegInfo(b: Buffer): Logo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { jpeg: b, h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), comps: b[i + 9] };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}
let cached: Logo | null | undefined;
/** The same logo file the invoice and the e-mails use (public/img/invoice-logo.jpg). null when it cannot be read: reports then draw a small "CT" badge instead. */
export function loadLogo(): Logo | null {
  if (cached === undefined) { try { const f = publicFile(INVOICE_LOGO); const l = f && jpegInfo(f); cached = l && (l.comps === 3 || l.comps === 1) ? l : null; } catch { cached = null; } }
  return cached;
}
/** "Telegram: t.me/x" style lines for every link the admin has set (Telegram, Facebook, Instagram). */
export function contactsOf(s: { telegramUrl?: string; facebookUrl?: string; instagramUrl?: string }): string[] {
  const bare = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return [s.telegramUrl && `Telegram: ${bare(s.telegramUrl)}`, s.instagramUrl && `Instagram: ${bare(s.instagramUrl)}`, s.facebookUrl && `Facebook: ${bare(s.facebookUrl)}`].filter(Boolean) as string[];
}
export const makeMeta = (s: { telegramUrl?: string; facebookUrl?: string; instagramUrl?: string }, generated: string, extra: Pick<ReportMeta, "intro" | "summary"> = {}): ReportMeta =>
  ({ brand: BRAND.name, tagline: BRAND.tagline, contacts: contactsOf(s), logo: loadLogo(), generated, year: Number(generated.slice(0, 4)) || new Date().getFullYear(), ...extra });
