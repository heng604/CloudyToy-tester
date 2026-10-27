import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAdmin } from "./hooks";
import Skeleton from "@/components/Skeleton";
import { toPng } from "html-to-image";
import Invoice, { INVOICE_WIDTH } from "@/components/Invoice";
import Receipt, { RECEIPT_MM } from "@/components/Receipt";
import NotFound from "@/components/NotFound";
import { useSettings } from "@/lib/store";
import { useTitle } from "@/lib/title";
import { invoiceNo } from "@shared/invoice";
import type { StoredOrder } from "@shared/types";
type Size = "A4" | "80" | "58";
const SIZES: { id: Size; title: string; hint: string }[] = [{ id: "A4", title: "A4", hint: "Full page" }, { id: "80", title: "80 mm", hint: "Thermal roll" }, { id: "58", title: "58 mm", hint: "Small roll" }];
const MM_PX = 96 / 25.4; // CSS pixels per millimetre
const KEY = "cloudy-invoice-size";
const loadSize = (): Size => { try { const v = localStorage.getItem(KEY); return v === "80" || v === "58" || v === "A4" ? v : "A4"; } catch { return "A4"; } };
/** Admin only (lives under /admin, which shows the 404 page to everyone else). The only place an invoice can be viewed, printed or downloaded.
 *  Three paper sizes: A4 (the full designed invoice) and 80 mm / 58 mm thermal receipts. */
export default function AdminInvoice() {
  useTitle("Invoice", true); const { orderNumber } = useParams(); const { settings } = useSettings();
  const { data } = useAdmin<{ orders: StoredOrder[] }>("/admin/orders");
  const o = data ? data.orders.find((x) => x.orderNumber === orderNumber) ?? null : undefined;
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [size, setSizeState] = useState<Size>(loadSize); const setSize = (s: Size) => { setSizeState(s); try { localStorage.setItem(KEY, s); } catch { /* storage is optional */ } };
  const inv = useRef<HTMLDivElement>(null); const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1); const [h, setH] = useState(0); const [hmm, setHmm] = useState(0);
  const receipt = size !== "A4";
  // Screen preview: A4 shrinks to fit phones, receipts are shown 1.5x bigger than real size so they are easy to read.
  useLayoutEffect(() => {
    const fit = () => {
      const el = inv.current, w = box.current?.clientWidth ?? INVOICE_WIDTH; if (!el) return;
      const nat = receipt ? RECEIPT_MM[size as "58" | "80"] * MM_PX : INVOICE_WIDTH;
      const s = receipt ? Math.min(1.5, w / nat) : Math.min(1, w / nat);
      setScale(s); setH(el.offsetHeight * s); setHmm(el.offsetHeight / MM_PX);
    };
    fit(); const ro = new ResizeObserver(fit); if (box.current) ro.observe(box.current); if (inv.current) ro.observe(inv.current); return () => ro.disconnect();
  }, [o, size, receipt]);
  // Printer page size: receipts use the exact roll width and the measured height (no blank trailing page); A4 keeps the stylesheet default.
  useEffect(() => {
    const st = document.createElement("style");
    st.textContent = receipt ? `@media print{@page{size:${size}mm ${Math.ceil(hmm) + 6}mm;margin:0}html,body{width:${size}mm}}` : "";
    document.head.appendChild(st); return () => { st.remove(); };
  }, [receipt, size, hmm]);
  if (o === undefined) return <Skeleton />;
  if (!o) return <NotFound />;
  const save = async () => {
    if (!inv.current) return; setBusy(true); setErr("");
    try {
      try { await document.fonts?.ready; } catch { /* fonts are optional */ }
      // A4: 3x = sharp on paper. Receipt: 4x so small thermal text stays crisp. Two tries: the first one warms up font/image loading in some browsers.
      const opts = { pixelRatio: receipt ? 4 : 3, backgroundColor: "#ffffff", cacheBust: true };
      await toPng(inv.current, opts).catch(() => undefined);
      const url = await toPng(inv.current, opts);
      const a = document.createElement("a"); a.href = url; a.download = `${invoiceNo(o.orderNumber)}${receipt ? `-${size}mm` : ""}.png`; a.click();
    } catch { setErr("Could not make the image. Please use Print, then choose “Save as PDF”."); }
    setBusy(false);
  };
  const btn = "min-h-11 rounded-full px-5 font-bold";
  return (<div className={`mx-auto space-y-4 ${receipt ? "max-w-xl" : "max-w-3xl"}`}>
    <div className="no-print flex flex-wrap items-center justify-between gap-3">
      <Link to="/admin/orders" className="text-sm font-semibold underline">← Back to orders</Link>
      <div className="flex flex-wrap gap-2">
        <button onClick={save} disabled={busy} className={`${btn} bg-sky hover:bg-sky-hover disabled:opacity-60`}>{busy ? "Making image…" : "Download image (PNG)"}</button>
        <button onClick={() => window.print()} className={`${btn} border border-sky-border bg-white`}>🖨 Print {receipt ? `${size} mm` : "A4"}</button>
      </div>
    </div>
    <div className="no-print flex flex-wrap items-center gap-2 rounded-xl2 border border-sky-border bg-white p-3" role="radiogroup" aria-label="Paper size">
      <span className="px-2 text-sm font-bold">Paper</span>
      {SIZES.map((s) => <button key={s.id} role="radio" aria-checked={size === s.id} onClick={() => setSize(s.id)} className={`min-h-11 rounded-full border px-4 text-left leading-tight ${size === s.id ? "border-ink bg-ink text-white" : "border-sky-border bg-white hover:bg-sky-pale"}`}><span className="block text-sm font-extrabold">{s.title}</span><span className="block text-[11px] opacity-80">{s.hint}</span></button>)}
      {receipt && <p className="basis-full px-2 text-xs text-mute">Same colourful design as the invoice. In the print window choose your printer, set margins to “None” and scale to 100%. Paper width is set automatically.</p>}
    </div>
    {err && <p role="alert" className="no-print rounded-xl2 bg-amber-100 p-3 text-sm text-amber-900">{err}</p>}
    <div ref={box} className={`invoice-print-box w-full ${receipt ? "rounded-xl2 bg-white/70 py-4 shadow-soft" : ""}`} style={{ height: h ? h + (receipt ? 32 : 0) : undefined }}>
      <div style={{ width: receipt ? `${RECEIPT_MM[size as "58" | "80"]}mm` : INVOICE_WIDTH, transform: `scale(${scale})`, transformOrigin: receipt ? "top center" : "top left", marginInline: receipt ? "auto" : undefined }} className={`invoice-print-inner ${receipt ? "receipt-print" : ""}`}>
        {receipt ? <Receipt ref={inv} order={o} settings={settings} paper={size as "58" | "80"} /> : <Invoice ref={inv} order={o} settings={settings} />}
      </div>
    </div>
  </div>);
}
