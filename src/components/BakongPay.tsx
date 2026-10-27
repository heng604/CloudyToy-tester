import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
type Qr = { image: string; expiresAt: number; merchant: string; qrNumber?: number; qrMax?: number };
const POLL_MS = 2000;
/** Bakong KHQR checkout: shows the KHQR ticket for this order, checks the bank every few seconds, and pops up a green "Payment successful" card the moment it is paid.
 *  The server confirms the payment with Bakong and emails the admin the PAID invoice; this page only shows the result. */
export default function BakongPay({ orderNumber, total, onPaid }: { orderNumber: string; total: string; onPaid?: () => void }) {
  const navigate = useNavigate(); const doneBtn = useRef<HTMLButtonElement>(null);
  const [qr, setQr] = useState<Qr | null>(null); const [err, setErr] = useState(""); const [paid, setPaid] = useState(false); const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false); const [problem, setProblem] = useState(false); const [watcherOff, setWatcherOff] = useState(false); const since = useRef(Date.now()); const [closed, setClosed] = useState<"" | "FAILED" | "EXPIRED">(""); const [dbg, setDbg] = useState<string[] | null>(null); const { isAdmin } = useAuth(); const debug = isAdmin || (typeof location !== "undefined" && new URLSearchParams(location.search).get("debug") === "1"); // the admin always sees what Bakong answers while testing
  const amount = total.replace(/^\$/, "");
  const onPaidRef = useRef(onPaid); onPaidRef.current = onPaid; // a stable callback: the page re-rendering must not restart the QR / payment checks
  const markPaid = useCallback(() => { setPaid(true); setOpen(true); onPaidRef.current?.(); }, []);
  const load = useCallback(async (): Promise<boolean> => {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/payment/bakong/qr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumber }) });
      const j = await r.json().catch(() => ({})) as { paid?: boolean; closed?: boolean; status?: string; error?: string } & Partial<Qr>;
      if (!r.ok) { setErr(j.error ?? "Could not create the QR code."); return false; }
      if (j.paid) { markPaid(); return true; }
      if (j.closed) { setClosed(j.status === "FAILED" ? "FAILED" : "EXPIRED"); return true; }
      setQr({ image: j.image!, expiresAt: j.expiresAt!, merchant: j.merchant ?? "", qrNumber: j.qrNumber, qrMax: j.qrMax }); return true;
    } catch { setErr("Could not create the QR code (network error)."); return false; } finally { setLoading(false); }
  }, [orderNumber, markPaid]);
  useEffect(() => { void load(); }, [load]);
  const [now, setNow] = useState(() => Date.now()); const [tries, setTries] = useState(0);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); const back = () => setNow(Date.now()); document.addEventListener("visibilitychange", back); return () => { clearInterval(id); document.removeEventListener("visibilitychange", back); }; }, []);
  const left = qr ? Math.max(0, Math.round((qr.expiresAt - now) / 1000)) : 0;
  const expired = !!qr && qr.expiresAt <= now;
  useEffect(() => { // when a QR runs out (5 min) make the next one by itself. The server allows 3 per order, then cancels the order, gives the stock back and we go home.
    if (!qr || paid || closed) return;
    const go = () => { void load().then((ok) => { if (!ok) setTimeout(() => setTries((n) => n + 1), 4000); }); }; // network hiccup: try again in 4 s
    const t = setTimeout(go, Math.max(0, qr.expiresAt - Date.now()) + 1500);
    const back = () => { if (!document.hidden && Date.now() > qr.expiresAt) go(); }; // tab was asleep when the time ran out
    document.addEventListener("visibilitychange", back);
    return () => { clearTimeout(t); document.removeEventListener("visibilitychange", back); };
  }, [qr, paid, closed, load, tries]);
  useEffect(() => { if (!closed) return; const id = setTimeout(() => navigate("/"), closed === "FAILED" ? 0 : 3500); return () => clearTimeout(id); }, [closed, navigate]); // always back to the home page
  const cancel = async () => {
    if (loading) return; setLoading(true); // no "are you sure" popup: one click cancels and goes home
    try { const r = await fetch("/api/payment/bakong/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumber }) }); const j = await r.json().catch(() => ({})) as { paid?: boolean; ok?: boolean; error?: string }; if (j.paid) markPaid(); else if (j.ok) { setClosed("FAILED"); navigate("/"); } else setErr(j.error ?? "Could not cancel. Please try again."); }
    catch { setErr("Could not cancel (network error). Please try again."); } finally { setLoading(false); }
  };
  useEffect(() => { // ask the server whether Bakong has the payment yet
    if (!qr || paid || closed) return; let live = true; let busy = false;
    const check = async () => { if (busy) return; busy = true; try { const r = await fetch(`/api/payment/bakong/status/${encodeURIComponent(orderNumber)}`, { cache: "no-store" }); const j = await r.json().catch(() => ({})) as { paid?: boolean; closed?: boolean; status?: string; problem?: boolean; watcher?: string; debug?: string[] }; if (!live) return; setWatcherOff(j.watcher === "offline" && Date.now() - since.current > 20000); if (j.paid) markPaid(); else if (j.closed) setClosed(j.status === "FAILED" ? "FAILED" : "EXPIRED"); else { setProblem(!!j.problem); if (debug) setDbg(j.debug ?? []); } } catch { /* try again on the next tick */ } finally { busy = false; } };
    void check(); const id = setInterval(() => { if (!document.hidden) void check(); }, POLL_MS);
    const back = () => { if (!document.hidden) void check(); }; // customer comes back from the banking app: check right away
    document.addEventListener("visibilitychange", back); window.addEventListener("focus", back); window.addEventListener("pageshow", back);
    return () => { live = false; clearInterval(id); document.removeEventListener("visibilitychange", back); window.removeEventListener("focus", back); window.removeEventListener("pageshow", back); };
  }, [qr, paid, closed, orderNumber, markPaid, debug]);
  useEffect(() => { if (open) doneBtn.current?.focus(); }, [open]);
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const close = (to: string) => { setOpen(false); navigate(to); };
  if (closed) return (<div role="status" className="mx-auto max-w-sm space-y-3 rounded-xl2 border border-sky-border bg-white p-6 text-center shadow-soft">
    <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-3xl" aria-hidden="true">{closed === "FAILED" ? "✕" : "⏱"}</div>
    <h2 className="text-xl font-extrabold">{closed === "FAILED" ? "Order cancelled" : "Payment time is over"}</h2>
    <p className="text-sm text-mute">{closed === "FAILED" ? "Your order was cancelled and nothing was charged." : "No payment was received, so the order was cancelled."} The items are back in stock.</p>
    <button type="button" onClick={() => navigate("/")} className="min-h-11 w-full rounded-full bg-sky px-6 font-bold hover:bg-sky-hover">Back to home</button>
    <p className="text-xs text-mute">Taking you back to the home page…</p>
  </div>);
  return (<div className="space-y-3 text-center">
    <style>{`@keyframes bk-pop{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}@keyframes bk-draw{to{stroke-dashoffset:0}}@keyframes bk-fade{from{opacity:0}to{opacity:1}}@keyframes bk-rise{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}@keyframes bk-ring{0%{transform:scale(.8);opacity:.5}100%{transform:scale(1.7);opacity:0}}`}</style>
    {/* KHQR card: same 300 x 450 layout as the official KHQR card. Name = BAKONG_MERCHANT_NAME from your data. */}
    <div className="mx-auto w-[300px] max-w-full" style={{ containerType: "inline-size" }}>
      <div className="relative w-full overflow-hidden bg-white shadow-[0_2px_10px_rgba(0,0,0,.18)]" style={{ aspectRatio: "2 / 3", borderRadius: "4.000cqw" }}>
        <div className="absolute left-0 top-0 w-full bg-[#cc0000]" style={{ height: "29.333cqw", clipPath: "polygon(0 0,100% 0,100% 100%,90.667% 69.318%,0 69.318%)" }}>
          <img src="/img/khqr-logo-white.png" alt="KHQR" className="absolute" style={{ left: "33.333cqw", top: "6.000cqw", width: "33.333cqw", height: "auto" }} />
        </div>
        <p className="absolute m-0 truncate text-left font-medium leading-none text-[#050505]" style={{ left: "10.333cqw", top: "28.000cqw", right: "10.333cqw", fontSize: "6.333cqw", lineHeight: "8.667cqw", fontFamily: "'Noto Sans Khmer','Khmer OS',system-ui,sans-serif" }}>{qr?.merchant ?? ""}</p>
        <p className="absolute m-0 flex items-baseline text-left leading-none" style={{ left: "10.333cqw", top: "37.333cqw", gap: "1.667cqw" }}><b className="tabular-nums text-[#050505]" style={{ fontSize: "7.000cqw" }}>{amount}</b><span className="text-[#6c6c6c]" style={{ fontSize: "4.167cqw" }}>USD</span></p>
        <div className="absolute left-0 w-full border-t border-dashed border-[#9a9a9a]" style={{ top: "50.000cqw" }} />
        {qr ? <>
          <img src={qr.image} alt={`Bakong KHQR for ${total}`} className={`absolute ${expired ? "opacity-20 blur-sm" : ""}`} style={{ left: "8.333cqw", top: "58.333cqw", width: "83.333cqw", height: "83.333cqw" }} />
          {!expired && <img src="/img/khqr-center.png" alt="" className="absolute rounded-full bg-white" style={{ left: "42.667cqw", top: "92.667cqw", width: "14.667cqw", height: "14.667cqw", padding: "1.667cqw" }} />}
          {expired && <div className="absolute inset-x-0 grid place-items-center" style={{ top: "58.333cqw", height: "83.333cqw" }}><button type="button" onClick={load} disabled={loading} className="rounded-full bg-[#cc0000] px-5 py-2 font-bold text-white hover:bg-[#a60000] disabled:opacity-60">{loading ? "Making a new QR…" : "Get a new QR"}</button></div>}
        </> : <p className="absolute inset-x-0 text-center text-sm text-mute" style={{ top: "96.667cqw" }} aria-busy="true">{err ? "" : "Creating your QR…"}</p>}
      </div>
    </div>
    <p className="text-xs text-mute">Order {orderNumber}</p>
    {err && <p role="alert" className="text-sm text-red-700">{err} <button type="button" onClick={load} className="underline">Try again</button></p>}
    {qr && !expired && !paid && <p className="text-sm text-mute">Open your banking app (ABA, ACLEDA, Wing…), scan, and pay <b>{total}</b>. QR {qr.qrNumber ?? 1} of {qr.qrMax ?? 3} expires in <b>{mmss}</b>. A new one is made automatically.</p>}
    {qr && !expired && !paid && <p role="status" className="flex items-center justify-center gap-2 text-sm font-semibold text-mute"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#e1232e]" />Waiting for your payment…</p>}
    {!paid && <button type="button" onClick={cancel} disabled={loading} className="text-sm text-red-700 underline disabled:opacity-50">Cancel order</button>}
    {watcherOff && !paid && <p role="alert" className="mx-auto max-w-sm rounded-xl bg-amber-100 p-3 text-xs text-amber-900">Our automatic payment checker is offline right now. If you have already paid, please keep your order number <b>{orderNumber}</b> and contact the shop; we will confirm it for you.</p>}
    {problem && !paid && <p role="status" className="text-xs text-amber-700">We could not reach the bank to confirm yet. If you have paid, please wait a moment or contact the shop with your order number.</p>}
    {paid && !open && <p role="status" className="text-sm font-bold text-green-700">✓ Payment received. <button type="button" onClick={() => setOpen(true)} className="underline">Show receipt</button></p>}
    {/* Payment successful popup */}
    {open && <div className="fixed inset-0 z-[100] grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="bk-title" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" style={{ animation: "bk-fade .25s ease-out both" }} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white text-center shadow-2xl" style={{ animation: "bk-rise .35s ease-out both" }}>
        <div className="bg-gradient-to-b from-green-50 to-white px-6 pb-2 pt-8">
          <div className="relative mx-auto h-24 w-24">
            <span aria-hidden="true" className="absolute inset-0 rounded-full bg-green-400" style={{ animation: "bk-ring 1.4s .3s ease-out 2 both" }} />
            <div className="relative grid h-24 w-24 place-items-center rounded-full bg-green-500 shadow-lg" style={{ animation: "bk-pop .5s ease-out both" }}>
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" style={{ strokeDasharray: 24, strokeDashoffset: 24, animation: "bk-draw .45s .35s ease-out forwards" }} /></svg>
            </div>
          </div>
          <h2 id="bk-title" className="mt-5 text-2xl font-extrabold text-green-700">Payment successful</h2>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-ink">{total}</p>
        </div>
        <dl className="mx-6 mt-3 space-y-1.5 border-y border-dashed border-green-200 py-3 text-left text-sm">
          <div className="flex justify-between gap-3"><dt className="text-mute">Order</dt><dd className="font-bold">{orderNumber}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-mute">Paid to</dt><dd className="truncate font-bold">{qr?.merchant ?? ""}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-mute">Method</dt><dd className="font-bold">Bakong KHQR</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-mute">Status</dt><dd className="font-bold text-green-700">Paid ✓</dd></div>
        </dl>
        <p className="px-6 pt-3 text-sm text-mute">Thank you! Your order has been sent to our team and we will start packing it.</p>
        <div className="p-6 pt-4">
          <button ref={doneBtn} type="button" onClick={() => close("/")} className="min-h-11 w-full rounded-full bg-green-600 px-6 font-bold text-white hover:bg-green-700">Done</button>
          <button type="button" onClick={() => close("/account/orders")} className="mt-2 text-sm underline">View my orders</button>
        </div>
      </div>
    </div>}
  </div>);
}
