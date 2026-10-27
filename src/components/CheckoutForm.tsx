import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { useCart } from "@/components/CartProvider";
import { money } from "@shared/products";
import type { CartProduct } from "@shared/cartTypes";
import type { Area, Method } from "@shared/delivery";
import { ADMIN_EMAIL } from "@shared/admin";
import { compressFormData } from "@/lib/compress";
import { useSettings, usePromotions } from "@/lib/store";
import { autoDiscounts, autoTotal, preorderSplit } from "@shared/promotions";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { PROVINCES } from "@shared/provinces";
import { methodOn, modeOf } from "@shared/payOptions";
export default function CheckoutForm({ fees, products, telegram = "", facebook = "" }: { fees: { pp: number; prov: number }; products: CartProduct[]; telegram?: string; facebook?: string }) {
  const { settings: site } = useSettings(); const { promotions } = usePromotions(); const { user } = useAuth(); const { t, lang } = useI18n(); const [province, setProvince] = useState("");
  const { lines, clear } = useCart(); const navigate = useNavigate(); const router = { push: (p: string) => navigate(p) };
  const dlg = useRef<HTMLDialogElement>(null); const [placed, setPlaced] = useState(""); const closing = useRef(false);
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState("");
  const pickProof = (f: File | null) => { setErr(""); if (f && f.size > 25 * 1024 * 1024) { setFile(null); setPreview(""); setErr("Screenshot is too large (max 25 MB)."); return; } setFile(f); setPreview(f ? URL.createObjectURL(f) : ""); };
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [code, setCode] = useState(""); const [applied, setApplied] = useState<{ code: string; cents: number } | null>(null); const [codeMsg, setCodeMsg] = useState(""); const [checking, setChecking] = useState(false);
  const [area, setArea] = useState<Area>("PHNOM_PENH"); const [pick, setPick] = useState<Method | null>(null); const setMethod = (m: Method) => setPick(m);
  const [bakong, setBakong] = useState(false); const [payFull, setPayFull] = useState(false); // pre-order carts: 50% deposit (default) or the full price now
  useEffect(() => { let live = true; fetch("/api/payment/bakong/enabled").then((r) => r.json()).then((j) => { if (live && j?.enabled) setBakong(true); }).catch(() => {}); return () => { live = false; }; }, []);
  const hasPre = lines.some((l) => products.find((p) => p.id === l.id)?.preorder);
  const avail: Record<Method, boolean> = { BAKONG: bakong && methodOn(site, "BAKONG"), QR_IMAGE: methodOn(site, "QR_IMAGE"), COD: methodOn(site, "COD") && area === "PHNOM_PENH" && !hasPre };
  const firstOn = (["BAKONG", "QR_IMAGE", "COD"] as Method[]).find((m) => avail[m]);
  const method: Method = pick && avail[pick] ? pick : firstOn ?? "QR_IMAGE"; // the customer's own choice wins while it is available; otherwise the first option that is on
  const items = lines.map((l) => ({ l, p: products.find((p) => p.id === l.id) })).filter((x) => x.p);
  const autos = autoDiscounts(items.map((x) => ({ category: x.p!.category ?? "", lineCents: Math.round((x.p!.salePrice ?? x.p!.price) * 100) * x.l.qty })), promotions.campaigns), autoOff = autoTotal(autos) / 100;
  const subtotal = items.reduce((s, x) => s + (x.p!.salePrice ?? x.p!.price) * x.l.qty, 0);
  const ship = (area === "PHNOM_PENH" ? fees.pp : fees.prov) / 100;
  if (!items.length) return <p className="rounded-xl2 bg-sky-pale p-8 text-center">Nothing to check out. <Link to="/shop" className="underline">Browse toys</Link></p>;
  async function applyCode() {
    if (!code.trim() || checking) return; setChecking(true); setCodeMsg(""); setApplied(null);
    const res = await fetch("/api/discount/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, lines: lines.map((l) => ({ productId: l.id, qty: l.qty })) }) });
    const d = await res.json().catch(() => ({})); setChecking(false);
    if (!res.ok) { setCodeMsg(d.error ?? "Could not check the code."); return; }
    setApplied({ code: d.code, cents: d.discountCents }); setCodeMsg("");
  }
  const discount = applied ? applied.cents / 100 : 0;
  const totalC = Math.round((subtotal - autoOff - discount + ship) * 100), split = hasPre ? preorderSplit(totalC, promotions.preorder, payFull) : null, payNow = (split ? split.depositCents : totalC) / 100;
  function pickArea(a: Area) { setArea(a); }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy || placed) return; setErr("");
    if (method === "QR_IMAGE" && !file) { setErr("Please upload your payment screenshot first."); return; }
    setBusy(true);
    const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? "");
    const res = await api("/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      customer: { name: v("name"), email: v("email"), phone: v("phone"), address: v("address"), notes: v("notes") || undefined, facebook: v("facebook") || undefined, telegram: v("telegram") || undefined }, area, ...(area === "PROVINCE" ? { province } : {}), method,
      lines: lines.map((l) => ({ productId: l.id, qty: l.qty })), code: code.trim() || undefined, ...(hasPre ? { preorderPay: payFull ? "full" : "deposit" } : {}) }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data.error ?? "Something went wrong."); setBusy(false); return; }
    if (method === "QR_IMAGE" && file) { // send the payment screenshot to the admin, then show the notification popup
      const fd = new FormData(); fd.set("orderNumber", data.orderNumber); fd.set("proof", file);
      const up = await fetch("/api/payment/proof", { method: "POST", body: await compressFormData(fd) }).catch(() => null);
      if (!up || !up.ok) { clear(); router.push(`/payment/${data.orderNumber}`); return; } // order is saved; the payment page lets the customer retry the upload
      setPlaced(data.orderNumber); setBusy(false); dlg.current?.showModal(); return;
    }
    clear(); router.push(`/payment/${data.orderNumber}`);
  }
  const onClosePopup = async () => { // popup closed: email the order to the admin, then go home
    if (!placed || closing.current) return; closing.current = true;
    const ok = await fetch("/api/payment/claim", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumber: placed }) }).then((r) => r.ok).catch(() => false);
    clear(); router.push(ok ? "/" : `/payment/${placed}`);
  };
  const link = "block rounded-full bg-sky px-4 py-2 text-center font-bold hover:bg-sky-hover";
  const cls = "w-full rounded-xl border border-sky-border bg-white px-4 py-3"; const opt = "flex items-start gap-3 rounded-xl border border-sky-border bg-white p-4";
  return (<div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:gap-8 xl:grid-cols-[1fr_26rem]"><form onSubmit={submit} className="space-y-3"><h1 className="text-2xl font-extrabold sm:text-3xl">{t("Checkout")}</h1>
    <label className="block">{t("Full name")}<input name="name" required minLength={2} autoComplete="name" placeholder="Example: Sok Dara" className={cls} /></label>
    <label className="block">{t("Email")}<input name="email" type="email" autoComplete="email" defaultValue={user?.email ?? ""} placeholder="Example: sokdara@gmail.com" className={cls} /></label>
    <label className="block">{t("Phone")}<input name="phone" type="tel" required minLength={6} autoComplete="tel" placeholder="Example: 012 345 678" className={cls} /></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="block">{t("Facebook name")}<input name="facebook" maxLength={100} placeholder="Example: Sok Dara" className={cls} /></label>
      <label className="block">{t("Telegram username")}<input name="telegram" maxLength={100} placeholder="Example: @sokdara" className={cls} /></label></div>
    <fieldset className="space-y-2"><legend className="font-semibold">{t("Delivery area")}</legend>
      <label className={opt}><input type="radio" name="area" checked={area === "PHNOM_PENH"} onChange={() => pickArea("PHNOM_PENH")} />{t("Phnom Penh")} · {money(fees.pp / 100)}</label>
      <label className={opt}><input type="radio" name="area" checked={area === "PROVINCE"} onChange={() => pickArea("PROVINCE")} />{t("Province")} · {money(fees.prov / 100)}</label>
      {area === "PROVINCE" && <label className="block">{t("Choose province")}<select name="province" required value={province} onChange={(e) => setProvince(e.target.value)} className={cls}><option value="" disabled>{t("Select your province")}</option>{PROVINCES.map((p) => <option key={p.en} value={p.en}>{lang === "km" ? p.km : p.en}</option>)}</select></label>}</fieldset>
    <label className="block">{t("Delivery address")}<textarea name="address" required minLength={5} rows={3} placeholder="Example: House 12, Street 271, Sangkat Tuol Tumpung 1, Khan Chamkar Mon, Phnom Penh" className={cls} /></label>
    <label className="block">{t("Delivery instructions")}<input name="notes" placeholder="Example: Call me before arriving" className={cls} /></label>
    {split && <fieldset className="space-y-2 rounded-xl2 border border-sky-border p-4"><legend className="px-1 font-semibold">Pre-order payment</legend>
      <label className={opt}><input type="radio" name="prepay" checked={!payFull} onChange={() => setPayFull(false)} /><span>Pay {promotions.preorder.depositPercent}% deposit now <span className="text-mute">· {money(preorderSplit(totalC, promotions.preorder).depositCents / 100)} now, the rest when we dispatch</span></span></label>
      <label className={opt}><input type="radio" name="prepay" checked={payFull} onChange={() => setPayFull(true)} /><span>Pay the full price now <span className="text-mute">· {money(totalC / 100)}, nothing more to pay later</span></span></label></fieldset>}
    <fieldset className="space-y-2"><legend className="font-semibold">{t("Payment")}</legend>
      <label className={`${opt} ${avail.BAKONG ? "" : "opacity-50"}`}><input type="radio" name="pay" disabled={!avail.BAKONG} checked={method === "BAKONG"} onChange={() => { setMethod("BAKONG"); }} /><span>Pay with Bakong KHQR <span className="text-mute">· {avail.BAKONG ? "scan with any banking app, confirmed automatically" : modeOf(site, "BAKONG") === "soon" || !bakong ? "coming soon" : "temporarily unavailable"}</span></span></label>
      <label className={`${opt} ${avail.QR_IMAGE ? "" : "opacity-50"}`}><input type="radio" name="pay" disabled={!avail.QR_IMAGE} checked={method === "QR_IMAGE"} onChange={() => { setMethod("QR_IMAGE"); }} />Scan QR image and pay. We verify it with you on Telegram or Facebook.{!avail.QR_IMAGE && (modeOf(site, "QR_IMAGE") === "soon" ? " · Coming soon" : " (temporarily unavailable)")}</label>
      <label className={`${opt} ${!avail.COD ? "opacity-50" : ""}`}><input type="radio" name="pay" disabled={!avail.COD} checked={method === "COD"} onChange={() => { setMethod("COD"); }} />Pay with delivery (Phnom Penh only){hasPre ? " · not available for pre-order items" : ""}{!methodOn(site, "COD") && (modeOf(site, "COD") === "soon" ? " · Coming soon" : " (temporarily unavailable)")}</label></fieldset>
    {method === "QR_IMAGE" && <div className="space-y-3 rounded-xl2 border border-sky-border bg-white p-4 text-center">
      {site.qrUrl === "none" ? <p className="rounded-xl bg-sky-pale px-4 py-6 text-sm text-mute">The payment QR is not available right now. Please contact us on Telegram or Facebook to pay.</p> : <img src={site.qrUrl || "/img/qr-pay.png"} alt="ABA PAY QR code for Cloudy Toys (YIHOR THENG)" className="mx-auto w-full max-w-sm rounded-xl2 border border-sky-border" />}
      <p>Scan and pay exactly <b>{money(payNow)}</b>{split && (split.balanceCents > 0 ? <> (your {split.percent}% pre-order deposit)</> : <> (full pre-order price)</>)}.</p>
      <div className="mx-auto max-w-sm space-y-2 text-left"><label className="block text-sm font-semibold">Upload your payment screenshot (required)
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => pickProof(e.target.files?.[0] ?? null)} className="mt-1 w-full rounded-xl border border-sky-border bg-white px-3 py-2 text-sm font-normal" /></label>
        {preview && <img src={preview} alt="Your payment screenshot" className="mx-auto max-h-48 rounded-lg border border-sky-border" />}</div></div>}
    <div><label className="block">{t("Discount code")}<span className="mt-1 flex gap-2"><input value={code} placeholder="Example: TOY10" onChange={(e) => { setCode(e.target.value.toUpperCase()); setApplied(null); setCodeMsg(""); }} maxLength={40} autoComplete="off" className={`${cls} font-mono uppercase`} />
      <button type="button" onClick={applyCode} disabled={checking || !code.trim()} className="rounded-full border border-sky-border bg-white px-5 font-bold hover:bg-sky-pale disabled:opacity-50">{checking ? "…" : t("Apply")}</button></span></label>
      <p className="mt-1 text-xs text-mute">{t("Takes 10% to 50% off your subtotal.")}</p>{applied && <p role="status" className="mt-1 text-sm text-green-700">Code {applied.code} applied: −{money(discount)}</p>}{codeMsg && <p role="alert" className="mt-1 text-sm text-red-700">{codeMsg}</p>}</div>
    {err && <p role="alert" className="text-red-700">{err}</p>}
    <button disabled={busy || !!placed || !firstOn || (method === "QR_IMAGE" && !file)} className="min-h-11 rounded-full bg-sky px-8 font-bold hover:bg-sky-hover disabled:cursor-not-allowed disabled:opacity-50">{busy ? t("Sending…") : method === "QR_IMAGE" ? t("I have paid") : method === "BAKONG" ? "Continue to KHQR" : t("Place order")}</button>
    {method === "QR_IMAGE" && !file && <p className="text-xs text-mute">Upload your payment screenshot to enable &quot;I have paid&quot;.</p>}
