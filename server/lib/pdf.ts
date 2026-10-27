// Dependency-free PDF report writer (A4 landscape, Helvetica). Branded header (logo + shop name) and footer (logo, contact, copyright, page number) on every page.
// Latin-1 text only: other characters (e.g. Khmer) print as "?". Use CSV or Excel for full Unicode.
import { COPYRIGHT, type ReportMeta } from "./report";
export type PdfCol = { header: string; chars: number; right?: boolean };
const W = 842, H = 595, M = 30, HEAD_H = 70, FOOT_H = 50, ROW = 16, TH = 20;
const INK = "0.184 0.255 0.337", BLUE = "0.122 0.306 0.612", SKY = "0.557 0.800 1", PALE = "0.918 0.961 1", ZEBRA = "0.965 0.980 1", LINE = "0.847 0.918 0.996", MUTE = "0.392 0.455 0.545";
const clean = (s: string) => s.replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
const esc = (s: string) => clean(s).replace(/[\\()]/g, (c) => "\\" + c).replace(/[\x80-\xff]/g, (c) => "\\" + c.charCodeAt(0).toString(8).padStart(3, "0"));
// Helvetica advance widths (1/1000 em) for ASCII 32..126, used to align and trim text.
const HW = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const tw = (s: string, size: number, bold = false) => { let n = 0; for (const ch of clean(s)) { const c = ch.charCodeAt(0); n += c >= 32 && c <= 126 ? HW[c - 32] : 556; } return (n / 1000) * size * (bold ? 1.07 : 1); };
const fit = (s: string, max: number, size: number, bold = false) => { let t = clean(s); if (tw(t, size, bold) <= max) return t; while (t.length > 1 && tw(t + "..", size, bold) > max) t = t.slice(0, -1); return t + ".."; };
const T = (x: number, y: number, s: string, size: number, font: "F1" | "F2", color = INK, right = false) => `BT /${font} ${size} Tf ${color} rg ${(right ? x - tw(s, size, font === "F2") : x).toFixed(2)} ${y.toFixed(2)} Td (${esc(s)}) Tj ET\n`;
const R = (x: number, y: number, w: number, h: number, fill: string) => `${fill} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f\n`;
const L = (x1: number, y: number, x2: number, color: string, w = 0.6) => `${color} RG ${w} w ${x1} ${y} m ${x2} ${y} l S\n`;
/** Logo (or a "CT" badge when there is no logo file) drawn size x size at x,y. */
const mark = (x: number, y: number, size: number, hasLogo: boolean) => hasLogo ? `q ${size} 0 0 ${size} ${x} ${y} cm /Im1 Do Q\n` : R(x, y, size, size, SKY) + T(x + size / 2 - tw("CT", size * 0.42, true) / 2, y + size * 0.3, "CT", size * 0.42, "F2", BLUE);
export function buildPdf(o: { title: string; cols: PdfCol[]; rows: string[][]; meta: ReportMeta }): Buffer {
  const { meta } = o, logo = meta.logo, usable = W - 2 * M, totalChars = o.cols.reduce((s, c) => s + c.chars, 0);
  const xs: number[] = []; const ws = o.cols.map((c) => (c.chars / totalChars) * usable); ws.reduce((x, w) => (xs.push(x), x + w), M);
  const hasSummary = !!(meta.intro || meta.summary?.length), firstTop = hasSummary ? H - HEAD_H - 92 : H - HEAD_H - 16, nextTop = H - HEAD_H - 16;
  const cap = (top: number) => Math.max(1, Math.floor((top - TH - FOOT_H - 6) / ROW));
  const pages: string[][][] = []; let at = 0;
  do { const n = cap(pages.length === 0 ? firstTop : nextTop); pages.push(o.rows.slice(at, at + n)); at += n; } while (at < o.rows.length);
  const bufs: Buffer[] = []; const add = (b: string | Buffer) => { bufs.push(typeof b === "string" ? Buffer.from(b, "latin1") : b); return bufs.length; };
  add("<< /Type /Catalog /Pages 2 0 R >>"); add("PAGES");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  let img = 0;
  if (logo) img = add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} /ColorSpace /${logo.comps === 1 ? "DeviceGray" : "DeviceRGB"} /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.jpeg.length} >>\nstream\n`, "latin1"), logo.jpeg, Buffer.from("\nendstream", "latin1")]));
  const kids: number[] = [];
  pages.forEach((rows, pi) => {
    const top = pi === 0 ? firstTop : nextTop; let c = "";
    // header: soft blue band with the logo, the shop name, and the report title on the right
    c += R(0, H - HEAD_H, W, HEAD_H, PALE) + R(0, H - HEAD_H - 3, W, 3, SKY);
    c += mark(M, H - HEAD_H + 12, 46, !!logo);
    c += T(M + 58, H - 39, meta.brand, 22, "F2", BLUE) + T(M + 58, H - 55, meta.tagline, 9, "F1", MUTE);
    c += T(W - M, H - 36, o.title, 16, "F2", INK, true) + T(W - M, H - 52, `Made on ${meta.generated}  -  ${o.rows.length} ${o.rows.length === 1 ? "row" : "rows"}`, 8.5, "F1", MUTE, true);
    if (pi === 0 && hasSummary) {
      let y = H - HEAD_H - 28;
      if (meta.intro) c += T(M, y, meta.intro, 10.5, "F1", INK), y -= 14;
      const gap = 10, box = (usable - 3 * gap) / 4;
      (meta.summary ?? []).slice(0, 4).forEach(([label, value], i) => { const x = M + i * (box + gap), by = H - HEAD_H - 88;
        c += R(x, by, box, 40, PALE) + R(x, by, 4, 40, SKY) + T(x + 14, by + 25, fit(label, box - 22, 8), 8, "F1", MUTE) + T(x + 14, by + 9, fit(value, box - 22, 14, true), 14, "F2", BLUE); });
    }
    // table
    const hy = top - TH;
    c += R(M, hy, usable, TH, SKY);
    o.cols.forEach((col, i) => { const s = fit(col.header, ws[i] - 12, 8.5, true); c += T(col.right ? xs[i] + ws[i] - 6 : xs[i] + 6, hy + 6.5, s, 8.5, "F2", INK, !!col.right); });
    rows.forEach((r, ri) => { const y = hy - (ri + 1) * ROW; if (ri % 2 === 0) c += R(M, y, usable, ROW, ZEBRA);
      r.forEach((cell, i) => { const s = fit(cell, ws[i] - 12, 8.5); c += T(o.cols[i].right ? xs[i] + ws[i] - 6 : xs[i] + 6, y + 4.8, s, 8.5, "F1", INK, !!o.cols[i].right); }); });
    const endY = hy - rows.length * ROW; c += L(M, endY, W - M, LINE, 0.8);
    // footer: logo + name + contact on the left, copyright and page number on the right
    c += L(M, FOOT_H - 4, W - M, SKY, 1.2) + mark(M, 12, 28, !!logo);
    c += T(M + 38, 28, meta.brand, 10.5, "F2", BLUE) + T(M + 38, 15, fit(meta.contacts.length ? meta.contacts.join("   |   ") : "Thank you for shopping with us", usable * 0.55, 8), 8, "F1", MUTE);
    c += T(W - M, 28, COPYRIGHT(meta.year), 8.5, "F1", INK, true) + T(W - M, 15, `Page ${pi + 1} of ${pages.length}`, 8, "F1", MUTE, true);
    const body = Buffer.from(c, "latin1"); const content = add(Buffer.concat([Buffer.from(`<< /Length ${body.length} >>\nstream\n`, "latin1"), body, Buffer.from("endstream", "latin1")]));
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${img ? ` /XObject << /Im1 ${img} 0 R >>` : ""} >> /Contents ${content} 0 R >>`));
  });
  bufs[1] = Buffer.from(`<< /Type /Pages /Count ${kids.length} /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] >>`, "latin1");
  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")]; const offsets: number[] = []; let pos = parts[0].length;
  bufs.forEach((b, i) => { offsets.push(pos); const p = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, "latin1"), b, Buffer.from("\nendobj\n", "latin1")]); parts.push(p); pos += p.length; });
  parts.push(Buffer.from(`xref\n0 ${bufs.length + 1}\n0000000000 65535 f \n` + offsets.map((x) => `${String(x).padStart(10, "0")} 00000 n \n`).join("") + `trailer\n<< /Size ${bufs.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF`, "latin1"));
  return Buffer.concat(parts);
}
