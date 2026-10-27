import { useI18n } from "@/lib/i18n";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import Skeleton from "@/components/Skeleton";
import FilePicker from "@/components/admin/FilePicker";
import { useSettings } from "@/lib/store";
import { modeOf, type PayMode } from "@shared/payOptions";
import { api, post } from "@/lib/api";
import { compressFormData } from "@/lib/compress";
import { useTitle } from "@/lib/title";
import { refreshAdmin, Msg } from "./hooks";
export default function Settings() {
  const { t } = useI18n(); useTitle(t("Settings"), true);
  const [sp, setSp] = useSearchParams(); const { settings: s, loading } = useSettings(); const [busy, setBusy] = useState(""); const [zoom, setZoom] = useState(false); const [diag, setDiag] = useState<{ ok: boolean; steps: { label: string; ok: boolean; detail: string }[] } | "loading" | "error" | null>(null);
  useEffect(() => { if (!zoom) return; const k = (e: KeyboardEvent) => e.key === "Escape" && setZoom(false); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [zoom]);
  if (loading) return <Skeleton />;
  const cls = "w-full rounded-xl border border-sky-border bg-white px-4 py-3";
  const run = (name: string, send: (f: FormData) => Promise<Response>, after?: () => void) => async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (busy) return; setBusy(name); const form = e.currentTarget;
    try { const j = await (await send(new FormData(form))).json().catch(() => ({})) as { ok?: boolean; error?: string };  refreshAdmin(); if (j.ok) { form.reset(); after?.(); } setSp(j.ok ? { saved: "1" } : { error: j.error ?? "Could not save. Please try again." }); window.scrollTo({ top: 0 }); }
    catch { setSp({ error: "Could not reach the server. Please try again." }); } finally { setBusy(""); }
  };
  const del = async (name: string, msg: string, send: () => Promise<Response>) => {
    if (busy || (msg && !confirm(msg))) return; setBusy(name);
    try { const j = await (await send()).json().catch(() => ({})) as { ok?: boolean; error?: string }; refreshAdmin(); setSp(j.ok ? { saved: "1" } : { error: j.error ?? "Could not delete. Please try again." }); window.scrollTo({ top: 0 }); }
    catch { setSp({ error: "Could not reach the server. Please try again." }); } finally { setBusy(""); }
  };
  const reset = () => { const f = new FormData(); f.set("reset", "on"); return f; };
  const btnDel = "rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50";
  const multi = (path: string) => async (f: FormData) => api(path, { method: "POST", body: await compressFormData(f) });
  const json = (f: FormData) => post("/admin/settings", { pp: f.get("pp"), prov: f.get("prov"), tg: f.get("tg"), fb: f.get("fb"), ig: f.get("ig") });
  return (<div className="max-w-xl space-y-6"><h1 className="text-2xl font-extrabold sm:text-3xl">{t("Store settings")}</h1>
    <Msg ok={sp.get("saved") ? "Saved" : null} err={sp.get("error")} />
    <section className="space-y-3 rounded-xl2 border border-sky-border bg-white p-4"><p className="font-semibold">Payment options</p>
      <p className="text-sm text-mute"><b>Start</b> = customers can pay with it. <b>Pause</b> = hidden for now (shown as unavailable). <b>Coming soon</b> = shown as &quot;Coming soon&quot;. Orders already placed can still be paid. Keep at least one on Start.</p>
      {([["payBakong", "Bakong KHQR", "Scan to pay, confirmed automatically"], ["payQr", "QR image + screenshot", "Customer uploads a payment screenshot"], ["payCod", "Pay with delivery", "Cash on delivery, Phnom Penh only"]] as const).map(([k, name, hint]) => {
        const cur = modeOf(s, k === "payBakong" ? "BAKONG" : k === "payQr" ? "QR_IMAGE" : "COD");
        const set = (m: PayMode) => del("pay", "", async () => post("/admin/settings/payments", { payBakong: modeOf(s, "BAKONG"), payQr: modeOf(s, "QR_IMAGE"), payCod: modeOf(s, "COD"), [k]: m }));
        const opts: [PayMode, string, string][] = [["on", "Start", "bg-green-500 text-white"], ["paused", "Pause", "bg-red-500 text-white"], ["soon", "Coming soon", "bg-amber-400 text-black"]];
        return (<div key={k} className="space-y-2 rounded-xl border border-sky-border p-3"><div><p className="font-bold">{name}</p><p className="text-xs text-mute">{hint}</p></div>
          <div role="radiogroup" aria-label={name} className="grid grid-cols-3 gap-1 rounded-full bg-sky-pale p-1">{opts.map(([m, label, on]) => <button key={m} type="button" role="radio" aria-checked={cur === m} disabled={!!busy} onClick={() => cur !== m && set(m)} className={`min-h-10 rounded-full px-2 text-sm font-bold transition disabled:opacity-60 ${cur === m ? on : "hover:bg-white"}`}>{label}</button>)}</div></div>);
      })}</section>
    <section className="space-y-2 rounded-xl2 border border-sky-border bg-white p-4"><p className="font-semibold">Bakong auto-payment test</p>
      <p className="text-sm text-mute">Checks that your Bakong account, token and connection work, so customers get the green &quot;Payment successful&quot; popup automatically.</p>
      <button type="button" disabled={diag === "loading"} onClick={async () => { setDiag("loading"); try { const r = await api("/admin/bakong/diagnose"); setDiag(r.ok ? await r.json() : "error"); } catch { setDiag("error"); } }} className="min-h-11 rounded-full bg-sky px-6 font-bold hover:bg-sky-hover disabled:opacity-50">{diag === "loading" ? "Testing…" : "Test Bakong connection"}</button>
      {diag === "error" && <p role="alert" className="text-sm text-red-700">Could not run the test.</p>}
      {diag && typeof diag === "object" && <div role="status" className="space-y-1 text-sm"><p className={`font-bold ${diag.ok ? "text-green-700" : "text-red-700"}`}>{diag.ok ? "✓ Working: payments will be confirmed automatically" : "✗ Not working yet"}</p>{diag.steps.map((x) => <p key={x.label}><span className={x.ok ? "text-green-700" : "text-red-700"}>{x.ok ? "✓" : "✗"}</span> <b>{x.label}</b>: {x.detail}</p>)}</div>}</section>
    <form onSubmit={run("logo", multi("/admin/settings/logo"))} className="space-y-3 rounded-xl2 border border-sky-border bg-white p-4"><p className="font-semibold">Shop logo</p>
      <p className="text-sm text-mute">Shown in the shop header, footer and admin. JPG, PNG or WebP, max 5 MB. A PNG with a transparent background looks best.</p>
      <img src={s.logoUrl} alt="Current logo" className="h-20 w-auto rounded-xl border border-sky-border bg-page p-1" />
      <FilePicker name="logo" />
      <div className="flex flex-wrap gap-2"><button disabled={!!busy} className="min-h-11 rounded-full bg-sky px-8 font-bold hover:bg-sky-hover disabled:opacity-50">{busy === "logo" ? "Saving…" : "Update logo"}</button>
      {s.logoUrl !== "/img/logo.png" && <button type="button" disabled={!!busy} onClick={() => del("logo", "Delete this logo and go back to the default logo?", async () => api("/admin/settings/logo", { method: "POST", body: reset() }))} className={btnDel}>Delete logo</button>}</div></form>
    <form onSubmit={run("banners", multi("/admin/settings/banners"))} className="space-y-3 rounded-xl2 border border-sky-border bg-white p-4"><p className="font-semibold">Home page banners</p>
      <p className="text-sm text-mute">Shown above &quot;Featured products&quot; and change every 2 seconds. Up to 10 images (JPG, PNG, WebP, max 5 MB each). Best size: wide, about 1600 × 750.</p>
      {(s.banners ?? []).length > 0 && <div className="flex flex-wrap gap-3">{s.banners.map((b) => <div key={b} className="w-40 space-y-1 text-center"><img src={b} alt="Banner" className="h-20 w-40 rounded-lg border border-sky-border object-cover" /><input type="hidden" name="keep" value={b} /><button type="button" disabled={!!busy} onClick={() => del("banner", "", () => post("/admin/settings/banners/delete", { url: b }))} className={btnDel + " w-full"}>Delete</button></div>)}</div>}
      <FilePicker name="banners" multiple />
      <button disabled={!!busy} className="min-h-11 rounded-full bg-sky px-8 font-bold hover:bg-sky-hover disabled:opacity-50">{busy === "banners" ? "Saving…" : "Save banners"}</button></form>
    <form onSubmit={run("qr", multi("/admin/settings/qr"))} className="space-y-3 rounded-xl2 border border-sky-border bg-white p-4"><p className="font-semibold">Payment QR (ABA PAY)</p>
      <p className="text-sm text-mute">Shown to customers at checkout. JPG, PNG or WebP, max 5 MB.</p>
      {s.qrUrl === "none" ? <p className="rounded-xl border border-dashed border-sky-border bg-sky-pale px-4 py-6 text-center text-sm text-mute">No payment QR yet. Upload one below.</p> : <div className="relative inline-block"><button type="button" onClick={() => setZoom(true)} aria-label="View the payment QR bigger" className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-hover"><img src={s.qrUrl || "/img/qr-pay.png"} alt="Current payment QR" className="w-48 rounded-xl border border-sky-border" /></button>
        <button type="button" onClick={() => setZoom(true)} className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-xs font-bold shadow-soft hover:bg-sky-pale"><span aria-hidden="true">🔍</span>View</button>
        <button type="button" disabled={!!busy} onClick={() => del("qr", "", async () => api("/admin/settings/qr", { method: "POST", body: reset() }))} aria-label="Delete this QR" title="Delete this QR" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-sm font-bold leading-none text-red-700 shadow-soft hover:bg-red-50 disabled:opacity-50">✕</button></div>}
      <FilePicker name="qr" />
      <div className="flex flex-wrap gap-2"><button disabled={!!busy} className="min-h-11 rounded-full bg-sky px-8 font-bold hover:bg-sky-hover disabled:opacity-50">{busy === "qr" ? "Saving…" : "Update QR"}</button></div></form>
    <form key={`${s.shipPhnomPenhCents}-${s.shipProvinceCents}-${s.telegramUrl}-${s.facebookUrl}-${s.instagramUrl}`} onSubmit={run("store", json)} className="space-y-3">
    <label className="block">Delivery fee, Phnom Penh (USD)<input name="pp" type="number" step="0.01" min="0" defaultValue={(s.shipPhnomPenhCents / 100).toFixed(2)} className={cls} /></label>
    <label className="block">Delivery fee, Province (USD)<input name="prov" type="number" step="0.01" min="0" defaultValue={(s.shipProvinceCents / 100).toFixed(2)} className={cls} /></label>
    <label className="block">Telegram link (https://…)<input name="tg" defaultValue={s.telegramUrl} className={cls} /></label>
    <label className="block">Facebook page link (https://…)<input name="fb" defaultValue={s.facebookUrl} className={cls} /></label>
    <label className="block">Instagram link (https://…)<input name="ig" defaultValue={s.instagramUrl} className={cls} /></label>
    <button disabled={!!busy} className="min-h-11 rounded-full bg-sky px-8 font-bold hover:bg-sky-hover disabled:opacity-50">{busy === "store" ? "Saving…" : "Save settings"}</button></form>
    {zoom && <div role="dialog" aria-modal="true" aria-label="Payment QR" onClick={() => setZoom(false)} className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><div onClick={(e) => e.stopPropagation()} className="relative max-h-full max-w-lg overflow-auto rounded-2xl bg-white p-3 shadow-lift"><button type="button" autoFocus onClick={() => setZoom(false)} aria-label="Close" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-lg font-bold shadow-soft hover:bg-sky-pale">×</button><img src={s.qrUrl || "/img/qr-pay.png"} alt="Payment QR" className="h-auto w-full rounded-xl" /></div></div>}</div>);
}