</form>
    <aside className="h-fit space-y-2 rounded-xl2 border border-sky-border bg-white p-5 lg:sticky lg:top-24"><h2 className="font-extrabold">{t("Order summary")}</h2>
      {items.map(({ l, p }) => <p key={l.id} className="flex justify-between text-sm"><span>{p!.name} × {l.qty}</span><span>{money((p!.salePrice ?? p!.price) * l.qty)}</span></p>)}
      {autos.map((a) => <p key={a.id} className="flex justify-between text-sm text-green-700"><span>{a.name}</span><span>−{money(a.cents / 100)}</span></p>)}
      {applied && <p className="flex justify-between text-sm text-green-700"><span>Discount ({applied.code})</span><span>−{money(discount)}</span></p>}
      <p className="flex justify-between text-sm text-mute"><span>{t("Delivery")}</span><span>{money(ship)}</span></p><p className="flex justify-between font-extrabold"><span>{t("Total")}</span><span>{money(totalC / 100)}</span></p>
      {split && <><p className="flex justify-between text-sm font-bold text-[#A97A0B]"><span>{split.balanceCents > 0 ? `Deposit due now (${split.percent}%)` : "Full price due now"}</span><span>{money(split.depositCents / 100)}</span></p>{split.balanceCents > 0 && <p className="flex justify-between text-sm text-mute"><span>Balance at dispatch ({split.dispatch})</span><span>{money(split.balanceCents / 100)}</span></p>}</>}
      <p className="text-xs text-mute">The server sets the final total.</p></aside>
    <dialog ref={dlg} onClose={onClosePopup} className="max-w-sm rounded-xl2 p-6 backdrop:bg-black/40"><h2 className="text-lg font-extrabold">Please contact our admin</h2>
      <p className="my-3 text-sm">Thank you! Your order and payment screenshot have been sent to our admin. To confirm your payment quickly, you can also message our admin with your order number <b>{placed}</b>.</p>
      <div className="space-y-2">{telegram && <a href={telegram} target="_blank" rel="noopener noreferrer" className={link}>Telegram</a>}{facebook && <a href={facebook} target="_blank" rel="noopener noreferrer" className={link}>Facebook page</a>}{!telegram && !facebook && <a href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(`Payment ${placed}`)}`} className={link}>Email {ADMIN_EMAIL}</a>}</div>
      <form method="dialog" className="mt-4 text-center"><button className="rounded-full border border-sky-border px-6 py-2">Close</button></form></dialog></div>);
}
