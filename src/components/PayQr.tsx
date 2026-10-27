import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ADMIN_EMAIL } from "@shared/admin";
import { compressFormData } from "@/lib/compress";
import { useSettings } from "@/lib/store";
import ProofPicker from "./ProofPicker";
/** QR payment. "I have paid" opens the popup; when the popup is closed (Close button or Esc) the order is emailed to the admin, then the customer goes to the home page. */
export default function PayQr({ orderNumber, total, telegram, facebook }: { orderNumber: string; total: string; telegram: string; facebook: string }) {
  const { settings } = useSettings(); const d = useRef<HTMLDialogElement>(null); const navigate = useNavigate(); const router = { push: (p: string) => navigate(p), replace: (p: string) => navigate(p, { replace: true }) };
  const sent = useRef(false);
  const [mail, setMail] = useState<"" | "sending" | "sent" | string>("");
  const clicked = useRef(false);
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState(""); const [up, setUp] = useState<"" | "uploading" | string>("");
  const pick = (f: File | null) => { setUp(""); if (preview) URL.revokeObjectURL(preview); if (f && f.size > 25 * 1024 * 1024) { setFile(null); setPreview(""); setUp("Image is too large (max 25 MB)."); return; } setFile(f); setPreview(f ? URL.createObjectURL(f) : ""); };
  const paid = async () => { // the payment screenshot must be uploaded first; only then the popup opens
    if (!file || up === "uploading") return; setUp("uploading");
    const fd = new FormData(); fd.set("orderNumber", orderNumber); fd.set("proof", file);
    try { const r = await fetch("/api/payment/proof", { method: "POST", body: await compressFormData(fd) }); const j = await r.json().catch(() => ({})) as { error?: string };
      if (!r.ok) { setUp(j.error ?? "Could not upload the screenshot."); return; } }
    catch { setUp("Could not upload the screenshot (network error)."); return; }
    setUp(""); clicked.current = true; d.current?.showModal(); };
  useEffect(() => {
    // Browser refresh on this page: make sure the order email goes out, and send the customer to the home page.
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === "reload") router.replace("/");
    const leave = () => { if (clicked.current && !sent.current) { sent.current = true; navigator.sendBeacon("/api/payment/claim", new Blob([JSON.stringify({ orderNumber })], { type: "application/json" })); } };
    window.addEventListener("pagehide", leave); return () => window.removeEventListener("pagehide", leave);
  }, [orderNumber]);
  const sendOrder = () => { // runs when the popup closes; never blocks the UI
    if (sent.current) return; sent.current = true; setMail("sending");
    fetch("/api/payment/claim", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumber }) })
      .then(async (r) => { const j = await r.json().catch(() => ({})) as { ok?: boolean; detail?: string; error?: string };
        if (j.ok) { setMail("sent"); router.push("/"); } else { sent.current = false; setMail(`Email not sent: ${j.detail ?? j.error ?? `server error ${r.status}`}`); } })
      .catch(() => { sent.current = false; setMail("Email not sent: network error"); }); // allow a retry on the next click
  };
  const link = "block rounded-full bg-sky px-4 py-2 font-bold hover:bg-sky-hover";
  return (<div className="space-y-3 rounded-xl2 border border-sky-border bg-white p-5 text-center">
    {settings.qrUrl === "none" ? <p className="rounded-xl bg-sky-pale px-4 py-6 text-sm text-mute">The payment QR is not available right now. Please contact us on Telegram or Facebook to pay.</p> : <img src={settings.qrUrl || "/img/qr-pay.png"} alt="ABA PAY QR code for Cloudy Toys (YIHOR THENG)" className="mx-auto w-full max-w-md rounded-xl2 border border-sky-border" />}
    <p>Scan, pay exactly <b>{total}</b>, and write <b>{orderNumber}</b> in the note.</p>
    <div className="mx-auto max-w-md"><ProofPicker file={file} preview={preview} onPick={pick} disabled={up === "uploading"} /></div>
    <button type="button" onClick={paid} disabled={!file || up === "uploading"} className="min-h-11 rounded-full bg-sky px-8 font-bold hover:bg-sky-hover disabled:cursor-not-allowed disabled:opacity-50">{up === "uploading" ? "Uploading…" : "2. I have paid"}</button>
    {!file && <p className="text-xs text-mute">Upload your payment screenshot to enable this button.</p>}{up && up !== "uploading" && <p role="alert" className="text-sm text-red-700">{up}</p>}
    {mail === "sent" ? <p className="text-sm font-semibold text-green-700">Order emailed to admin ✓</p> : mail === "sending" ? <p className="text-sm text-mute">Sending order to admin…</p> : mail ? <p role="alert" className="text-sm text-red-700">{mail}</p> : null}
    <dialog ref={d} onClose={sendOrder} className="max-w-sm rounded-xl2 p-6 backdrop:bg-black/40"><h2 className="text-lg font-extrabold">Please contact our admin</h2>
      <p className="my-3 text-sm">Thank you! Your order has been sent to our admin. To confirm your payment quickly, send your payment screenshot and order number <b>{orderNumber}</b> to our admin.</p>
      <div className="space-y-2">{telegram && <a href={telegram} target="_blank" rel="noopener noreferrer" className={link}>Telegram</a>}{facebook && <a href={facebook} target="_blank" rel="noopener noreferrer" className={link}>Facebook page</a>}{!telegram && !facebook && <a href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(`Payment ${orderNumber}`)}`} className={link}>Email {ADMIN_EMAIL}</a>}</div>
      <form method="dialog" className="mt-4"><button onClick={sendOrder} className="rounded-full border border-sky-border px-6 py-2">Close</button></form></dialog></div>);
}
