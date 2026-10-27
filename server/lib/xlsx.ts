// Dependency-free Excel (.xlsx) report writer. Same look as the PDF: logo + shop name on top, a friendly intro and summary, an easy-to-read table
// (coloured header, soft stripes, filters, frozen header row, totals) and a footer with logo, contact and copyright. Also sets the print header / footer.
import { deflateRawSync } from "node:zlib";
import { COPYRIGHT, type ReportMeta } from "./report";
export type XlsxCol = { header: string };
type Cell = string | number;
const INK = "2F4156", BLUE = "1F4E9C", MUTE = "64748B", SKY = "8ECCFF", PALE = "EAF5FF", ZEBRA = "F6FAFF", LINE = "D8EAFE";
const esc = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (n: number) => { let s = ""; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
// ---- styles (indexes are used below) ----
const S = { brand: 1, tag: 2, title: 3, band: 4, accent: 5, intro: 6, sumLabel: 7, sumValue: 8, head: 9, text: 10, textZ: 11, int: 12, intZ: 13, usd: 14, usdZ: 15, totLabel: 16, totInt: 17, totUsd: 18, fBrand: 19, fSmall: 20, blank: 21 } as const;
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="#,##0"/></numFmts>
<fonts count="11"><font><sz val="11"/><color rgb="FF${INK}"/><name val="Calibri"/></font>
<font><b/><sz val="22"/><color rgb="FF${BLUE}"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF${MUTE}"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><color rgb="FF${INK}"/><name val="Calibri"/></font><font><i/><sz val="11"/><color rgb="FF${INK}"/><name val="Calibri"/></font>
<font><sz val="9"/><color rgb="FF${MUTE}"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF${BLUE}"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF${INK}"/><name val="Calibri"/></font><font><b/><sz val="12"/><color rgb="FF${BLUE}"/><name val="Calibri"/></font>
<font><sz val="9"/><color rgb="FF${MUTE}"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF${INK}"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF${PALE}"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${SKY}"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF${ZEBRA}"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="4"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF${LINE}"/></bottom><diagonal/></border>
<border><left/><right/><top/><bottom style="medium"><color rgb="FF${BLUE}"/></bottom><diagonal/></border><border><left/><right/><top style="medium"><color rgb="FF${SKY}"/></top><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="22"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="5" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="bottom" indent="1"/></xf>
<xf numFmtId="0" fontId="6" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
<xf numFmtId="0" fontId="7" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf>
<xf numFmtId="165" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf>
<xf numFmtId="0" fontId="10" fillId="2" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="165" fontId="10" fillId="2" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf>
<xf numFmtId="164" fontId="10" fillId="2" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf>
<xf numFmtId="0" fontId="8" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="9" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
// ---- zip (store / deflate) ----
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files: { name: string; data: Buffer; store?: boolean }[]): Buffer {
  const out: Buffer[] = [], central: Buffer[] = []; let pos = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8"), raw = f.data, comp = f.store ? raw : deflateRawSync(raw), crc = crc32(raw), method = f.store ? 0 : 8;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(method, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(method, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(pos, 42);
    out.push(lh, name, comp); central.push(Buffer.concat([ch, name])); pos += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(pos, 16);
  return Buffer.concat([...out, cd, end]);
}
// ---- sheet ----
// Columns are the same as the PDF report. Money / quantity columns hold real numbers (so Excel can add them up); everything else is text.
export const SUMMED = new Set(["Total", "Total USD", "Value", "Stock value USD", "Qty", "Item count", "Stock", "Sold QTY", "Sub Amount", "Invoice Discount", "Discount", "Delivery Fee", "Total Sale"]);
export const kindOf = (h: string): "usd" | "int" | "text" => (/^(Total|Price|Sale|Unit|Value)$|( USD|Amount|Discount|Fee|Total Sale)$/.test(h) ? "usd" : /^(Stock|Qty|Item count|Sold QTY)$/.test(h) ? "int" : "text");
/** "$1,234.50" -> 1234.5 ; "-" or "" -> NaN (left empty). */
export const toNum = (v: unknown): number => { if (typeof v === "number") return v; const t = String(v ?? "").replace(/[$,\s]/g, ""); return t === "" || t === "-" ? NaN : Number(t); };
export function buildXlsx(o: { title: string; sheet: string; cols: XlsxCol[]; rows: Cell[][]; meta: ReportMeta }): Buffer {
  const { meta } = o, logo = meta.logo, N = o.cols.length, kinds = o.cols.map((c) => kindOf(c.header)), last = colName(N), textCol = logo ? 2 : 1;
  const rowsXml: string[] = [], merges: string[] = [];
  const row = (r: number, ht: number, cells: Map<number, string>, fillStyle?: number) => { const a: string[] = []; for (let c = 1; c <= N; c++) a.push(cells.get(c) ?? (fillStyle !== undefined ? `<c r="${colName(c)}${r}" s="${fillStyle}"/>` : "")); rowsXml.push(`<row r="${r}" ht="${ht}" customHeight="1">${a.join("")}</row>`); };
  const str = (r: number, c: number, s: number, v: string) => `<c r="${colName(c)}${r}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  const num = (r: number, c: number, s: number, v: number) => `<c r="${colName(c)}${r}" s="${s}"><v>${Number.isFinite(v) ? v : 0}</v></c>`;
  // top band: logo + brand name + tagline + report title
  row(1, 28, new Map([[textCol, str(1, textCol, S.brand, meta.brand)]]), S.band); row(2, 20, new Map([[textCol, str(2, textCol, S.tag, meta.tagline)]]), S.band); row(3, 22, new Map([[textCol, str(3, textCol, S.title, `${o.title}  -  made on ${meta.generated}`)]]), S.band);
  for (let r = 1; r <= 3; r++) merges.push(`${colName(textCol)}${r}:${last}${r}`);
  row(4, 5, new Map(), S.accent);
  let r = 5;
  if (meta.intro) { row(r, 26, new Map([[1, str(r, 1, S.intro, meta.intro)]])); merges.push(`A${r}:${last}${r}`); r++; }
  if (meta.summary?.length) {
    const items = meta.summary.slice(0, 4), span = Math.max(1, Math.min(3, Math.floor(N / items.length)));
    const lab = new Map<number, string>(), val = new Map<number, string>();
    items.forEach(([l, v], i) => { const c = 1 + i * span; lab.set(c, str(r, c, S.sumLabel, l)); val.set(c, str(r + 1, c, S.sumValue, v)); if (span > 1) { merges.push(`${colName(c)}${r}:${colName(c + span - 1)}${r}`, `${colName(c)}${r + 1}:${colName(c + span - 1)}${r + 1}`); } });
    const fillTo = (m: Map<number, string>, rr: number, st: number) => { for (let c = 1; c <= N; c++) if (!m.has(c)) m.set(c, `<c r="${colName(c)}${rr}" s="${st}"/>`); };
    fillTo(lab, r, S.band); fillTo(val, r + 1, S.band); row(r, 18, lab); row(r + 1, 26, val); r += 2;
  }
  row(r, 8, new Map()); r++;
  const headRow = r; row(r, 30, new Map(o.cols.map((c, i) => [i + 1, str(r, i + 1, S.head, c.header)] as [number, string]))); r++;
  const first = r;
  o.rows.forEach((vals, ri) => { const z = ri % 2 === 1; const m = new Map<number, string>();
    vals.forEach((v, i) => { const k = kinds[i];
      if (k === "text") m.set(i + 1, str(r, i + 1, z ? S.textZ : S.text, String(v ?? "")));
      else { const n = toNum(v); m.set(i + 1, Number.isFinite(n) ? num(r, i + 1, k === "usd" ? (z ? S.usdZ : S.usd) : z ? S.intZ : S.int, n) : str(r, i + 1, z ? S.textZ : S.text, "")); } });
    row(r, 20, m); r++; });
  const lastData = r - 1;
  if (o.rows.length) { // totals row (follows the filter: SUBTOTAL ignores hidden rows)
    const m = new Map<number, string>([[1, str(r, 1, S.totLabel, "Total of the rows shown")]]);
    o.cols.forEach((c, i) => { if (!SUMMED.has(c.header) || kinds[i] === "text") return; const col = colName(i + 1), sum = o.rows.reduce((s, v) => s + (toNum(v[i]) || 0), 0);
      m.set(i + 1, `<c r="${col}${r}" s="${kinds[i] === "usd" ? S.totUsd : S.totInt}"><f>SUBTOTAL(109,${col}${first}:${col}${lastData})</f><v>${Math.round(sum * 100) / 100}</v></c>`); });
    row(r, 22, m, S.totLabel); r++;
  }
  row(r, 10, new Map()); r++;
  // footer band: logo + brand, contact, copyright
  const fStart = r;
  row(r, 24, new Map([[textCol, str(r, textCol, S.fBrand, meta.brand)]]), S.band); row(r + 1, 18, new Map([[textCol, str(r + 1, textCol, S.fSmall, meta.contacts.length ? meta.contacts.join("     |     ") : "Thank you for shopping with us")]]), S.band);
  row(r + 2, 20, new Map([[textCol, str(r + 2, textCol, S.fSmall, COPYRIGHT(meta.year))]]), S.band);
  for (let k = 0; k < 3; k++) merges.push(`${colName(textCol)}${r + k}:${last}${r + k}`);
  const lastRow = r + 2;
  const widths = o.cols.map((c, i) => { let m = c.header.length; for (const v of o.rows) { const l = String(v[i] ?? "").length; if (l > m) m = l; } return Math.min(48, Math.max(10, m + 3)); });
  if (logo) widths[0] = Math.max(widths[0], 16);
  const hf = (s: string) => esc(s.slice(0, 80).replace(/&/g, "&&")); // text only: codes such as &L &R &P are added around it
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${last}${lastRow}"/>
<sheetViews><sheetView showGridLines="0" workbookViewId="0" zoomScale="100"><selection activeCell="A1" sqref="A1"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="18"/><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>
<sheetData>${rowsXml.join("")}</sheetData>${o.rows.length ? `<autoFilter ref="A${headRow}:${last}${lastData}"/>` : ""}<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>
<pageMargins left="0.5" right="0.5" top="0.8" bottom="0.8" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>
<headerFooter><oddHeader>&amp;L&amp;B&amp;16${hf(meta.brand)}&amp;R&amp;11${hf(o.title)}</oddHeader><oddFooter>&amp;L&amp;9${hf(meta.contacts.join("  |  "))}&amp;C&amp;9${hf(COPYRIGHT(meta.year))}&amp;R&amp;9Page &amp;P of &amp;N</oddFooter></headerFooter><ignoredErrors><ignoredError sqref="A1:${last}${lastRow}" numberStoredAsText="1" formula="1" formulaRange="1" emptyCellReference="1"/></ignoredErrors>${logo ? `<drawing r:id="rId1"/>` : ""}</worksheet>`;
  const px = 9525, size = 70 * px, pic = (id: number, row0: number) => `<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>${6 * px}</xdr:colOff><xdr:row>${row0}</xdr:row><xdr:rowOff>${4 * px}</xdr:rowOff></xdr:from><xdr:ext cx="${size}" cy="${size}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id}" name="Cloudy Toys logo ${id - 1}" descr="Cloudy Toys logo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${size}" cy="${size}"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;
  const drawing = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${pic(2, 0)}${pic(3, fStart - 1)}</xdr:wsDr>`;
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', RELS = "http://schemas.openxmlformats.org/package/2006/relationships", OD = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const sheetName = esc(o.sheet.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  const files: { name: string; data: Buffer; store?: boolean }[] = [
    { name: "[Content_Types].xml", data: Buffer.from(`${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${logo ? `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>` : ""}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`) },
    { name: "_rels/.rels", data: Buffer.from(`${X}<Relationships xmlns="${RELS}"><Relationship Id="rId1" Type="${OD}/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`) },
    { name: "docProps/core.xml", data: Buffer.from(`${X}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(`${meta.brand} - ${o.title}`)}</dc:title><dc:creator>${esc(meta.brand)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`) },
    { name: "xl/workbook.xml", data: Buffer.from(`${X}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${OD}"><bookViews><workbookView/></bookViews><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'${sheetName}'!$${headRow}:$${headRow}</definedName></definedNames></workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(`${X}<Relationships xmlns="${RELS}"><Relationship Id="rId1" Type="${OD}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${OD}/styles" Target="styles.xml"/></Relationships>`) },
    { name: "xl/styles.xml", data: Buffer.from(STYLES) },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(sheet) },
  ];
  if (logo) files.push(
    { name: "xl/worksheets/_rels/sheet1.xml.rels", data: Buffer.from(`${X}<Relationships xmlns="${RELS}"><Relationship Id="rId1" Type="${OD}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`) },
    { name: "xl/drawings/drawing1.xml", data: Buffer.from(drawing) },
    { name: "xl/drawings/_rels/drawing1.xml.rels", data: Buffer.from(`${X}<Relationships xmlns="${RELS}"><Relationship Id="rId1" Type="${OD}/image" Target="../media/logo.jpeg"/></Relationships>`) },
    { name: "xl/media/logo.jpeg", data: logo.jpeg, store: true });
  return zip(files);
}
