// Report for Google Sheets: the SAME template as the PDF report (header band with logo + shop name + report title, intro, four summary boxes,
// sky-blue table header with soft stripes, footer with logo, contact and copyright), as an HTML table the browser copies to the clipboard.
// Pasting it into a Google Sheet (cell A1) keeps the colours, bold text, merged cells, column widths and real numbers (phone numbers keep their leading zero).
import { COPYRIGHT, type ReportMeta } from "./report";
import { kindOf } from "./xlsx";
const INK = "#2F4156", BLUE = "#1F4E9C", MUTE = "#64748B", SKY = "#8ECCFF", PALE = "#EAF5FF", ZEBRA = "#F6FAFF", LINE = "#D8EAFE";
const h = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (v: unknown): number => { const t = String(v ?? "").replace(/[$,\s]/g, ""); return t === "" || t === "-" ? NaN : Number(t); };
type Td = { text?: string; style?: string; span?: number; rows?: number; str?: string; n?: number; fmt?: string; formula?: string };
const WHITE = "background-color:#ffffff;";
const td = (c0: Td) => { const c = { ...c0, style: "padding:0 6px;" + (/background-color/.test(c0.style ?? "") ? c0.style : WHITE + (c0.style ?? "")) }; return `<td${c.span && c.span > 1 ? ` colspan="${c.span}"` : ""}${c.rows && c.rows > 1 ? ` rowspan="${c.rows}"` : ""} style="${c.style ?? ""}"${c.formula ? ` data-sheets-value="${h(JSON.stringify({ 1: 2, 2: "" }))}" data-sheets-formula="${h(c.formula)}"` : c.str !== undefined ? ` data-sheets-value="${h(JSON.stringify({ 1: 2, 2: c.str }))}"` : ""}${c.n !== undefined ? ` data-sheets-value="${h(JSON.stringify({ 1: 3, 3: c.n }))}"${c.fmt ? ` data-sheets-numberformat="${h(JSON.stringify({ 1: 2, 2: c.fmt, 3: 1 }))}"` : ""}` : ""}>${h(c.text)}</td>`; };
export type SheetCol = { header: string; chars?: number; right?: boolean };
/** `logoUrl` (public https address of the logo) makes the logo appear in the header and footer; without it only the shop name shows. */
export function buildSheetHtml(o: { title: string; cols: SheetCol[]; rows: string[][]; meta: ReportMeta; logoUrl?: string }): { html: string; text: string } {
  const { meta } = o, N = o.cols.length, kinds = o.cols.map((c) => kindOf(c.header));
  const total = o.cols.reduce((s, c) => s + (c.chars ?? 12), 0), trs: string[] = [];
  const px = o.cols.map((c) => Math.max(48, Math.round(((c.chars ?? 12) / total) * 960))), pxTotal = px.reduce((a, b) => a + b, 0);
  let k = 1, wk = px[N - 1]; while (k < N - 2 && wk < 290) { k++; wk += px[N - k]; } // title / copyright block: wide enough that the copyright never wraps
  k = Math.max(1, Math.min(Math.max(k, 2), N - 2)); const left = Math.max(1, N - 1 - k); // logo column | name columns | title columns
  const logo = (size: number) => (o.logoUrl ? { formula: `=IMAGE("${o.logoUrl}",4,${size},${size})` } : { text: "CT" }); // no public logo address (e.g. localhost): small "CT" badge, like the PDF
  const badge = (size: number) => (o.logoUrl ? "" : `color:${BLUE};font-weight:bold;font-size:${size > 40 ? 18 : 11}pt;`);
  const row = (ht: number, cells: string, bg = "") => trs.push(`<tr style="height:${ht}px${bg ? `;background-color:${bg}` : ""}">${cells}</tr>`);
  const fill = (cells: string) => cells; // (rows keep their own cell backgrounds)
  const band = `background-color:${PALE};`;
  // header: logo | shop name + tagline | report title + date / row count
  row(40, td({ rows: 2, style: `${band}${badge(56)}vertical-align:middle;text-align:center`, ...logo(56) }) + td({ text: meta.brand, span: left, style: `${band}color:${BLUE};font-size:22pt;font-weight:bold;vertical-align:bottom` }) + td({ text: o.title, span: k, style: `${band}color:${INK};font-size:16pt;font-weight:bold;text-align:right;vertical-align:bottom;white-space:nowrap` }));
  row(26, td({ text: meta.tagline, span: left, style: `${band}color:${MUTE};font-size:9pt;vertical-align:top` }) + td({ text: `Made on ${meta.generated}  -  ${o.rows.length} ${o.rows.length === 1 ? "row" : "rows"}`, span: k, style: `${band}color:${MUTE};font-size:9pt;text-align:right;vertical-align:top` }));
  row(4, td({ text: "", span: N, style: `background-color:${SKY}` }));
  row(14, td({ text: "", span: N }));
  if (meta.intro) { row(22, td({ text: meta.intro, span: N, style: `color:${INK};font-size:10.5pt;vertical-align:middle` })); row(10, td({ text: "", span: N })); }
  const items = (meta.summary ?? []).slice(0, 4);
  if (items.length) {
    const spans: number[] = []; { let prev = 0; items.forEach((_, i) => { if (i === items.length - 1) { spans.push(N - prev); return; } const want = (pxTotal * (i + 1)) / items.length; let best = prev + 1, bd = Infinity, acc = 0; px.forEach((w, j) => { acc += w; if (j + 1 > prev && j + 1 <= N - (items.length - 1 - i)) { const d = Math.abs(acc - want); if (d < bd) { bd = d; best = j + 1; } } }); spans.push(best - prev); prev = best; }); } // four boxes of about the same width, like the PDF
    const box = `${band}border-left:3px solid ${SKY};border-right:3px solid #ffffff;`;
    const line = (ht: number, pick: (i: [string, string], n: number) => Td) => row(ht, items.map((it, n) => td({ ...pick(it, n), span: spans[n] })).join(""));
    line(20, ([l]) => ({ text: l, style: `${box}color:${MUTE};font-size:8.5pt;vertical-align:bottom;padding-left:10px` }));
    line(26, ([, v]) => ({ text: v, style: `${box}color:${BLUE};font-size:14pt;font-weight:bold;vertical-align:top;padding-left:10px` }));
    row(12, td({ text: "", span: N }));
  }
  // table: sky-blue header, soft stripes
  row(24, o.cols.map((c, i) => td({ text: c.header, style: `background-color:${SKY};color:${INK};font-size:9pt;font-weight:bold;vertical-align:middle;text-align:${c.right ? "right" : "left"}` })).join(""));
  o.rows.forEach((r, ri) => row(20, o.cols.map((c, i) => { const v = String(r[i] ?? ""), n = num(v), style = `${ri % 2 === 0 ? `background-color:${ZEBRA};` : ""}color:${INK};font-size:9pt;vertical-align:middle;text-align:${c.right ? "right" : "left"};${ri === o.rows.length - 1 ? `border-bottom:1px solid ${LINE};` : ""}`;
    if (kinds[i] === "usd" && Number.isFinite(n)) return td({ text: v, n, fmt: '"$"#,##0.00_)', style });
    if (kinds[i] === "int" && Number.isFinite(n)) return td({ text: v, n, fmt: "#,##0_)", style });
    return td({ text: v, str: kinds[i] === "text" ? v : undefined, style }); }).join("")));
  // footer: sky line, then logo | shop name + contact | copyright
  row(14, td({ text: "", span: N }));
  row(3, td({ text: "", span: N, style: `background-color:${SKY}` }));
  row(22, td({ rows: 2, style: `${badge(34)}vertical-align:middle;text-align:center`, ...logo(34) }) + td({ text: meta.brand, span: left, style: `color:${BLUE};font-size:10.5pt;font-weight:bold;vertical-align:bottom` }) + td({ text: COPYRIGHT(meta.year), span: k, style: `color:${INK};font-size:8.5pt;text-align:right;vertical-align:bottom;white-space:nowrap` }));
  row(20, td({ text: meta.contacts.length ? meta.contacts.join("   |   ") : "Thank you for shopping with us", span: left + k, style: `color:${MUTE};font-size:8pt;vertical-align:top` }));
  const cols = o.cols.map((c) => `<col width="${Math.max(48, Math.round(((c.chars ?? 12) / total) * 960))}"/>`).join("");
  const html = `<google-sheets-html-origin><style type="text/css"><!--td {border: none;}--></style><table xmlns="http://www.w3.org/1999/xhtml" cellspacing="0" cellpadding="0" dir="ltr" border="0" style="table-layout:fixed;font-size:10pt;font-family:Arial;border-collapse:collapse;border:none"><colgroup>${cols}</colgroup><tbody>${fill(trs.join(""))}</tbody></table></google-sheets-html-origin>`;
  const tab = (a: string[]) => a.map((x) => String(x ?? "").replace(/[\t\r\n]+/g, " ")).join("\t");
  const text = [o.title, meta.intro ?? "", "", tab(o.cols.map((c) => c.header)), ...o.rows.map(tab)].join("\n");
  return { html, text };
}
