import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { download } from "@/lib/api";
/** Buttons that download from the admin-only export route. `params` carries the current filters.
 *  "Export Google Sheet" downloads the report as a .xlsx file (same template as the PDF) that Google Sheets opens. */
export default function ExportButtons({ type, params = {} }: { type: "orders" | "transactions" | "delivery" | "products" | "stock"; params?: Record<string, string | undefined> }) {
  const [busy, setBusy] = useState(false); const [hint, setHint] = useState<"" | "file">(""); const { t } = useI18n();
  const qs = (format: string) => new URLSearchParams(Object.entries({ type, format, ...params }).filter(([, v]) => v) as [string, string][]).toString();
  const go = async (f: string) => { setBusy(true); try { await download(`/admin/export?${qs(f)}`); if (f === "xlsx") setHint("file"); } catch { alert("Could not export. Please try again."); } finally { setBusy(false); } };
  const sheet = () => go("xlsx"); // one click: downloads the report file (same template as the PDF) that opens in Google Sheets, no other tab
  const cls = "rounded-full border border-sky-border bg-white px-4 py-2 text-sm font-bold hover:bg-sky-pale disabled:opacity-50";
  const note = "basis-full rounded-xl bg-sky-pale px-3 py-2 text-right text-xs font-semibold text-mute";
  const link = "font-bold text-sky-hover underline";
  return (<span className="inline-flex flex-wrap items-center justify-end gap-2"><button type="button" disabled={busy} onClick={() => void sheet()} className={cls}>{t("Export Google Sheet")}</button><button type="button" disabled={busy} onClick={() => go("pdf")} className={cls}>{t("Export PDF")}</button>
    {hint === "file" && <span role="status" className={note}>File downloaded. Open it in Google Sheets (File &gt; Import &gt; Upload) or just double-click it in Excel. <a href="https://docs.google.com/spreadsheets/" target="_blank" rel="noopener noreferrer" className={link}>Open Google Sheets</a> <button type="button" onClick={() => setHint("")} aria-label="Close" className="ml-1 font-bold">×</button></span>}</span>);
}
