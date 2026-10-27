export type CsvCol<T> = { header: string; get: (r: T) => string | number };
/** Strings starting with = + - @ are prefixed with ' so Excel never runs them as formulas. */
const safe = (v: string | number) => (typeof v === "number" ? String(v) : /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
/** UTF-8 with BOM so Excel shows Khmer correctly. */
export function toCsv<T>(rows: T[], cols: CsvCol<T>[]): string {
  const lines = [cols.map((c) => quote(c.header)).join(",")];
  for (const r of rows) lines.push(cols.map((c) => quote(safe(c.get(r)))).join(","));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
