import { useState, type FormEvent } from "react";
import Icon from "@/components/admin/Icons";
import Modal from "@/components/admin/Modal";
import Skeleton from "@/components/Skeleton";
import { post } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useTitle } from "@/lib/title";
import { MIN_PERCENT, MAX_PERCENT, generateCode } from "@shared/discount";
import { campaignDetail, type Campaign, type CampaignKind, type Promotions } from "@shared/promotions";
import { useAdmin, refreshAdmin } from "./hooks";
type Msg = { ok: boolean; text: string } | null;
const field = "w-full rounded-xl border border-sky-border bg-[#F3F9FE] px-3.5 py-2.5 outline-none";
const lab = "block text-sm font-bold";
const card = "rounded-3xl bg-white p-5 shadow-soft sm:p-6";
const PRESETS = [10, 20, 30, 40, 50];
/** Sends one admin action and returns the server's answer as a tidy message. */
async function send(path: string, body: object, ok: string): Promise<{ ok: boolean; text: string }> {
  try { const j = await (await post(path, body)).json().catch(() => ({})) as { ok?: boolean; error?: string }; if (j.ok) { refreshAdmin(); return { ok: true, text: ok }; } return { ok: false, text: j.error ?? "Could not save. Please try again." }; }
  catch { return { ok: false, text: "Could not reach the server. Please try again." }; }
}
function CampaignModal({ c, categories, onClose, onDone }: { c?: Campaign; categories: string[]; onClose: () => void; onDone: (m: Msg) => void }) {
  const { t } = useI18n(); const [kind, setKind] = useState<CampaignKind>(c?.kind ?? "spend_amount"); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>, close: () => void) {
    e.preventDefault(); if (busy) return; setBusy(true); setErr(""); const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? "");
    const body = { id: c?.id, name: v("name"), kind, minSpend: v("minSpend"), amount: v("amount"), percent: v("percent"), category: v("category") };
    const r = await send(c ? "/admin/promotions/campaigns/update" : "/admin/promotions/campaigns/add", body, c ? t("Campaign updated") : t("Campaign added")); setBusy(false);
    if (r.ok) { onDone(r); close(); } else setErr(r.text);
  }
  return (<Modal icon="discounts" title={c ? t("Edit Campaign") : t("Add Campaign")} onClose={onClose}>{(close) => (<form onSubmit={(e) => submit(e, close)} className="space-y-4 p-5 sm:p-7">
    {err && <p role="alert" className="rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-800">{err}</p>}
    <label className={lab}>{t("Campaign name")}<input name="name" required minLength={2} maxLength={60} defaultValue={c?.name} placeholder="Spend & Save $5.00 Off" className={`${field} mt-1`} /></label>
    <label className={lab}>{t("Discount type")}<select value={kind} onChange={(e) => setKind(e.target.value as CampaignKind)} className={`${field} mt-1`}>
      <option value="spend_amount">{t("Spend & Save: fixed amount off the order")}</option><option value="spend_percent">{t("Spend & Save: % off the order")}</option><option value="category_percent">{t("Category: % off a product category")}</option></select></label>
    {kind !== "category_percent" && <label className={lab}>{t("Minimum spend ($)")}<input name="minSpend" type="number" step="0.01" min="0" required defaultValue={c ? c.minSpendCents / 100 : 20} className={`${field} mt-1`} /></label>}
    {kind === "spend_amount" && <label className={lab}>{t("Discount amount ($)")}<input name="amount" type="number" step="0.01" min="0.01" required defaultValue={c && c.amountCents ? c.amountCents / 100 : 5} className={`${field} mt-1`} /></label>}
    {kind !== "spend_amount" && <label className={lab}>{t("Discount %")}<input name="percent" type="number" step="1" min="1" max="90" required defaultValue={c && c.percent ? c.percent : 15} className={`${field} mt-1`} /></label>}
    {kind === "category_percent" && <label className={lab}>{t("Category")}{categories.length ? <select name="category" required defaultValue={c?.category ?? ""} className={`${field} mt-1`}><option value="" disabled>{t("Choose a category")}</option>{categories.map((x) => <option key={x} value={x}>{x}</option>)}</select> : <input name="category" required maxLength={40} defaultValue={c?.category} className={`${field} mt-1`} />}</label>}
    <p className="text-xs text-mute">{t("Applied automatically at checkout. Delivery is never discounted. Active campaigns stack, and a typed promo code then takes its % off what is left.")}</p>
    <div className="flex justify-end gap-3 border-t border-sky-border pt-4"><button type="button" onClick={close} className="rounded-xl border border-sky-border bg-white px-6 py-2.5 font-bold hover:bg-sky-pale">{t("Cancel")}</button><button disabled={busy} className="rounded-xl bg-sky px-6 py-2.5 font-extrabold shadow-soft hover:bg-sky-hover disabled:opacity-50">{busy ? t("Saving…") : t("Save Campaign")}</button></div>
  </form>)}</Modal>);
}
export default function Promotions() {
  const { t } = useI18n(); useTitle(t("Promotions"), true);
  const { data } = useAdmin<{ promotions: Promotions; categories: string[] }>("/admin/promotions"); const { data: codes } = useAdmin<{ codes: { code: string; percent: number }[] }>("/admin/discounts");
  const [msg, setMsg] = useState<Msg>(null); const [camp, setCamp] = useState<Campaign | "new" | null>(null); const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(""); const [percent, setPercent] = useState(10);
  if (!data || !codes) return <Skeleton />;
  const { preorder, campaigns } = data.promotions;
  const savePre = async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); if (busy) return; setBusy(true); const f = new FormData(e.currentTarget);
    setMsg(await send("/admin/promotions/preorder", { depositPercent: f.get("depositPercent"), dispatchText: f.get("dispatchText"), capSlots: f.get("capSlots") }, t("Pre-order rules saved"))); setBusy(false); window.scrollTo({ top: 0 }); };
  const act = async (path: string, body: object, ok: string) => { setMsg(await send(path, body, ok)); };
  const createCode = async (e: FormEvent) => { e.preventDefault(); if (busy) return; setBusy(true); const r = await send("/admin/discounts/create", { code, percent }, `Code ${code.trim().toUpperCase()} created`); setMsg(r); if (r.ok) setCode(""); setBusy(false); };
  return (<div className="space-y-4">
    <h1 className="text-2xl font-extrabold sm:text-3xl">{t("Promotions & Pre-Order Rules")}</h1>
    {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-xl p-3 font-semibold ${msg.ok ? "bg-green-100 text-green-900" : "bg-red-100 text-red-800"}`}>{msg.text}</p>}
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={card}><div className="mb-4 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF1C9] text-[#C98F0B]"><Icon name="orders" size={22} /></span><div><h2 className="text-lg font-extrabold">{t("Pre-Order Global Rules")}</h2><p className="text-sm text-mute">{t("Configure down payment rates and dispatch estimates.")}</p></div></div>
        <form onSubmit={savePre} className="space-y-4">
          <label className={lab}>{t("Required Deposit (%)")}<input name="depositPercent" type="number" min="1" max="100" step="1" required defaultValue={preorder.depositPercent} className={`${field} mt-1`} /></label>
          <label className={lab}>{t("Estimated Dispatch Timeline")}<input name="dispatchText" required minLength={2} maxLength={60} defaultValue={preorder.dispatchText} className={`${field} mt-1`} /></label>
          <label className={lab}>{t("Pre-order Cap Slot Limit")}<input name="capSlots" type="number" min="1" max="100000" step="1" required defaultValue={preorder.capSlots} className={`${field} mt-1`} /></label>
          <p className="-mt-2 text-xs text-mute">{t("The start date and deadline are set on each pre-order product, one by one.")}</p>
          <button disabled={busy} className="w-full rounded-xl bg-sky py-3 font-extrabold shadow-soft hover:bg-sky-hover disabled:opacity-50">{t("Save Deposit Rules")}</button>
          <p className="text-xs text-mute">{t("Products with the Pre-Order Item label: customers pay this deposit now, the rest when the order is dispatched. A pre-order item's stock is its number of slots, and cannot be higher than the cap.")}</p></form></section>
      <section className={card}><div className="mb-4 flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFE3EC] text-[#E0456B]"><Icon name="discounts" size={22} /></span><div><h2 className="text-lg font-extrabold">{t("Automatic Discounts")}</h2><p className="text-sm text-mute">{t("No promo codes needed at checkout.")}</p></div></div>
        <button type="button" onClick={() => setCamp("new")} className="shrink-0 text-sm font-extrabold text-[#E0456B] hover:underline">+ {t("Add Campaign")}</button></div>
        {campaigns.length === 0 ? <p className="rounded-xl border border-dashed border-sky-border p-5 text-center text-sm text-mute">{t("No campaigns yet. Add one and it applies at checkout automatically.")}</p>
          : <ul className="space-y-3">{campaigns.map((c) => <li key={c.id} className={`rounded-2xl border border-sky-border p-3.5 ${c.active ? "" : "opacity-60"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-extrabold">{c.name}</p><p className="text-sm text-mute">{campaignDetail(c)}</p></div>
            <button type="button" aria-pressed={c.active} title={c.active ? t("Click to pause") : t("Click to activate")} onClick={() => act("/admin/promotions/campaigns/toggle", { id: c.id, active: !c.active }, c.active ? t("Campaign paused") : t("Campaign activated"))} className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold ${c.active ? "bg-[#DDF6E8] text-[#2F8F5B]" : "bg-slate-200 text-slate-600"}`}>{c.active ? t("ACTIVE") : t("PAUSED")}</button></div>
            <div className="mt-2 flex gap-4 text-sm font-bold"><button type="button" onClick={() => setCamp(c)} className="text-sky-hover hover:underline">{t("Edit")}</button><button type="button" onClick={() => { if (confirm(`Delete the campaign "${c.name}"?`)) void act("/admin/promotions/campaigns/delete", { id: c.id }, t("Campaign deleted")); }} className="text-[#E0456B] hover:underline">{t("Delete")}</button></div></li>)}</ul>}</section></div>
    <section className={card}><h2 className="text-lg font-extrabold">{t("Promo codes")}</h2><p className="mb-4 text-sm text-mute">{t("Make a code worth 10% to 50% off the cart subtotal and give it to your customers. They type it at checkout. Delivery is never discounted. There are no discounts on single items.")}</p>
      <form onSubmit={createCode} className="flex flex-wrap items-end gap-3"><label className={`${lab} min-w-52 flex-1`}>{t("Code")}<span className="mt-1 flex gap-2"><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} required minLength={3} maxLength={30} autoComplete="off" placeholder="e.g. SAVE10" className={`${field} font-mono uppercase`} />
        <button type="button" onClick={() => setCode(generateCode())} className="shrink-0 rounded-xl border border-sky-border bg-white px-4 font-bold hover:bg-sky-pale">{t("Generate")}</button></span></label>
        <div className="flex flex-wrap items-center gap-2">{PRESETS.map((n) => <button key={n} type="button" aria-pressed={percent === n} onClick={() => setPercent(n)} className={`rounded-full border px-3.5 py-2 text-sm font-bold ${percent === n ? "border-sky bg-sky" : "border-sky-border bg-white hover:bg-sky-pale"}`}>{n}%</button>)}
          <input type="number" aria-label="Discount percent" value={percent} onChange={(e) => setPercent(Number(e.target.value))} required step={1} min={MIN_PERCENT} max={MAX_PERCENT} className="w-20 rounded-xl border border-sky-border bg-[#F3F9FE] px-3 py-2" /></div>
        <button disabled={busy} className="rounded-xl bg-sky px-6 py-2.5 font-extrabold shadow-soft hover:bg-sky-hover disabled:opacity-50">{t("Create code")}</button></form>
      {codes.codes.length > 0 && <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{codes.codes.map((c) => <li key={c.code} className="space-y-2 rounded-2xl border border-sky-border bg-sky-pale p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-all font-mono text-base font-extrabold">{c.code}</p><p className="text-sm text-mute">{t("{n}% off the subtotal", { n: c.percent })}</p></div>
        <button type="button" onClick={() => { if (confirm(`Delete the code ${c.code}? Customers will no longer be able to use it.`)) void act("/admin/discounts/delete", { code: c.code }, `Code ${c.code} deleted`); }} className="text-sm font-bold text-[#E0456B] hover:underline">{t("Delete")}</button></div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Change percent for ${c.code}`}>{PRESETS.map((n) => <button key={n} type="button" disabled={n === c.percent} onClick={() => act("/admin/discounts/update", { code: c.code, percent: n }, `Code ${c.code} is now ${n}% off`)} className={`rounded-full px-3 py-1 text-xs font-bold ${n === c.percent ? "bg-sky" : "border border-sky-border bg-white hover:bg-sky-pale"}`}>{n}%</button>)}</div></li>)}</ul>}</section>
    {camp && <CampaignModal key={camp === "new" ? "new" : camp.id} c={camp === "new" ? undefined : camp} categories={data.categories} onClose={() => setCamp(null)} onDone={setMsg} />}
  </div>);
}
